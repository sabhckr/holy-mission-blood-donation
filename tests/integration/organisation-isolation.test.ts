import { beforeEach, describe, expect, it } from 'vitest';
import type { BloodRequestInput } from '@/server/services/requests';
import {
  applyToJoin,
  changeMemberRole,
  communityReport,
  findDonorsForCommunity,
  getCommunityContext,
  getMembership,
  getPublicCommunity,
  listCommunities,
  listMembers,
  registerCommunity,
  removeMember,
  revealDonorPhoneForCommunity,
  reviewCommunity,
  reviewMembership,
  updateCommunityProfile,
  type CommunityInput,
} from '@/server/services/communities';
import { assignRequest, changeRequestStatus, communityRequestQueue, createBloodRequest } from '@/server/services/requests';

import { makeAdmin, makeCommunity, makeDonor, makeUser, nextPhone, place, resetDb } from './helpers';

beforeEach(resetDb);

const PRIVATE_FIELDS = ['representativeName', 'representativeRole', 'representativePhone', 'verificationInfo'];

async function communityInput(over: Partial<CommunityInput> = {}): Promise<CommunityInput> {
  const hq = await place('Chattogram');
  return {
    name: 'Chattogram Blood Bank Volunteers',
    nameEn: null,
    kind: 'volunteer_group',
    description: null,
    foundedYear: null,
    divisionId: hq.divisionId,
    districtId: hq.districtId,
    serviceAreaIds: [hq.districtId],
    publicPhone: null,
    publicEmail: null,
    facebookUrl: null,
    showPublicContact: false,
    coordinatorContactPreference: 'in_app',
    representativeName: 'Nasima Akter',
    representativeRole: 'General secretary',
    representativePhone: '01711-000111',
    verificationInfo: 'Registered with the district social services office',
    ...over,
  };
}

async function requestInput(): Promise<BloodRequestInput> {
  const area = await place('Lakshmipur', 'Raipur');
  return {
    bloodGroup: 'O+',
    units: 1,
    ...area,
    hospitalName: 'Raipur Upazila Health Complex',
    neededAt: new Date(Date.now() + 6 * 3600 * 1000),
    urgency: 'urgent',
    requesterName: 'Karim',
    requesterPhone: nextPhone(),
    contactPreference: 'call',
    sharePhoneWithResponders: false,
    note: null,
    showOnPublicBoard: true,
    communityId: null,
  };
}

/** Two approved organisations serving the same district, each with its own leader. */
async function twoOrganisations() {
  const { actor: admin } = await makeAdmin();
  const a = await makeUser('Leader A');
  const b = await makeUser('Leader B');
  const ca = await makeCommunity(a.actor, admin, { name: 'Organisation A' });
  const cb = await makeCommunity(b.actor, admin, { name: 'Organisation B' });
  return { admin, a, b, ca, cb };
}

describe('organisation registration details', () => {
  it('requires a responsible representative with a valid mobile number', async () => {
    const user = await makeUser('Applicant');
    await expect(registerCommunity(user.actor, await communityInput({ representativeName: '', representativePhone: null }))).rejects.toMatchObject({
      fieldErrors: { representativeName: 'required', representativePhone: 'required' },
    });
    await expect(registerCommunity(user.actor, await communityInput({ representativePhone: '12345' }))).rejects.toMatchObject({
      fieldErrors: { representativePhone: 'invalidPhone' },
    });
  });

  it('stores representative details normalised, from any district, and starts pending and independent', async () => {
    const user = await makeUser('Applicant');
    const c = await registerCommunity(user.actor, await communityInput());
    expect(c.status).toBe('pending');
    expect(c.affiliation).toBe('independent');
    expect(c.representativePhone).toBe('+8801711000111');
    const ctx = await getCommunityContext(user.actor, { id: c.id });
    expect(ctx?.community.representativeName).toBe('Nasima Akter');
  });

  it('never exposes representative or verification details publicly', async () => {
    const { admin, ca } = await twoOrganisations();
    const visitor = await makeUser('Visitor');
    const page = await getPublicCommunity(ca.slug, visitor.actor);
    const anonymous = await getPublicCommunity(ca.slug, null);
    const list = await listCommunities({});
    for (const shown of [page!.community, anonymous!.community, ...list.items]) {
      for (const field of PRIVATE_FIELDS) expect(shown).not.toHaveProperty(field);
    }
    // A pending organisation is not public at all.
    const pending = await makeCommunity((await makeUser('New')).actor, admin, { approve: false });
    expect(await getPublicCommunity(pending.slug, visitor.actor)).toBeNull();
  });
});

