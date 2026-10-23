import { and, asc, eq, sql, type AnyColumn, type SQL } from 'drizzle-orm';
import { db, type Executor } from '../db/client';
import { locations } from '../db/schema';

/**
 * Holy Mission Blood Donation works in Lakshmipur district only. Donor registration, donor
 * search, blood requests and organisations are limited to Lakshmipur, and the services check
 * this on every write and every public read — the forms only make it easy to comply.
 *
 * The code is Lakshmipur's code in data/bd-locations.json (division Chattagram, five upazilas).
 * Records saved before this rule existed are kept: they are hidden from public views and shown
 * to staff as "outside Lakshmipur" so they can be corrected (see scripts/service-area-report.ts).
 */
export const SERVICE_DISTRICT_CODE = 'dist-7';

export interface ServiceArea {
  divisionId: number;
  districtId: number;
  nameBn: string;
  nameEn: string;
  upazilas: { id: number; nameBn: string; nameEn: string }[];
}

/** Lakshmipur district and its active upazilas, from the locations table. */
export async function getServiceArea(executor: Executor = db): Promise<ServiceArea> {
  const [district] = await executor.select().from(locations).where(eq(locations.code, SERVICE_DISTRICT_CODE));
  if (!district || district.parentId === null) throw new Error('Lakshmipur (dist-7) is missing from the locations table; run the seed.');
  const upazilas = await executor
    .select({ id: locations.id, nameBn: locations.nameBn, nameEn: locations.nameEn })
    .from(locations)
    .where(and(eq(locations.parentId, district.id), eq(locations.isActive, true)))
    .orderBy(asc(locations.nameEn));
  return { divisionId: district.parentId, districtId: district.id, nameBn: district.nameBn, nameEn: district.nameEn, upazilas };
}

/** SQL condition: the district id in `column` is Lakshmipur. */
export function inServiceDistrict(column: AnyColumn | SQL): SQL {
  return sql`${column} = (select l.id from locations l where l.code = ${SERVICE_DISTRICT_CODE})`;
}

/** The same check as a selectable boolean column. */
export function inServiceDistrictFlag(column: AnyColumn | SQL): SQL<boolean> {
  return sql<boolean>`coalesce(${inServiceDistrict(column)}, false)`;
}

/**
 * Field errors when an address is outside Lakshmipur. Call after the location chain itself has
 * been validated; the district must be Lakshmipur and an upazila, if given, one of its upazilas.
 */
export async function serviceAreaErrors(input: { districtId: number; upazilaId?: number | null }, executor: Executor = db): Promise<Record<string, string>> {
  const area = await getServiceArea(executor);
  if (input.districtId !== area.districtId) return { districtId: 'outsideServiceArea' };
  if (input.upazilaId != null && !area.upazilas.some((u) => u.id === input.upazilaId)) return { upazilaId: 'outsideServiceArea' };
  return {};
}

/** True when every id is Lakshmipur district or one of its active upazilas. */
export async function withinServiceArea(locationIds: number[], executor: Executor = db): Promise<boolean> {
  const area = await getServiceArea(executor);
  const allowed = new Set([area.districtId, ...area.upazilas.map((u) => u.id)]);
  return locationIds.every((id) => allowed.has(id));
}
