import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db, type Executor } from '../db/client';
import { locations } from '../db/schema';
import type { Actor } from '../policy';
import { isAdmin } from '../policy';
import { conflict, forbidden, notFound, validationError } from '../errors';
import { isUniqueViolation } from '../errors';
import { audit } from './audit';

export interface LocationNode {
  id: number;
  parentId: number | null;
  level: 'division' | 'district' | 'upazila';
  nameBn: string;
  nameEn: string;
}

/** Compact list of all active locations, for pickers. */
export async function listActiveLocations(executor: Executor = db): Promise<LocationNode[]> {
  return executor
    .select({ id: locations.id, parentId: locations.parentId, level: locations.level, nameBn: locations.nameBn, nameEn: locations.nameEn })
    .from(locations)
    .where(eq(locations.isActive, true))
    .orderBy(asc(locations.level), asc(locations.nameEn));
}

export async function getLocation(id: number, executor: Executor = db) {
  const [row] = await executor.select().from(locations).where(eq(locations.id, id));
  return row ?? null;
}

export async function getLocationsByIds(ids: number[], executor: Executor = db) {
  if (ids.length === 0) return [];
  return executor.select().from(locations).where(inArray(locations.id, ids));
}

/**
 * Validates that division > district > upazila form a consistent active chain.
 * Returns field errors keyed by form field name.
 */
export async function validateLocationChain(
  input: { divisionId: number; districtId: number; upazilaId?: number | null },
  executor: Executor = db,
): Promise<Record<string, string>> {
  const ids = [input.divisionId, input.districtId, input.upazilaId].filter((v): v is number => typeof v === 'number');
  const rows = await getLocationsByIds(ids, executor);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const errors: Record<string, string> = {};
  const division = byId.get(input.divisionId);
  const district = byId.get(input.districtId);
  if (!division || division.level !== 'division' || !division.isActive) errors.divisionId = 'invalidLocation';
  if (!district || district.level !== 'district' || district.parentId !== input.divisionId || !district.isActive) errors.districtId = 'invalidLocation';
  if (input.upazilaId != null) {
    const upazila = byId.get(input.upazilaId);
    if (!upazila || upazila.level !== 'upazila' || upazila.parentId !== input.districtId || !upazila.isActive) errors.upazilaId = 'invalidLocation';
  }
  return errors;
}

/** Ids of a location and all of its descendants (used for service areas and search expansion). */
export async function descendantIds(locationIds: number[], executor: Executor = db): Promise<number[]> {
  if (locationIds.length === 0) return [];
  const rows = await executor.execute<{ id: number }>(sql`
    with recursive tree as (
      select id from locations where id in ${sql.raw(`(${locationIds.map((n) => Number(n)).join(',')})`)}
      union
      select l.id from locations l join tree t on l.parent_id = t.id
    )
    select id from tree`);
  return rows.map((r) => Number(r.id));
}

export async function createLocation(
  actor: Actor,
  input: { parentId: number | null; level: 'division' | 'district' | 'upazila'; nameBn: string; nameEn: string },
  ipHash?: string | null,
) {
  if (!isAdmin(actor)) throw forbidden();
  const expectedParent = { division: null, district: 'division', upazila: 'district' } as const;
  if (input.level === 'division' ? input.parentId !== null : input.parentId === null) throw validationError({ parentId: 'invalidLocation' });
  if (input.parentId !== null) {
    const parent = await getLocation(input.parentId);
    if (!parent || parent.level !== expectedParent[input.level]) throw validationError({ parentId: 'invalidLocation' });
  }
  const code = `custom-${input.level}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx.insert(locations).values({ ...input, code }).returning();
      await audit(tx, { actor, action: 'location.created', targetType: 'location', targetId: String(row.id), metadata: { level: input.level, parentId: input.parentId }, ipHash });
      return row;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict('duplicate');
    throw error;
  }
}

export async function updateLocation(
  actor: Actor,
  id: number,
  input: { nameBn: string; nameEn: string; isActive: boolean },
  ipHash?: string | null,
) {
  if (!isAdmin(actor)) throw forbidden();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(locations)
      .set({ nameBn: input.nameBn, nameEn: input.nameEn, isActive: input.isActive, updatedAt: new Date() })
      .where(eq(locations.id, id))
      .returning();
    if (!row) throw notFound();
    await audit(tx, { actor, action: 'location.updated', targetType: 'location', targetId: String(id), metadata: { isActive: input.isActive }, ipHash });
    return row;
  });
}

export async function childrenOf(parentId: number | null, executor: Executor = db) {
  return executor
    .select()
    .from(locations)
    .where(parentId === null ? and(eq(locations.level, 'division')) : eq(locations.parentId, parentId))
    .orderBy(asc(locations.nameEn));
}
