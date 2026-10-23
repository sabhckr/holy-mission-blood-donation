import { readFileSync } from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/server/db/client';
import { auditLogs, donorConsents, donorProfiles, verificationEvents } from '@/server/db/schema';
import {
  allowPublicPhone,
  confirmPhoneChoice,
  publicPhoneChoiceSince,
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

  it('never matches a locality filter against a hidden locality', async () => {
    await makeDonor({ profile: { locality: 'Secret Para' }, consents: { localityVisibility: 'private' } });
    await makeDonor({ profile: { locality: 'Open Para' } });
    expect((await searchDonors({ locality: 'Secret' }, null)).total).toBe(0);
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

describe('consent-aware contact visibility', () => {
  it('hides phone numbers from anonymous visitors and never puts them in search results', async () => {
    const { donor, phone } = await makeDonor();
    const r = await searchDonors({}, null);
    expect(JSON.stringify(r)).not.toContain(phone);
    const profile = await getPublicDonorProfile(donor.publicId, null);
    expect(profile?.phoneAccess).toBe('sign_in_required');
    expect(JSON.stringify(profile)).not.toContain(phone);
  });

  it('lets a signed-in user reveal a number only with consent, and logs it without the number', async () => {
    const open = await makeDonor();
    const coordOnly = await makeDonor({ consents: { phoneVisibility: 'coordinators' } });
    const { actor: viewer } = await makeUser('Viewer');
    await expect(revealDonorPhone(viewer, open.donor.publicId)).resolves.toMatchObject({ phone: open.phone });
    await expect(revealDonorPhone(viewer, coordOnly.donor.publicId)).rejects.toMatchObject({ code: 'forbidden' });
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

  it('lets visitors reveal and call a donor who chose "everyone", logged without the number', async () => {
    const d = await makeDonor({ consents: { phoneVisibility: 'public' } });
    expect((await getPublicDonorProfile(d.donor.publicId, null))?.phoneAccess).toBe('reveal');
    expect(JSON.stringify(await searchDonors({}, null))).not.toContain(d.phone);
    await expect(revealDonorPhone(null, d.donor.publicId, { ipHash: 'visitor-hash' })).resolves.toMatchObject({ phone: d.phone });
    const [log] = await db.select().from(auditLogs).where(eq(auditLogs.action, 'donor.phone_revealed'));
    expect(log).toMatchObject({ actorUserId: null, ipHash: 'visitor-hash', targetId: d.donor.id });
    expect(JSON.stringify(log.metadata)).not.toContain(d.phone);
  });

  it('still needs sign-in for "signed-in only" donors, and never reveals "nobody" numbers', async () => {
    const signedInOnly = await makeDonor({ consents: { phoneVisibility: 'signed_in' } });
    const nobody = await makeDonor({ consents: { phoneVisibility: 'private' } });
    await expect(revealDonorPhone(null, signedInOnly.donor.publicId)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(revealDonorPhone(null, nobody.donor.publicId)).rejects.toMatchObject({ code: 'forbidden' });
    const { actor: viewer } = await makeUser();
    await expect(revealDonorPhone(viewer, signedInOnly.donor.publicId)).resolves.toMatchObject({ phone: signedInOnly.phone });
    await expect(revealDonorPhone(viewer, nobody.donor.publicId)).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('existing donors decide: allowing public changes the choice, keeping it only records a fresh consent', async () => {
    const yes = await makeDonor({ consents: { phoneVisibility: 'signed_in' } });
    const keep = await makeDonor({ consents: { phoneVisibility: 'coordinators' } });
    // Migration 0005 records when the choice arrived; both donors chose before that.
    expect(await publicPhoneChoiceSince()).toBeNull();
    await db.execute(sql.raw(readFileSync('drizzle/0005_phone_can_be_public.sql', 'utf8').split('--> statement-breakpoint')[1]));
    const since = await publicPhoneChoiceSince();
    expect(since).toBeInstanceOf(Date);
    expect(yes.donor.createdAt.getTime()).toBeLessThanOrEqual(since!.getTime());
    await allowPublicPhone(yes.actor);
    await confirmPhoneChoice(keep.actor);
    const consent = async (id: string) => (await db.select().from(donorConsents).where(eq(donorConsents.donorId, id)))[0];
    expect((await consent(yes.donor.id)).phoneVisibility).toBe('public');
    expect((await consent(keep.donor.id)).phoneVisibility).toBe('coordinators');
    // Answered either way, the dashboard stops asking.
    expect((await consent(yes.donor.id)).consentedAt.getTime()).toBeGreaterThanOrEqual(since!.getTime());
    expect((await consent(keep.donor.id)).consentedAt.getTime()).toBeGreaterThanOrEqual(since!.getTime());
    await expect(updateConsents(keep.actor, { ...OPEN_CONSENTS, phoneVisibility: 'public' })).resolves.toBeUndefined();
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