describe('cross-organisation isolation', () => {
  it('a leader cannot edit, report on or manage members of another organisation', async () => {
    const { a, b, cb } = await twoOrganisations();
    await expect(updateCommunityProfile(a.actor, cb.id, await communityInput({ name: 'Hijacked' }))).rejects.toMatchObject({ code: 'forbidden' });
    await expect(communityReport(a.actor, cb.id)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(listMembers(a.actor, cb.id)).rejects.toMatchObject({ code: 'forbidden' });

    const member = await makeUser('Member of B');
    await applyToJoin(member.actor, cb.id);
    const pending = await getMembership(cb.id, member.user.id);
    await expect(reviewMembership(a.actor, pending!.id, 'active')).rejects.toMatchObject({ code: 'forbidden' });
    await reviewMembership(b.actor, pending!.id, 'active');
    await expect(changeMemberRole(a.actor, pending!.id, 'coordinator')).rejects.toMatchObject({ code: 'forbidden' });
    await expect(removeMember(a.actor, pending!.id)).rejects.toMatchObject({ code: 'forbidden' });
    expect((await getMembership(cb.id, member.user.id))?.status).toBe('active');

    // B's own leader still sees B's private details; A's leader does not get B's context.
    const ctxB = await getCommunityContext(b.actor, { id: cb.id });
    expect(ctxB?.community.representativeName).toBeTruthy();
    const ctxAonB = await getCommunityContext(a.actor, { id: cb.id });
    expect(ctxAonB?.caps.size ?? 0).toBe(0);
  });

  it('a leader cannot use another organisation’s donor finder or reveal numbers through it', async () => {
    const { a, b, cb } = await twoOrganisations();
    const donor = await makeDonor({ consents: { phoneVisibility: 'coordinators' } });
    await expect(findDonorsForCommunity(a.actor, cb.id, {})).rejects.toMatchObject({ code: 'forbidden' });
    await expect(revealDonorPhoneForCommunity(a.actor, cb.id, donor.donor.publicId)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(revealDonorPhoneForCommunity(b.actor, cb.id, donor.donor.publicId)).resolves.toMatchObject({ phone: donor.phone });
  });

  it('a request taken by one organisation stays out of the other’s queue and controls', async () => {
    const { a, b, ca, cb } = await twoOrganisations();
    const { request } = await createBloodRequest(null, await requestInput());
    await assignRequest(b.actor, request.publicId, cb.id, null);

    expect((await communityRequestQueue(b.actor, cb.id, { scope: 'mine' })).items.map((r) => r.publicId)).toEqual([request.publicId]);
    expect((await communityRequestQueue(a.actor, ca.id, { scope: 'mine' })).items).toHaveLength(0);
    expect((await communityRequestQueue(a.actor, ca.id, { scope: 'available' })).items).toHaveLength(0);
    await expect(communityRequestQueue(a.actor, cb.id, { scope: 'mine' })).rejects.toMatchObject({ code: 'forbidden' });
    await expect(assignRequest(a.actor, request.publicId, ca.id, null)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(assignRequest(a.actor, request.publicId, cb.id, a.user.id)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(changeRequestStatus(a.actor, request.publicId, 'fulfilled', null, null)).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('a suspended organisation loses every coordinator power at once', async () => {
    const { admin, b, cb } = await twoOrganisations();
    await reviewCommunity(admin, cb.id, 'suspended', 'Complaint under review');
    await expect(findDonorsForCommunity(b.actor, cb.id, {})).rejects.toMatchObject({ code: 'forbidden' });
    await expect(communityRequestQueue(b.actor, cb.id, { scope: 'mine' })).rejects.toMatchObject({ code: 'forbidden' });
    await expect(listMembers(b.actor, cb.id)).rejects.toMatchObject({ code: 'forbidden' });
    expect(await getPublicCommunity(cb.slug, null)).toBeNull();
  });
});
