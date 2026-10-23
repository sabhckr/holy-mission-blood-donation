import { readFileSync } from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/server/db/client';
import { auditLogs, donorConsents, donorProfiles, verificationEvents } from '@/server/db/schema';
import {
  acknowledgePublicDetails,
  publicDetailsSince,
  registerDonor,
  revealDonorPhone,
  searchDonors,
  getPublicDonorProfile,
  setAvailability,
  setDonorListingPaused,
  updateConsents,
  updateDonorProfile,
} from '@/server/services/donors';
import { makeDonor, makeUser, nextPhone, OPEN_CONSENTS, PASSWORD, place, resetDb, moveOutsideServiceArea } from './helpers';

beforeEach(resetDb);

describe('donor registration', () => {
  it('refuses people under 18 and future dates of birth (age computed on the server)', async () => {
    const area = await place('Lakshmipur', 'Raipur');
    const base = (dob: string) =>
      registerDonor({
        account: { phone: nextPhone(), password: PASSWORD, displayName: 'Teen' },
        profile: { fullName: 'Teen', dateOfBirth: dob, bloodGroup: 'A+', ...area, locality: null, contactPhone: nextPhone(), preferredContactMethod: 'call' },
        consents: OPEN_CONSENTS,
        availableNow: false,
        lastDonation: null,
      });
    const fifteen = new Date();
    fifteen.setFullYear(fifteen.getFullYear() - 15);
    await expect(base(fifteen.toISOString().slice(0, 10))).rejects.toMatchObject({ fieldErrors: { dateOfBirth: 'tooYoung' } });
    await expect(base('2099-01-01')).rejects.toMatchObject({ fieldErrors: { dateOfBirth: 'futureDate' } });
  });

  it('refuses a district that is not in the chosen division and an upazila outside the district', async () => {
    const lakshmipur = await place('Lakshmipur', 'Raipur');
    const sylhet = await place('Sylhet');
    await expect(makeDonor({ profile: { divisionId: sylhet.divisionId } })).rejects.toMatchObject({ fieldErrors: { districtId: 'invalidLocation' } });
    const dhaka = await place('Dhaka');
    await expect(makeDonor({ profile: { ...lakshmipur, upazilaId: lakshmipur.upazilaId, districtId: dhaka.districtId, divisionId: dhaka.divisionId } })).rejects.toMatchObject({ fieldErrors: { upazilaId: 'invalidLocation' } });
  });

  it('stores the last donation as a self-reported record', async () => {
    const { donor } = await makeDonor({ lastDonation: { date: '2026-05-01', type: 'whole_blood' } });
    const rows = await db.execute<{ status: string; source: string }>(sql`select status, source from donations where donor_id = ${donor.id}`);
    expect(rows[0]).toMatchObject({ status: 'unverified', source: 'self_reported' });
  });
});

