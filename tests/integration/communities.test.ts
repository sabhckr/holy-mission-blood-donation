import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/server/db/client';
import { auditLogs } from '@/server/db/schema';
import {
  applyToJoin,
  changeMemberRole,
  findDonorsForCommunity,
  getCommunityContext,
  getMembership,
  leaveCommunity,
  listMembers,
  removeMember,
  revealDonorPhoneForCommunity,
  reviewCommunity,
  reviewMembership,
} from '@/server/services/communities';
import { makeAdmin, makeCommunity, makeDonor, makeUser, moveOutsideServiceArea, resetDb } from './helpers';

beforeEach(resetDb);

describe('community lifecycle', () => {
  it('starts pending with the creator as leader; only admins approve', async () => {
    const { actor: admin } = await makeAdmin();
    const leader = await makeUser('Leader');
    const c = await makeCommunity(leader.actor, admin, { approve: false });
    const ctx = await getCommunityContext(leader.actor, { id: c.id });
    expect(ctx?.community.status).toBe('pending');
    expect([...ctx!.caps].sort()).toEqual(['edit_profile', 'view_dashboard']);
    await expect(findDonorsForCommunity(leader.actor, c.id, {})).rejects.toMatchObject({ code: 'forbidden' });
    await expect(reviewCommunity(leader.actor, c.id, 'approved', null)).rejects.toMatchObject({ code: 'forbidden' });
    await reviewCommunity(admin, c.id, 'approved', null);
    expect((await getCommunityContext(leader.actor, { id: c.id }))!.caps.has('find_donors')).toBe(true);
    await reviewCommunity(admin, c.id, 'suspended', 'complaints');
    expect((await getCommunityContext(leader.actor, { id: c.id }))!.caps.size).toBe(0);
  });

  it('membership: apply, approve, roles, and the last-leader rule', async () => {
    const { actor: admin } = await makeAdmin();
    const leader = await makeUser('Leader');
    const c = await makeCommunity(leader.actor, admin);
    const member = await makeUser('Member');
    await applyToJoin(member.actor, c.id);
    await expect(applyToJoin(member.actor, c.id)).rejects.toMatchObject({ messageKey: 'already_member' });
    const m = await getMembership(c.id, member.user.id);
    // a pending applicant cannot approve themself
    await expect(reviewMembership(member.actor, m!.id, 'active')).rejects.toMatchObject({ code: 'forbidden' });
    await reviewMembership(leader.actor, m!.id, 'active');
    await changeMemberRole(leader.actor, m!.id, 'coordinator');
    // coordinators cannot change roles or remove other coordinators/leaders
    const leaderMembership = await getMembership(c.id, leader.user.id);
    await expect(changeMemberRole(member.actor, leaderMembership!.id, 'member')).rejects.toMatchObject({ code: 'forbidden' });
    await expect(removeMember(member.actor, leaderMembership!.id)).rejects.toMatchObject({ code: 'forbidden' });
    // the only leader cannot leave or be demoted
    await expect(leaveCommunity(leader.actor, c.id)).rejects.toMatchObject({ messageKey: 'last_leader' });
    await expect(changeMemberRole(admin, leaderMembership!.id, 'member')).rejects.toMatchObject({ messageKey: 'last_leader' });
  });

  it('leaders only manage their own community', async () => {
    const { actor: admin } = await makeAdmin();
    const a = await makeUser('Leader A');
    const b = await makeUser('Leader B');
    const ca = await makeCommunity(a.actor, admin);
    const cb = await makeCommunity(b.actor, admin);
    const member = await makeUser('Member');
    await applyToJoin(member.actor, cb.id);
    const m = await getMembership(cb.id, member.user.id);
    await expect(reviewMembership(a.actor, m!.id, 'active')).rejects.toMatchObject({ code: 'forbidden' });
    await expect(listMembers(a.actor, cb.id)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(findDonorsForCommunity(a.actor, cb.id, {})).rejects.toMatchObject({ code: 'forbidden' });
    expect(await listMembers(a.actor, ca.id)).toHaveLength(1);
  });
});

describe('donor finder', () => {
  it('returns only consenting donors inside the service area, members or not', async () => {
    const { actor: admin } = await makeAdmin();
    const leader = await makeUser('Leader');
    const c = await makeCommunity(leader.actor, admin, { areaUpazilas: ['Raipur'] });
    const inArea = await makeDonor({ upazila: 'Raipur' });
    await makeDonor({ upazila: 'Ramganj' }); // same district, outside the service area
    await makeDonor({ upazila: 'Raipur', consents: { allowCoordinatorContact: false } });
    await moveOutsideServiceArea('donor', (await makeDonor()).donor.id, 'Dhaka', 'Savar'); // saved before the Lakshmipur-only rule
    const r = await findDonorsForCommunity(leader.actor, c.id, {});
    expect(r.items.map((d) => d.publicId)).toEqual([inArea.donor.publicId]);
    expect(r.items[0].name).toBe('Rakib Hasan');
  });

  it('logs coordinator phone reveals and refuses donors outside the area', async () => {
    const { actor: admin } = await makeAdmin();
    const leader = await makeUser('Leader');
    const c = await makeCommunity(leader.actor, admin, { areaUpazilas: ['Raipur'] });
    const inArea = await makeDonor({ upazila: 'Raipur' });
    const outside = await makeDonor({ upazila: 'Ramganj' });
    await expect(revealDonorPhoneForCommunity(leader.actor, c.id, inArea.donor.publicId)).resolves.toMatchObject({ phone: inArea.phone });
    await expect(revealDonorPhoneForCommunity(leader.actor, c.id, outside.donor.publicId)).rejects.toMatchObject({ code: 'not_found' });
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'donor.phone_revealed'));
    expect(logs).toHaveLength(1);
    expect(logs[0].communityId).toBe(c.id);
  });

  it('lets several communities reach the same donor', async () => {
    const { actor: admin } = await makeAdmin();
    const a = await makeUser('A');
    const b = await makeUser('B');
    const ca = await makeCommunity(a.actor, admin);
    const cb = await makeCommunity(b.actor, admin);
    const donor = await makeDonor();
    expect((await findDonorsForCommunity(a.actor, ca.id, {})).items.map((d) => d.publicId)).toContain(donor.donor.publicId);
    expect((await findDonorsForCommunity(b.actor, cb.id, {})).items.map((d) => d.publicId)).toContain(donor.donor.publicId);
  });
});
