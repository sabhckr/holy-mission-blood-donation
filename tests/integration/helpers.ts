import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { bloodRequests, communities, donorProfiles, locations, users } from '@/server/db/schema';
import type { Actor } from '@/server/policy';
import { registerAccount, toActor } from '@/server/services/accounts';
import { approveForTests } from './approve';
import { registerCommunity, type CommunityInput } from '@/server/services/communities';
import { registerDonor, type ConsentInput, type DonorProfileInput } from '@/server/services/donors';

export const PASSWORD = 'Rokto2026test';

/** Empties every table except the seeded locations, then restores the initial operating area. */
export async function resetDb() {
  await db.execute(sql`truncate table users, communities, settings, rate_limits, audit_logs, reports, operating_areas restart identity cascade`);
  const { seedInitialOperatingArea } = await import('@/server/services/operating-areas');
  await seedInitialOperatingArea();
}

let phoneCounter = 0;
export function nextPhone(): string {
  phoneCounter += 1;
  return `+880171${String(9000000 + phoneCounter).padStart(7, '0')}`.slice(0, 14);
}

export async function place(districtEn: string, upazilaEn?: string) {
  const [district] = await db.select().from(locations).where(and(eq(locations.level, 'district'), eq(locations.nameEn, districtEn)));
  if (!district) throw new Error(`district ${districtEn} not seeded`);
  let upazilaId: number | null = null;
  if (upazilaEn) {
    const [u] = await db.select().from(locations).where(and(eq(locations.parentId, district.id), eq(locations.nameEn, upazilaEn)));
    if (!u) throw new Error(`upazila ${upazilaEn} not seeded`);
    upazilaId = u.id;
  }
  return { divisionId: district.parentId!, districtId: district.id, upazilaId };
}

/**
 * Moves a saved record's address outside Lakshmipur directly in the database — what records saved
 * before the Lakshmipur-only rule look like. The services themselves refuse such addresses.
 */
export async function moveOutsideServiceArea(table: 'donor' | 'request' | 'community', id: string, districtEn = 'Dhaka', upazilaEn?: string) {
  const area = await place(districtEn, upazilaEn);
  if (table === 'donor') await db.update(donorProfiles).set(area).where(eq(donorProfiles.id, id));
  else if (table === 'request') await db.update(bloodRequests).set(area).where(eq(bloodRequests.id, id));
  else await db.update(communities).set({ divisionId: area.divisionId, districtId: area.districtId }).where(eq(communities.id, id));
}

export const OPEN_CONSENTS: ConsentInput = {
  listedInSearch: true,
  allowCoordinatorContact: true,
  allowContactRequests: true,
};

export async function makeDonor(
  overrides: {
    profile?: Partial<DonorProfileInput>;
    consents?: Partial<ConsentInput>;
    availableNow?: boolean;
    district?: string;
    upazila?: string;
    lastDonation?: { date: string; type: 'whole_blood' | 'platelets' | 'plasma' | 'double_red_cells' } | null;
    /** Put the registration back to pending review, as after staff send it back (new donors are approved straight away). */
    pending?: boolean;
  } = {},
) {
  const phone = nextPhone();
  const area = await place(overrides.district ?? 'Lakshmipur', overrides.upazila ?? 'Raipur');
  const { user, donor } = await registerDonor({
    account: { phone, password: PASSWORD, displayName: overrides.profile?.fullName ?? 'Rakib Hasan' },
    profile: {
      fullName: 'Rakib Hasan',
      dateOfBirth: '1995-04-12',
      bloodGroup: 'O+',
      ...area,
      locality: 'Haydarganj',
      contactPhone: phone,
      preferredContactMethod: 'call',
      ...overrides.profile,
    },
    consents: { ...OPEN_CONSENTS, ...overrides.consents },
    availableNow: overrides.availableNow ?? true,
    lastDonation: overrides.lastDonation ?? null,
  });
  if (overrides.pending) await db.update(donorProfiles).set({ registrationStatus: 'pending', registrationReviewedAt: null }).where(eq(donorProfiles.id, donor.id));
  const actor: Actor = toActor(user, donor.id);
  return { user, donor, actor, phone };
}

export async function makeUser(name = 'Plain User') {
  const user = await registerAccount({ phone: nextPhone(), password: PASSWORD, displayName: name });
  return { user, actor: toActor(user, null) };
}

export async function makeModerator() {
  const { user } = await makeUser('Moderator Person');
  await db.update(users).set({ role: 'moderator' }).where(eq(users.id, user.id));
  return { user, actor: { ...toActor(user, null), role: 'moderator' as const } };
}

export async function makeAdmin() {
  const { user } = await makeUser('Admin Person');
  await db.update(users).set({ role: 'admin' }).where(eq(users.id, user.id));
  return { user, actor: { ...toActor(user, null), role: 'admin' as const } };
}

export async function makeCommunity(leader: Actor, admin: Actor, opts: { name?: string; district?: string; areaUpazilas?: string[]; approve?: boolean } = {}) {
  const district = opts.district ?? 'Lakshmipur';
  const hq = await place(district);
  const areaIds = opts.areaUpazilas?.length
    ? await Promise.all(opts.areaUpazilas.map(async (u) => (await place(district, u)).upazilaId!))
    : [hq.districtId];
  const input: CommunityInput = {
    name: opts.name ?? `Raipur Blood Club ${Math.random().toString(36).slice(2, 7)}`,
    nameEn: null,
    kind: 'blood_organization',
    description: null,
    foundedYear: 2015,
    divisionId: hq.divisionId,
    districtId: hq.districtId,
    serviceAreaIds: areaIds,
    publicPhone: null,
    publicEmail: null,
    facebookUrl: null,
    showPublicContact: false,
    coordinatorContactPreference: 'in_app',
    representativeName: 'Abdul Karim',
    representativeRole: 'President',
    representativePhone: nextPhone(),
    verificationInfo: 'Registered with the upazila social services office',
  };
  const community = await registerCommunity(leader, input);
  if (opts.approve !== false) await approveForTests(admin, community.id);
  return community;
}
