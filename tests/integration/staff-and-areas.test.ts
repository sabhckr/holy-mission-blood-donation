import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/server/db/client';
import { auditLogs, availabilityUpdates, communities, donorProfiles, notifications, operatingAreas, users } from '@/server/db/schema';
import { authenticate } from '@/server/services/accounts';
import { exportData, platformStats, setUserRole } from '@/server/services/admin';
import { registerCommunity, reviewCommunity, setCommunityAffiliation, publicCommunity } from '@/server/services/communities';
import { sendContactRequest } from '@/server/services/contact';
import {
  getDonorForStaff,
  listDonorsForStaff,
  reviewDonorRegistration,
  staffCreateDonor,
  staffDonorStats,
  staffSetAvailability,
  staffSetListingStatus,
  staffUpdateDonor,
} from '@/server/services/donor-admin';
import { getPublicDonorProfile, searchDonors, setAvailability, setDonorListingPaused, updateDonorProfile } from '@/server/services/donors';
import { addOperatingArea, listOperatingAreas, seedInitialOperatingArea, setOperatingAreaActive } from '@/server/services/operating-areas';
import { DEFAULT_SETTINGS } from '@/server/domain/settings-defaults';
import { updateSettings } from '@/server/services/settings';
import { makeAdmin, makeDonor, makeModerator, makeUser, nextPhone, OPEN_CONSENTS, PASSWORD, place, resetDb } from './helpers';

beforeEach(resetDb);

const profileOf = async (d: Awaited<ReturnType<typeof makeDonor>>, over: Record<string, unknown> = {}) => {
  const area = await place('Lakshmipur', 'Raipur');
  return { fullName: 'Rakib Hasan', dateOfBirth: '1995-04-12', bloodGroup: 'O+' as const, ...area, locality: 'Haydarganj', contactPhone: d.phone, preferredContactMethod: 'call' as const, ...over };
};

