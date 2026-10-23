import { asc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db, type Executor } from '../db/client';
import { locations, operatingAreas } from '../db/schema';
import { AppError, conflict, forbidden, isUniqueViolation, notFound, validationError } from '../errors';
import { can, type Actor } from '../policy';
import type { ClientMeta } from './accounts';
import { audit } from './audit';
import { withinServiceArea } from './service-area';

/**
 * Holy Mission's official operating areas: Lakshmipur district and, where useful, the upazilas
 * inside it where the team is active. Nothing outside Lakshmipur can be added.
 */
export interface OperatingAreaRow {
  id: number;
  locationId: number;
  level: 'division' | 'district' | 'upazila';
  nameBn: string;
  nameEn: string;
  parentNameBn: string | null;
  parentNameEn: string | null;
  isActive: boolean;
  publicNote: string | null;
  updatedAt: Date;
}

/** Location code of Lakshmipur district in data/bd-locations.json — the initial operating area. */
export const INITIAL_OPERATING_AREA_CODE = 'dist-7';

export async function listOperatingAreas(options: { activeOnly?: boolean } = {}, executor: Executor = db): Promise<OperatingAreaRow[]> {
  const parent = alias(locations, 'parent');
  const rows = await executor
    .select({
      id: operatingAreas.id,
      locationId: operatingAreas.locationId,
      level: locations.level,
      nameBn: locations.nameBn,
      nameEn: locations.nameEn,
      parentNameBn: parent.nameBn,
      parentNameEn: parent.nameEn,
      isActive: operatingAreas.isActive,
      publicNote: operatingAreas.publicNote,
      updatedAt: operatingAreas.updatedAt,
    })
    .from(operatingAreas)
    .innerJoin(locations, eq(locations.id, operatingAreas.locationId))
    .leftJoin(parent, eq(parent.id, locations.parentId))
    .where(options.activeOnly ? eq(operatingAreas.isActive, true) : undefined)
    .orderBy(asc(locations.nameEn));
  return rows;
}

function requireManager(actor: Actor) {
  if (!can(actor, 'operating_areas.manage')) throw forbidden();
}

export async function addOperatingArea(actor: Actor, locationId: number, publicNote: string | null, meta: ClientMeta = {}) {
  requireManager(actor);
  const [location] = await db.select().from(locations).where(eq(locations.id, locationId));
  if (!location || !location.isActive) throw validationError({ locationId: 'invalidLocation' });
  if (!(await withinServiceArea([locationId]))) throw validationError({ locationId: 'outsideServiceArea' });
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx.insert(operatingAreas).values({ locationId, publicNote, updatedByUserId: actor.userId }).returning();
      await audit(tx, { actor, action: 'operating_area.added', targetType: 'location', targetId: String(locationId), metadata: { level: location.level, nameEn: location.nameEn }, ipHash: meta.ipHash });
      return row;
    });
  } catch (error) {
    if (isUniqueViolation(error, 'operating_areas_location_key')) throw conflict('duplicate');
    throw error;
  }
}

/** Activate or deactivate an area. A reason is required and recorded in the audit log. */
export async function setOperatingAreaActive(actor: Actor, id: number, isActive: boolean, reason: string, meta: ClientMeta = {}) {
  requireManager(actor);
  if (!reason.trim()) throw validationError({ reason: 'required' });
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(operatingAreas).where(eq(operatingAreas.id, id)).for('update');
    if (!current) throw notFound();
    if (current.isActive === isActive) throw new AppError('invalid_state');
    await tx.update(operatingAreas).set({ isActive, updatedByUserId: actor.userId, updatedAt: new Date() }).where(eq(operatingAreas.id, id));
    await audit(tx, {
      actor,
      action: isActive ? 'operating_area.activated' : 'operating_area.deactivated',
      targetType: 'location',
      targetId: String(current.locationId),
      metadata: { reason },
      ipHash: meta.ipHash,
    });
  });
}

export async function updateOperatingAreaNote(actor: Actor, id: number, publicNote: string | null, meta: ClientMeta = {}) {
  requireManager(actor);
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(operatingAreas)
      .set({ publicNote, updatedByUserId: actor.userId, updatedAt: new Date() })
      .where(eq(operatingAreas.id, id))
      .returning({ locationId: operatingAreas.locationId });
    if (updated.length === 0) throw notFound();
    await audit(tx, { actor, action: 'operating_area.note_updated', targetType: 'location', targetId: String(updated[0].locationId), ipHash: meta.ipHash });
  });
}

/**
 * Makes sure the initial operating area (Lakshmipur) exists. Idempotent and never re-activates
 * an area an administrator has deactivated, so it is safe to run on every deploy.
 */
export async function seedInitialOperatingArea(executor: Executor = db): Promise<boolean> {
  const [lakshmipur] = await executor.select().from(locations).where(eq(locations.code, INITIAL_OPERATING_AREA_CODE));
  if (!lakshmipur || lakshmipur.nameEn !== 'Lakshmipur' || lakshmipur.level !== 'district') return false;
  const inserted = await executor
    .insert(operatingAreas)
    .values({ locationId: lakshmipur.id, isActive: true })
    .onConflictDoNothing({ target: operatingAreas.locationId })
    .returning({ id: operatingAreas.id });
  return inserted.length > 0;
}
