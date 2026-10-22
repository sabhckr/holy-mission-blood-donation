import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/server/db/client';
import { auditLogs, bloodRequests, donations, donorProfiles, users } from '@/server/db/schema';
import { DEFAULT_SETTINGS } from '@/server/domain/settings-defaults';
import { authenticate } from '@/server/services/accounts';
import { exportData, platformStats, searchUsers, setUserRole, setUserStatus } from '@/server/services/admin';
import { incomingContactRequests, outgoingContactRequests, respondToContactRequest, sendContactRequest } from '@/server/services/contact';
import { addOwnDonation } from '@/server/services/donations';
import { deactivateAccount, processDeletion, requestAccountDeletion } from '@/server/services/privacy';
import { createBloodRequest } from '@/server/services/requests';
import { getSettings, updateSettings } from '@/server/services/settings';
import { searchDonors } from '@/server/services/donors';
import { makeAdmin, makeDonor, makeUser, nextPhone, PASSWORD, place, resetDb } from './helpers';

beforeEach(resetDb);

describe('contact requests', () => {
  it('shares numbers only after the donor accepts', async () => {
    const donor = await makeDonor({ consents: { phoneVisibility: 'private' } });
    const seeker = await makeUser('Seeker');
    await expect(sendContactRequest(donor.actor, donor.donor.publicId, 'hello there friend', null)).rejects.toMatchObject({ messageKey: 'cannot_contact_self' });
    const cr = await sendContactRequest(seeker.actor, donor.donor.publicId, 'Need O+ at Raipur tonight', null);
    await expect(sendContactRequest(seeker.actor, donor.donor.publicId, 'again please help', null)).rejects.toMatchObject({ messageKey: 'contact_pending' });
    expect((await outgoingContactRequests(seeker.actor))[0].donorPhone).toBeNull();
    expect((await incomingContactRequests(donor.actor))[0].requesterPhone).toBeNull();
    const intruder = await makeDonor();
    await expect(respondToContactRequest(intruder.actor, cr.id, 'accepted')).rejects.toMatchObject({ code: 'not_found' });
    await respondToContactRequest(donor.actor, cr.id, 'accepted');
    expect((await outgoingContactRequests(seeker.actor))[0].donorPhone).toBe(donor.phone);
    expect((await incomingContactRequests(donor.actor))[0].requesterPhone).toBe(seeker.user.phone);
  });

  it('respects donors who do not accept contact requests', async () => {
    const donor = await makeDonor({ consents: { allowContactRequests: false } });
    const seeker = await makeUser();
    await expect(sendContactRequest(seeker.actor, donor.donor.publicId, 'Need blood urgently', null)).rejects.toMatchObject({ messageKey: 'contact_not_allowed' });
  });
});

describe('deactivation and deletion', () => {
  it('deactivation hides the donor from search and needs the password', async () => {
    const d = await makeDonor();
    await expect(deactivateAccount(d.actor, 'wrong-pass-1')).rejects.toMatchObject({ messageKey: 'reauth_failed' });
    await deactivateAccount(d.actor, PASSWORD);
    expect((await searchDonors({}, null)).total).toBe(0);
  });

  it('processing a deletion request erases personal data but keeps an anonymous tombstone', async () => {
    const { actor: admin } = await makeAdmin();
    const d = await makeDonor();
    await addOwnDonation(d.actor, { donatedOn: '2026-01-01', donationType: 'whole_blood', place: null, note: null }, null);
    const area = await place('Lakshmipur', 'Raipur');
    await createBloodRequest(d.actor, {
      bloodGroup: 'A+', units: 1, ...area, hospitalName: 'H', neededAt: new Date(Date.now() + 3600e3), urgency: 'normal',
      requesterName: 'Rakib', requesterPhone: d.phone, contactPreference: 'call', sharePhoneWithResponders: false, note: null, showOnPublicBoard: true, communityId: null,
    });
    await requestAccountDeletion(d.actor, PASSWORD, 'moving abroad');
    expect((await searchDonors({}, null)).total).toBe(0); // hidden immediately
    const [req] = await db.execute<{ id: string }>(sql`select id from deletion_requests`);
    await expect(processDeletion(d.actor, req.id)).rejects.toMatchObject({ code: 'forbidden' });
    await processDeletion(admin, req.id);
    const [u] = await db.select().from(users).where(eq(users.id, d.user.id));
    expect(u).toMatchObject({ status: 'deleted', email: null, displayName: '—' });
    expect(u.phone).not.toContain('171');
    expect(await db.select().from(donorProfiles)).toHaveLength(0);
    expect(await db.select().from(donations)).toHaveLength(0);
    const [br] = await db.select().from(bloodRequests);
    expect(br).toMatchObject({ requesterPhone: '—', status: 'cancelled', createdByUserId: null });
    await expect(authenticate(d.phone, PASSWORD)).rejects.toMatchObject({ messageKey: 'invalid_credentials' });
    const logs = await db.select().from(auditLogs);
    expect(JSON.stringify(logs)).not.toContain(d.phone);
  });
});

