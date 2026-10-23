import { sql } from 'drizzle-orm';
import { closeDb, getDb } from '../src/server/db/client';
import { SERVICE_DISTRICT_CODE } from '../src/server/services/service-area';
import { loadEnv } from './env';

loadEnv();

/**
 * Read-only check for the Lakshmipur-only rule: counts records whose address is outside
 * Lakshmipur. Nothing is changed or deleted. Such records are already hidden from public pages;
 * staff can find donors with /admin/donors?area=outside and correct or close them.
 */
const db = getDb();
const lakshmipur = sql`(select id from locations where code = ${SERVICE_DISTRICT_CODE})`;
const [donors] = await db.execute<{ total: number; outside: number; outside_approved: number; outside_listed: number }>(sql`
  select count(*)::int as total,
    count(*) filter (where d.district_id <> ${lakshmipur})::int as outside,
    count(*) filter (where d.district_id <> ${lakshmipur} and d.registration_status = 'approved')::int as outside_approved,
    count(*) filter (where d.district_id <> ${lakshmipur} and c.listed_in_search)::int as outside_listed
  from donor_profiles d left join donor_consents c on c.donor_id = d.id`);
const [requests] = await db.execute<{ total: number; outside: number; outside_open: number }>(sql`
  select count(*)::int as total,
    count(*) filter (where district_id <> ${lakshmipur})::int as outside,
    count(*) filter (where district_id <> ${lakshmipur} and status in ('open', 'in_progress') and expires_at > now())::int as outside_open
  from blood_requests`);
const orgs = await db.execute<{ status: string; outside: number }>(sql`
  select status, count(*)::int as outside from communities where district_id <> ${lakshmipur} group by status order by status`);
const [areas] = await db.execute<{ outside: number }>(sql`
  select count(*)::int as outside from operating_areas oa join locations l on l.id = oa.location_id
  where l.id <> ${lakshmipur} and coalesce(l.parent_id, 0) <> ${lakshmipur}`);
console.log(
  JSON.stringify(
    {
      serviceArea: 'Lakshmipur (dist-7)',
      donors,
      bloodRequests: requests,
      organisationsOutsideByStatus: Object.fromEntries(orgs.map((o) => [o.status, o.outside])),
      operatingAreasOutside: areas.outside,
    },
    null,
    2,
  ),
);
await closeDb();