describe('donor search', () => {
  it('filters by blood group and location and only lists consenting, active donors', async () => {
    await makeDonor({ profile: { bloodGroup: 'O+' } });
    await makeDonor({ profile: { bloodGroup: 'B+' } });
    const old = await makeDonor({ profile: { bloodGroup: 'O+' } });
    await moveOutsideServiceArea('donor', old.donor.id, 'Dhaka', 'Savar'); // saved before the Lakshmipur-only rule
    await makeDonor({ profile: { bloodGroup: 'O+' }, consents: { listedInSearch: false } });
    const paused = await makeDonor({ profile: { bloodGroup: 'O+' } });
    await setDonorListingPaused(paused.actor, true);
    const area = await place('Lakshmipur', 'Raipur');
    const r = await searchDonors({ bloodGroup: 'O+', districtId: area.districtId }, null);
    expect(r.total).toBe(1);
    // The donor whose address is outside Lakshmipur is never listed.
    expect((await searchDonors({ bloodGroup: 'O+' }, null)).total).toBe(1);
    expect((await searchDonors({ upazilaId: area.upazilaId }, null)).total).toBe(2);
    expect((await searchDonors({ bloodGroup: 'AB-' }, null)).total).toBe(0);
  });

  it('lists only donors currently marked available; expired confirmations become unknown', async () => {
    const fresh = await makeDonor();
    const stale = await makeDonor();
    const notNow = await makeDonor();
    await setAvailability(notNow.actor, 'unavailable');
    await db.update(donorProfiles).set({ availabilityExpiresAt: sql`now() - interval '1 day'` }).where(eq(donorProfiles.id, stale.donor.id));
    const all = await searchDonors({}, null);
    expect(all.items.map((d) => d.publicId)).toEqual([fresh.donor.publicId]);
    expect((await getPublicDonorProfile(stale.donor.publicId, null))?.availability).toBe('unknown');
    expect((await getPublicDonorProfile(notNow.donor.publicId, null))?.availability).toBe('unavailable');
    await setAvailability(stale.actor, 'available');
    expect((await searchDonors({}, null)).total).toBe(2);
  });

  it('matches the locality filter for visitors', async () => {
    await makeDonor({ profile: { locality: 'Open Para' } });
    await makeDonor({ profile: { locality: 'Other Para' } });
    expect((await searchDonors({ locality: 'Open' }, null)).total).toBe(1);
  });

  it('paginates and reports totals', async () => {
    for (let i = 0; i < 22; i++) await makeDonor({ profile: { fullName: `Donor ${i}` } });
    const p1 = await searchDonors({ page: 1 }, null);
    const p2 = await searchDonors({ page: 2 }, null);
    expect(p1.total).toBe(22);
    expect(p1.items).toHaveLength(20);
    expect(p2.items).toHaveLength(2);
    expect(p1.pageCount).toBe(2);
  });
});

