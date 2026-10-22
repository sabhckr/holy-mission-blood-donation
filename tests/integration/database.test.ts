import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/server/db/client';
import { makeDonor, resetDb } from './helpers';

beforeEach(resetDb);

describe('database constraints (defence in depth)', () => {
  it('applied every migration and seeded the location hierarchy', async () => {
    const [m] = await db.execute<{ n: number }>(sql`select count(*)::int as n from drizzle.__drizzle_migrations`);
    expect(m.n).toBeGreaterThan(0);
    const rows = await db.execute<{ level: string; n: number }>(sql`select level, count(*)::int as n from locations group by level order by level`);
    expect(Object.fromEntries(rows.map((r) => [r.level, r.n]))).toEqual({ district: 64, division: 8, upazila: 494 });
  });

  it('rejects duplicate live donation records but allows them once voided', async () => {
    const d = await makeDonor();
    await db.execute(sql`insert into donations (donor_id, donated_on, donation_type, source, status) values (${d.donor.id}, '2026-01-01', 'whole_blood', 'self_reported', 'unverified')`);
    await expect(db.execute(sql`insert into donations (donor_id, donated_on, donation_type, source, status) values (${d.donor.id}, '2026-01-01', 'whole_blood', 'self_reported', 'unverified')`)).rejects.toThrow();
    await db.execute(sql`update donations set status = 'voided'`);
    await db.execute(sql`insert into donations (donor_id, donated_on, donation_type, source, status) values (${d.donor.id}, '2026-01-01', 'whole_blood', 'self_reported', 'unverified')`);
  });

  it('enforces availability expiry rules and request quantity limits', async () => {
    const d = await makeDonor();
    await expect(db.execute(sql`insert into availability_updates (donor_id, status, expires_at) values (${d.donor.id}, 'available', null)`)).rejects.toThrow();
    await expect(db.execute(sql`insert into availability_updates (donor_id, status, expires_at) values (${d.donor.id}, 'unavailable', now())`)).rejects.toThrow();
    await expect(
      db.execute(sql`insert into blood_requests (public_id, blood_group, units, division_id, district_id, hospital_name, needed_at, requester_name, requester_phone, dedupe_key, expires_at)
        values ('abcdefghjk', 'O+', 0, ${d.donor.divisionId}, ${d.donor.districtId}, 'H', now(), 'R', 'P', 'k', now())`),
    ).rejects.toThrow();
  });

  it('cascades a deleted user to their donor data', async () => {
    const d = await makeDonor();
    await db.execute(sql`delete from users where id = ${d.user.id}`);
    const [r] = await db.execute<{ n: number }>(sql`select count(*)::int as n from donor_profiles`);
    expect(r.n).toBe(0);
  });
});