describe('administration', () => {
  it('admin functions refuse non-admins', async () => {
    const { actor } = await makeUser();
    await expect(platformStats(actor)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(searchUsers(actor, {})).rejects.toMatchObject({ code: 'forbidden' });
    await expect(updateSettings(actor, DEFAULT_SETTINGS)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(exportData(actor, 'donor_directory', PASSWORD)).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('keeps at least one active admin and requires re-authentication to grant admin', async () => {
    const { actor: admin, user } = await makeAdmin();
    const other = await makeUser();
    await expect(setUserRole(admin, user.id, 'user', PASSWORD)).rejects.toMatchObject({ messageKey: 'last_admin' });
    await expect(setUserRole(admin, other.user.id, 'admin', 'wrong-pass-1')).rejects.toMatchObject({ messageKey: 'reauth_failed' });
    await setUserRole(admin, other.user.id, 'admin', PASSWORD);
    await expect(setUserStatus(admin, admin.userId, 'suspended', null)).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('validates configurable settings ranges and logs changes', async () => {
    const { actor: admin } = await makeAdmin();
    await expect(updateSettings(admin, { ...DEFAULT_SETTINGS, availabilityExpiryDays: 2 })).rejects.toMatchObject({ code: 'validation' });
    await updateSettings(admin, { ...DEFAULT_SETTINGS, availabilityExpiryDays: 45, eligibilityIntervals: { ...DEFAULT_SETTINGS.eligibilityIntervals, whole_blood: 112 } });
    expect(await getSettings()).toMatchObject({ availabilityExpiryDays: 45, eligibilityIntervals: { whole_blood: 112 } });
    expect(await db.select().from(auditLogs).where(eq(auditLogs.action, 'settings.updated'))).toHaveLength(1);
  });

  it('exports need the password, contain no phone numbers, and are logged', async () => {
    const { actor: admin } = await makeAdmin();
    const d = await makeDonor();
    await expect(exportData(admin, 'donor_directory', 'nope-nope-1')).rejects.toMatchObject({ messageKey: 'reauth_failed' });
    const out = await exportData(admin, 'donor_directory', PASSWORD);
    expect(out.rows).toBe(1);
    expect(out.csv).toContain(d.donor.publicId);
    expect(out.csv).not.toContain(d.phone.slice(-8));
    expect(out.csv).not.toContain('1995-04-12');
    expect(await db.select().from(auditLogs).where(eq(auditLogs.action, 'admin.export'))).toHaveLength(1);
  });

  it('stats keep verified and self-reported records apart', async () => {
    const { actor: admin } = await makeAdmin();
    const d = await makeDonor();
    await addOwnDonation(d.actor, { donatedOn: '2026-01-01', donationType: 'whole_blood', place: null, note: null }, null);
    const s = await platformStats(admin);
    expect(s.records).toMatchObject({ verified: 0, selfReported: 1 });
    expect(s.donors).toMatchObject({ listed: 1, availableNow: 1, verified: 0 });
    void nextPhone;
  });
});