describe('public donor details', () => {
  it('shows visitors everything a listed donor shares, but never puts numbers in pages or search results', async () => {
    const { donor, phone } = await makeDonor({ profile: { fullName: 'Md. Rakib Hasan', locality: 'Open Para' } });
    const r = await searchDonors({}, null);
    expect(JSON.stringify(r)).not.toContain(phone);
    expect(r.items[0]).toMatchObject({ name: 'Md. Rakib Hasan', nameIsShortened: false, locality: 'Open Para' });
    expect(r.items[0].stats).not.toBeNull();
    const profile = await getPublicDonorProfile(donor.publicId, null);
    expect(profile).toMatchObject({ name: 'Md. Rakib Hasan', phoneAccess: 'reveal' });
    expect(JSON.stringify(profile)).not.toContain(phone);
  });

  it('lets a signed-in user reveal a number, and logs it without the number', async () => {
    const open = await makeDonor();
    const { actor: viewer } = await makeUser('Viewer');
    await expect(revealDonorPhone(viewer, open.donor.publicId)).resolves.toMatchObject({ phone: open.phone });
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'donor.phone_revealed'));
    expect(logs).toHaveLength(1);
    expect(JSON.stringify(logs[0])).not.toContain(open.phone);
  });

  it('hides unlisted profiles from everyone but the donor', async () => {
    const hidden = await makeDonor({ consents: { listedInSearch: false } });
    const { actor: viewer } = await makeUser();
    expect(await getPublicDonorProfile(hidden.donor.publicId, viewer)).toBeNull();
    expect(await getPublicDonorProfile(hidden.donor.publicId, hidden.actor)).not.toBeNull();
    await expect(revealDonorPhone(viewer, hidden.donor.publicId)).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('lets visitors reveal and call a donor, logged without the number', async () => {
    const d = await makeDonor();
    expect((await getPublicDonorProfile(d.donor.publicId, null))?.phoneAccess).toBe('reveal');
    expect(JSON.stringify(await searchDonors({}, null))).not.toContain(d.phone);
    await expect(revealDonorPhone(null, d.donor.publicId, { ipHash: 'visitor-hash' })).resolves.toMatchObject({ phone: d.phone });
    const [log] = await db.select().from(auditLogs).where(eq(auditLogs.action, 'donor.phone_revealed'));
    expect(log).toMatchObject({ actorUserId: null, ipHash: 'visitor-hash', targetId: d.donor.id });
    expect(JSON.stringify(log.metadata)).not.toContain(d.phone);
  });

  it('migration 0006 makes old choices public, and existing donors are told once', async () => {
    const d = await makeDonor();
    // Choices saved before the change, as they were in the database.
    const old = { nameVisibility: 'signed_in', phoneVisibility: 'private', localityVisibility: 'private', donationHistoryVisibility: 'private', communityVisibility: 'coordinators' } as const;
    await db.update(donorConsents).set(old).where(eq(donorConsents.donorId, d.donor.id));
    await expect(revealDonorPhone(null, d.donor.publicId)).rejects.toMatchObject({ code: 'forbidden' });
    expect(await publicDetailsSince()).toBeNull();
    const statements = readFileSync('drizzle/0006_everything_public.sql', 'utf8').split('--> statement-breakpoint');
    for (const statement of statements.slice(4)) await db.execute(sql.raw(statement));
    const since = await publicDetailsSince();
    expect(since).toBeInstanceOf(Date);
    const consent = async () => (await db.select().from(donorConsents).where(eq(donorConsents.donorId, d.donor.id)))[0];
    expect(await consent()).toMatchObject({ nameVisibility: 'public', phoneVisibility: 'public', localityVisibility: 'public', donationHistoryVisibility: 'public', communityVisibility: 'public' });
    await expect(revealDonorPhone(null, d.donor.publicId)).resolves.toMatchObject({ phone: d.phone });
    // The dashboard notice shows until the donor acknowledges it.
    expect((await consent()).consentedAt.getTime()).toBeLessThan(since!.getTime());
    await acknowledgePublicDetails(d.actor);
    expect((await consent()).consentedAt.getTime()).toBeGreaterThanOrEqual(since!.getTime());
  });

  it('keeps details public when a donor saves their choices', async () => {
    const d = await makeDonor();
    await db.update(donorConsents).set({ phoneVisibility: 'private' }).where(eq(donorConsents.donorId, d.donor.id));
    await updateConsents(d.actor, { ...OPEN_CONSENTS, allowContactRequests: false });
    const [c] = await db.select().from(donorConsents).where(eq(donorConsents.donorId, d.donor.id));
    expect(c).toMatchObject({ phoneVisibility: 'public', allowContactRequests: false });
  });
});

describe('profile updates', () => {
  it('resets verification when identity details change', async () => {
    const d = await makeDonor();
    await db.update(donorProfiles).set({ verificationStatus: 'verified' }).where(eq(donorProfiles.id, d.donor.id));
    const area = await place('Lakshmipur', 'Raipur');
    const res = await updateDonorProfile(d.actor, { fullName: 'Rakib Hasan', dateOfBirth: '1995-04-12', bloodGroup: 'A+', ...area, locality: null, contactPhone: d.phone, preferredContactMethod: 'sms' });
    expect(res.verificationReset).toBe(true);
    const [row] = await db.select().from(donorProfiles).where(eq(donorProfiles.id, d.donor.id));
    expect(row.verificationStatus).toBe('unverified');
    expect(await db.select().from(verificationEvents)).toHaveLength(1);
  });

  it('only lets donors edit their own profile', async () => {
    const { actor } = await makeUser();
    const area = await place('Lakshmipur', 'Raipur');
    await expect(updateDonorProfile(actor, { fullName: 'X', dateOfBirth: '1990-01-01', bloodGroup: 'A+', ...area, locality: null, contactPhone: nextPhone(), preferredContactMethod: 'call' })).rejects.toMatchObject({ messageKey: 'donor_profile_required' });
  });
});