describe('registration review', () => {
  it('keeps new registrations private until staff approve them', async () => {
    const d = await makeDonor({ pending: true });
    const { actor: viewer } = await makeUser('Viewer');
    expect((await searchDonors({}, null)).total).toBe(0);
    expect(await getPublicDonorProfile(d.donor.publicId, viewer)).toBeNull();
    expect(await getPublicDonorProfile(d.donor.publicId, d.actor)).not.toBeNull(); // the donor sees their own profile
    await expect(sendContactRequest(viewer, d.donor.publicId, 'Need blood urgently please', null)).rejects.toMatchObject({ code: 'not_found' });
    const { actor: mod } = await makeModerator();
    await reviewDonorRegistration(mod, d.donor.id, 'approved', null);
    expect((await searchDonors({}, null)).total).toBe(1);
    const notes = await db.select().from(notifications).where(eq(notifications.userId, d.user.id));
    expect(notes.map((n) => n.kind)).toContain('registration_approved');
  });

  it('requires a reason to reject, and a corrected profile goes back to review', async () => {
    const d = await makeDonor({ pending: true });
    const { actor: admin } = await makeAdmin();
    await expect(reviewDonorRegistration(admin, d.donor.id, 'rejected', '')).rejects.toMatchObject({ fieldErrors: { reason: 'required' } });
    await reviewDonorRegistration(admin, d.donor.id, 'rejected', 'Phone number did not answer');
    const res = await updateDonorProfile(d.actor, await profileOf(d, { locality: 'Raipur Bazar' }));
    expect(res.resubmitted).toBe(true);
    const [row] = await db.select().from(donorProfiles).where(eq(donorProfiles.id, d.donor.id));
    expect(row.registrationStatus).toBe('pending');
  });

  it('staff cannot review their own registration and ordinary users cannot review at all', async () => {
    const { actor: admin, user } = await makeAdmin();
    const own = await makeDonor({ pending: true });
    await db.update(donorProfiles).set({ userId: user.id }).where(eq(donorProfiles.id, own.donor.id));
    await expect(reviewDonorRegistration(admin, own.donor.id, 'approved', null)).rejects.toMatchObject({ messageKey: 'self_verification' });
    const other = await makeDonor({ pending: true });
    const { actor: plain } = await makeUser();
    await expect(reviewDonorRegistration(plain, other.donor.id, 'approved', null)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(listDonorsForStaff(plain, {})).rejects.toMatchObject({ code: 'forbidden' });
  });
});

describe('availability overrides', () => {
  it('records actor, previous value and reason, labels it as staff-set, and notifies the donor', async () => {
    const d = await makeDonor();
    const { actor: mod, user: modUser } = await makeModerator();
    await expect(staffSetAvailability(mod, d.donor.id, 'unavailable', ' ', 'Not available now')).rejects.toMatchObject({ fieldErrors: { reason: 'required' } });
    await staffSetAvailability(mod, d.donor.id, 'unavailable', 'Donor said on the phone they are travelling', 'Not available now');
    const [h] = await db.select().from(availabilityUpdates).where(and(eq(availabilityUpdates.donorId, d.donor.id), eq(availabilityUpdates.source, 'staff')));
    expect(h).toMatchObject({ status: 'unavailable', previousStatus: 'available', setByUserId: modUser.id, reason: 'Donor said on the phone they are travelling' });
    const pub = await getPublicDonorProfile(d.donor.publicId, null);
    expect(pub).toMatchObject({ availability: 'unavailable', availabilitySource: 'staff' });
    expect((await db.select().from(notifications).where(eq(notifications.userId, d.user.id))).map((n) => n.kind)).toContain('availability_changed_by_staff');
    // 'unknown' clears the current value; the donor's own statement takes over again afterwards.
    await staffSetAvailability(mod, d.donor.id, 'unknown', 'No answer for two months', 'Unknown');
    expect((await getPublicDonorProfile(d.donor.publicId, null))?.availability).toBe('unknown');
    await setAvailability(d.actor, 'available');
    expect(await getPublicDonorProfile(d.donor.publicId, null)).toMatchObject({ availability: 'available', availabilitySource: 'donor' });
  });
});

describe('listing status and record management', () => {
  it('deactivate, remove and restore; donors cannot undo staff decisions', async () => {
    const d = await makeDonor();
    const { actor: admin } = await makeAdmin();
    await staffSetListingStatus(admin, d.donor.id, 'restricted', 'Reported wrong number', 'Deactivated');
    expect((await searchDonors({}, null)).total).toBe(0);
    await expect(setDonorListingPaused(d.actor, false)).rejects.toMatchObject({ code: 'forbidden' });
    await staffSetListingStatus(admin, d.donor.id, 'removed', 'Duplicate of another profile', 'Removed');
    await expect(setAvailability(d.actor, 'available')).rejects.toMatchObject({ code: 'forbidden' });
    expect(await getPublicDonorProfile(d.donor.publicId, null)).toBeNull();
    await staffSetListingStatus(admin, d.donor.id, 'active', 'Confirmed not a duplicate', 'Listed');
    expect((await searchDonors({}, null)).total).toBe(1);
    const actions = (await db.select().from(auditLogs).where(eq(auditLogs.targetId, d.donor.id))).map((l) => l.action);
    expect(actions).toEqual(expect.arrayContaining(['staff.donor_deactivated', 'staff.donor_removed', 'staff.donor_restored']));
  });

  it('staff corrections need a reason and reset verification when identity changes', async () => {
    const d = await makeDonor();
    await db.update(donorProfiles).set({ verificationStatus: 'verified' }).where(eq(donorProfiles.id, d.donor.id));
    const { actor: mod } = await makeModerator();
    await expect(staffUpdateDonor(mod, d.donor.id, await profileOf(d, { bloodGroup: 'A+' }), '')).rejects.toMatchObject({ fieldErrors: { reason: 'required' } });
    const res = await staffUpdateDonor(mod, d.donor.id, await profileOf(d, { bloodGroup: 'A+' }), 'Blood group card showed A+');
    expect(res.changed).toEqual(['bloodGroup']);
    const [row] = await db.select().from(donorProfiles).where(eq(donorProfiles.id, d.donor.id));
    expect(row).toMatchObject({ bloodGroup: 'A+', verificationStatus: 'unverified' });
    const detail = await getDonorForStaff(mod, d.donor.id);
    expect(detail.account?.phone).toBe(d.phone);
    expect(await db.select().from(auditLogs).where(eq(auditLogs.action, 'staff.donor_viewed'))).toHaveLength(1);
  });

  it('staff can add a donor on someone’s behalf only with confirmed consent; nobody can sign in to it yet', async () => {
    const { actor: admin } = await makeAdmin();
    const phone = nextPhone();
    const area = await place('Dhaka', 'Savar');
    const input = {
      phone,
      profile: { fullName: 'Nusrat Jahan', dateOfBirth: '1998-01-20', bloodGroup: 'B-' as const, ...area, locality: null, contactPhone: phone, preferredContactMethod: 'call' as const },
      consents: OPEN_CONSENTS,
      availableNow: true,
      consentConfirmed: false,
      note: 'Registered at the Savar blood camp',
    };
    await expect(staffCreateDonor(admin, input)).rejects.toMatchObject({ fieldErrors: { consentConfirmed: 'mustAccept' } });
    const { donor } = await staffCreateDonor(admin, { ...input, consentConfirmed: true });
    expect(donor.registrationStatus).toBe('approved');
    const found = await searchDonors({ bloodGroup: 'B-' }, null);
    expect(found.items[0]).toMatchObject({ publicId: donor.publicId, availabilitySource: 'staff' });
    await expect(authenticate(phone, PASSWORD)).rejects.toMatchObject({ messageKey: 'invalid_credentials' });
    await expect(staffCreateDonor(admin, { ...input, consentConfirmed: true })).rejects.toMatchObject({ fieldErrors: { phone: 'phoneTaken' } });
  });

  it('reports real counts by registration, listing and availability', async () => {
    await makeDonor();
    await makeDonor({ pending: true });
    const notNow = await makeDonor();
    await setAvailability(notNow.actor, 'unavailable');
    const { actor: mod } = await makeModerator();
    const s = await staffDonorStats(mod);
    expect(s).toMatchObject({ total: 3, pending: 1, approved: 2, available: 1, unavailable: 1, unknown: 0 });
  });
});

describe('moderator permissions (least privilege)', () => {
  it('moderators cannot approve organisations, change settings, export, manage areas or roles', async () => {
    const { actor: mod } = await makeModerator();
    const { actor: admin } = await makeAdmin();
    const leader = await makeUser('Leader');
    const hq = await place('Chattogram');
    const c = await registerCommunity(leader.actor, {
      name: 'Chattogram Blood Friends', nameEn: null, kind: 'blood_organization', description: null, foundedYear: null,
      divisionId: hq.divisionId, districtId: hq.districtId, serviceAreaIds: [hq.districtId], publicPhone: null, publicEmail: null,
      facebookUrl: null, showPublicContact: false, coordinatorContactPreference: 'in_app',
      representativeName: 'Rahim Uddin', representativeRole: 'Secretary', representativePhone: nextPhone(), verificationInfo: null,
    });
    await expect(reviewCommunity(mod, c.id, 'approved', null)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(updateSettings(mod, DEFAULT_SETTINGS)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(exportData(mod, 'donor_directory', PASSWORD)).rejects.toMatchObject({ code: 'forbidden' });
    const dhaka = await place('Dhaka');
    await expect(addOperatingArea(mod, dhaka.districtId, null)).rejects.toMatchObject({ code: 'forbidden' });
    const target = await makeUser('Target');
    await expect(setUserRole(mod, target.user.id, 'moderator', PASSWORD)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(platformStats(mod)).resolves.toBeTruthy();
    // Admins can make someone a moderator (with their password).
    await setUserRole(admin, target.user.id, 'moderator', PASSWORD);
    const [u] = await db.select().from(users).where(eq(users.id, target.user.id));
    expect(u.role).toBe('moderator');
  });
});

describe('operating area vs nationwide membership', () => {
  it('starts with Lakshmipur as the only active operating area', async () => {
    const areas = await listOperatingAreas({ activeOnly: true });
    expect(areas.map((a) => a.nameEn)).toEqual(['Lakshmipur']);
  });

  it('accepts donors and organisations from outside Lakshmipur without making them official', async () => {
    const dhakaDonor = await makeDonor({ district: 'Dhaka', upazila: 'Savar', profile: { bloodGroup: 'AB+' } });
    expect((await searchDonors({ bloodGroup: 'AB+' }, null)).items.map((d) => d.publicId)).toEqual([dhakaDonor.donor.publicId]);
    const { actor: admin } = await makeAdmin();
    const leader = await makeUser('Leader');
    const hq = await place('Chattogram');
    const c = await registerCommunity(leader.actor, {
      name: 'Chattogram Blood Friends', nameEn: null, kind: 'blood_organization', description: null, foundedYear: null,
      divisionId: hq.divisionId, districtId: hq.districtId, serviceAreaIds: [hq.districtId], publicPhone: null, publicEmail: null,
      facebookUrl: null, showPublicContact: false, coordinatorContactPreference: 'in_app',
      representativeName: 'Rahim Uddin', representativeRole: 'Secretary', representativePhone: nextPhone(), verificationInfo: null,
    });
    await reviewCommunity(admin, c.id, 'approved', null);
    const [row] = await db.select().from(communities).where(eq(communities.id, c.id));
    expect(publicCommunity(row).affiliation).toBe('independent');
    expect((await listOperatingAreas({ activeOnly: true })).map((a) => a.nameEn)).toEqual(['Lakshmipur']);
    const { actor: mod } = await makeModerator();
    await expect(setCommunityAffiliation(mod, c.id, 'holy_mission', 'x')).rejects.toMatchObject({ code: 'forbidden' });
    await expect(setCommunityAffiliation(admin, c.id, 'holy_mission', '')).rejects.toMatchObject({ fieldErrors: { reason: 'required' } });
    await setCommunityAffiliation(admin, c.id, 'holy_mission', 'Board decision of 22 Oct');
    expect(await db.select().from(auditLogs).where(eq(auditLogs.action, 'community.affiliation_changed'))).toHaveLength(1);
  });

  it('admins add and deactivate areas with an audited reason; the seed never re-activates', async () => {
    const { actor: admin } = await makeAdmin();
    const feni = await place('Feni');
    const added = await addOperatingArea(admin, feni.districtId, 'Volunteers start in November');
    await expect(addOperatingArea(admin, feni.districtId, null)).rejects.toMatchObject({ messageKey: 'duplicate' });
    expect((await listOperatingAreas({ activeOnly: true })).map((a) => a.nameEn)).toEqual(['Feni', 'Lakshmipur']);
    const [lakshmipur] = await db.select().from(operatingAreas).where(eq(operatingAreas.isActive, true)).orderBy(operatingAreas.id).limit(1);
    await expect(setOperatingAreaActive(admin, lakshmipur.id, false, '')).rejects.toMatchObject({ fieldErrors: { reason: 'required' } });
    await setOperatingAreaActive(admin, lakshmipur.id, false, 'Temporarily paused');
    expect(await seedInitialOperatingArea()).toBe(false);
    expect((await listOperatingAreas({ activeOnly: true })).map((a) => a.nameEn)).toEqual(['Feni']);
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.targetType, 'location'));
    expect(logs.map((l) => l.action)).toEqual(expect.arrayContaining(['operating_area.added', 'operating_area.deactivated']));
    void added;
  });
});
