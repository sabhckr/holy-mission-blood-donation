import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/server/db/client';
import { bloodRequests } from '@/server/db/schema';
import { applyToJoin, getMembership, reviewMembership } from '@/server/services/communities';
import {
  assignRequest,
  changeRequestStatus,
  communityRequestQueue,
  createBloodRequest,
  escalateRequest,
  expireStale,
  getRequestForViewer,
  noDonorFallback,
  respondToRequest,
  setResponseStatus,
  type BloodRequestInput,
} from '@/server/services/requests';
import { makeAdmin, makeCommunity, makeDonor, makeUser, nextPhone, place, resetDb } from './helpers';

beforeEach(resetDb);

async function requestInput(over: Partial<BloodRequestInput> = {}): Promise<BloodRequestInput> {
  const area = await place('Lakshmipur', 'Raipur');
  return {
    bloodGroup: 'O+',
    units: 2,
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
    ...over,
  };
}

describe('blood requests', () => {
  it('anonymous requester gets a private link; the public never sees the requester phone', async () => {
    const input = await requestInput();
    const { request, manageToken } = await createBloodRequest(null, input);
    const pub = await getRequestForViewer(request.publicId, null);
    expect(pub?.request.requesterPhone).toBeNull();
    expect(pub?.request.requesterName).toBeNull();
    expect(JSON.stringify(pub)).not.toContain(input.requesterPhone);
    const own = await getRequestForViewer(request.publicId, null, manageToken);
    expect(own?.request.requesterPhone).toBe(input.requesterPhone);
    expect(own?.access.canManage).toBe(true);
    expect((await getRequestForViewer(request.publicId, null, 'wrong-token-wrong-token'))?.access.canManage).toBe(false);
  });

  it('refuses a duplicate open request from the same number for the same group, district and day', async () => {
    const input = await requestInput();
    await createBloodRequest(null, input);
    await expect(createBloodRequest(null, input)).rejects.toMatchObject({ messageKey: 'duplicate_request' });
  });

  it('validates time and quantity on the server', async () => {
    await expect(createBloodRequest(null, await requestInput({ neededAt: new Date(Date.now() - 2 * 86400 * 1000) }))).rejects.toMatchObject({ fieldErrors: { neededDate: 'pastDate' } });
    await expect(createBloodRequest(null, await requestInput({ units: 50 }))).rejects.toMatchObject({ fieldErrors: { units: 'outOfRange' } });
  });

  it('donor offers are not agreements; responders see the phone only when the requester allowed it', async () => {
    const hidden = await createBloodRequest(null, await requestInput());
    const shared = await createBloodRequest(null, await requestInput({ sharePhoneWithResponders: true }));
    const donor = await makeDonor();
    await respondToRequest(donor.actor, hidden.request.publicId, null);
    await respondToRequest(donor.actor, shared.request.publicId, 'I can come at 5pm');
    await expect(respondToRequest(donor.actor, shared.request.publicId, null)).rejects.toMatchObject({ messageKey: 'duplicate' });
    const a = await getRequestForViewer(hidden.request.publicId, donor.actor);
    const b = await getRequestForViewer(shared.request.publicId, donor.actor);
    expect(a?.request.requesterPhone).toBeNull();
    expect(b?.request.requesterPhone).not.toBeNull();
    expect(b?.counts).toEqual({ offered: 1, confirmed: 0 });
    const plain = await makeUser();
    await expect(respondToRequest(plain.actor, shared.request.publicId, null)).rejects.toMatchObject({ messageKey: 'donor_profile_required' });
    // the requester confirms after talking to the donor
    const view = await getRequestForViewer(shared.request.publicId, null, shared.manageToken);
    await setResponseStatus(null, shared.request.publicId, view!.responses[0].id, 'confirmed', shared.manageToken);
    expect((await getRequestForViewer(shared.request.publicId, null))?.counts).toEqual({ offered: 0, confirmed: 1 });
  });

  it('requesters can close their request but not run coordinator steps; closed requests stay closed', async () => {
    const { request, manageToken } = await createBloodRequest(null, await requestInput());
    await expect(changeRequestStatus(null, request.publicId, 'in_progress', null, manageToken)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(changeRequestStatus(null, request.publicId, 'fulfilled', null, null)).rejects.toMatchObject({ code: 'forbidden' });
    await changeRequestStatus(null, request.publicId, 'fulfilled', null, manageToken);
    await expect(changeRequestStatus(null, request.publicId, 'cancelled', null, manageToken)).rejects.toMatchObject({ code: 'invalid_state' });
  });

  it('coordinators take requests only inside their service area, then manage them', async () => {
    const { actor: admin } = await makeAdmin();
    const local = await makeUser('Local leader');
    const far = await makeUser('Far leader');
    const localC = await makeCommunity(local.actor, admin, { areaUpazilas: ['Raipur'] });
    const farC = await makeCommunity(far.actor, admin, { district: 'Sylhet' });
    const { request } = await createBloodRequest(null, await requestInput());
    expect((await communityRequestQueue(local.actor, localC.id, { scope: 'available' })).total).toBe(1);
    expect((await communityRequestQueue(far.actor, farC.id, { scope: 'available' })).total).toBe(0);
    await expect(assignRequest(far.actor, request.publicId, farC.id, null)).rejects.toMatchObject({ code: 'forbidden' });
    await assignRequest(local.actor, request.publicId, localC.id, null);
    const v = await getRequestForViewer(request.publicId, local.actor);
    expect(v?.request.status).toBe('in_progress');
    expect(v?.access.coordinatorOf).toEqual([localC.id]);
    expect(v?.request.requesterPhone).not.toBeNull();
    expect((await getRequestForViewer(request.publicId, far.actor))?.access.canManage).toBe(false);
  });

  it('escalation shares the request with another approved community', async () => {
    const { actor: admin } = await makeAdmin();
    const local = await makeUser('Local');
    const other = await makeUser('Other');
    const localC = await makeCommunity(local.actor, admin);
    const otherC = await makeCommunity(other.actor, admin, { district: 'Noakhali' });
    const coordinator = await makeUser('Coord');
    await applyToJoin(coordinator.actor, otherC.id);
    const m = await getMembership(otherC.id, coordinator.user.id);
    await reviewMembership(other.actor, m!.id, 'active');
    const { request } = await createBloodRequest(null, await requestInput({ communityId: localC.id }));
    await expect(escalateRequest(other.actor, request.publicId, otherC.id, null)).rejects.toMatchObject({ code: 'forbidden' });
    await escalateRequest(local.actor, request.publicId, otherC.id, 'no O+ donors here');
    await expect(escalateRequest(local.actor, request.publicId, otherC.id, null)).rejects.toMatchObject({ messageKey: 'duplicate' });
    expect((await getRequestForViewer(request.publicId, other.actor))?.access.coordinatorOf).toEqual([otherC.id]);
    // an ordinary member of the target community gets nothing
    expect((await getRequestForViewer(request.publicId, coordinator.actor))?.access.canManage).toBe(false);
    expect((await communityRequestQueue(other.actor, otherC.id, { scope: 'mine' })).total).toBe(1);
  });

  it('expires overdue requests', async () => {
    const { request } = await createBloodRequest(null, await requestInput());
    await db.update(bloodRequests).set({ expiresAt: sql`now() - interval '1 minute'` }).where(eq(bloodRequests.id, request.id));
    expect((await getRequestForViewer(request.publicId, null))?.request.status).toBe('expired');
    expect(await expireStale()).toMatchObject({ requests: 1 });
    const [row] = await db.select().from(bloodRequests).where(eq(bloodRequests.id, request.id));
    expect(row.status).toBe('expired');
  });

  it('no-donor fallback widens the area and lists serving communities', async () => {
    const { actor: admin } = await makeAdmin();
    const leader = await makeUser();
    await makeCommunity(leader.actor, admin, { name: 'Lakshmipur Blood Bond' });
    await makeDonor({ upazila: 'Ramganj', profile: { bloodGroup: 'AB-' } });
    await makeDonor({ district: 'Dhaka', upazila: 'Savar', profile: { bloodGroup: 'AB-' } });
    const area = await place('Lakshmipur', 'Raipur');
    const fb = await noDonorFallback({ bloodGroup: 'AB-', ...area });
    expect(fb.wider.map((w) => [w.level, w.total])).toEqual([
      ['upazila', 0],
      ['district', 1],
      ['division', 1],
      ['country', 2],
    ]);
    expect(fb.communities.map((c) => c.name)).toEqual(['Lakshmipur Blood Bond']);
  });
});
