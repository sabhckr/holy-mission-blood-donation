import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/server/db/client';
import { donationEvents, donations, notifications } from '@/server/db/schema';
import { applyToJoin, getMembership, leaveCommunity, reviewMembership } from '@/server/services/communities';
import { addOwnDonation, correctDonation, donationTrail, recordDonationForMember, reviewDonation, submitDonationForReview, voidDonation } from '@/server/services/donations';
import { makeAdmin, makeCommunity, makeDonor, makeUser, resetDb } from './helpers';

beforeEach(resetDb);

async function setup() {
  const { actor: admin } = await makeAdmin();
  const leader = await makeDonor({ profile: { fullName: 'Leader Donor' } });
  const community = await makeCommunity(leader.actor, admin);
  const donor = await makeDonor({ profile: { fullName: 'Member Donor' } });
  await applyToJoin(donor.actor, community.id);
  const m = await getMembership(community.id, donor.user.id);
  await reviewMembership(leader.actor, m!.id, 'active');
  return { admin, leader, community, donor };
}

const input = (date: string, type: 'whole_blood' | 'platelets' = 'whole_blood') => ({ donatedOn: date, donationType: type, place: 'Lakshmipur Sadar Hospital', note: null });

describe('donation records', () => {
  it('saves self-reported records and refuses future dates and duplicates', async () => {
    const d = await makeDonor();
    const rec = await addOwnDonation(d.actor, input('2026-01-10'), null);
    expect(rec).toMatchObject({ status: 'unverified', source: 'self_reported' });
    await expect(addOwnDonation(d.actor, input('2099-01-01'), null)).rejects.toMatchObject({ fieldErrors: { donatedOn: 'futureDate' } });
    await expect(addOwnDonation(d.actor, input('2026-01-10'), null)).rejects.toMatchObject({ fieldErrors: { donatedOn: 'duplicateDonation' } });
    // a different type on the same day is a different record
    await expect(addOwnDonation(d.actor, input('2026-01-10', 'platelets'), null)).resolves.toBeTruthy();
  });

  it('can only be submitted to a community the donor actively belongs to', async () => {
    const { community } = await setup();
    const outsider = await makeDonor();
    await expect(addOwnDonation(outsider.actor, input('2026-02-01'), community.id)).rejects.toMatchObject({ messageKey: 'not_member' });
  });

  it('is verified only by that community’s coordinators/leaders or admins — never by the donor', async () => {
    const { admin, leader, community, donor } = await setup();
    const rec = await addOwnDonation(donor.actor, input('2026-03-01'), community.id);
    expect(rec.status).toBe('pending');
    await expect(reviewDonation(donor.actor, rec.id, 'verified', null)).rejects.toMatchObject({ messageKey: 'self_verification' });
    const stranger = await makeUser();
    await expect(reviewDonation(stranger.actor, rec.id, 'verified', null)).rejects.toMatchObject({ code: 'forbidden' });
    // leader of a different community cannot verify
    const otherLeader = await makeDonor();
    await makeCommunity(otherLeader.actor, admin);
    await expect(reviewDonation(otherLeader.actor, rec.id, 'verified', null)).rejects.toMatchObject({ code: 'forbidden' });
    await reviewDonation(leader.actor, rec.id, 'verified', 'saw the donor card');
    const [row] = await db.select().from(donations).where(eq(donations.id, rec.id));
    expect(row).toMatchObject({ status: 'verified', verifiedByUserId: leader.user.id });
    expect(await db.select().from(notifications).where(eq(notifications.userId, donor.user.id))).toHaveLength(2); // membership approved + verified
    void admin;
  });

  it('stops verification after the donor leaves the community', async () => {
    const { leader, community, donor } = await setup();
    const rec = await addOwnDonation(donor.actor, input('2026-03-02'), community.id);
    await leaveCommunity(donor.actor, community.id);
    await expect(reviewDonation(leader.actor, rec.id, 'verified', null)).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('a leader cannot verify their own record even in their own community; an admin can', async () => {
    const { admin, leader, community } = await setup();
    const own = await addOwnDonation(leader.actor, input('2026-04-01'), community.id);
    await expect(reviewDonation(leader.actor, own.id, 'verified', null)).rejects.toMatchObject({ messageKey: 'self_verification' });
    await reviewDonation(admin, own.id, 'verified', null);
  });

  it('corrections void the original (kept in history) and create a new unverified record', async () => {
    const d = await makeDonor();
    const rec = await addOwnDonation(d.actor, input('2026-05-01'), null);
    const fixed = await correctDonation(d.actor, rec.id, input('2026-05-02'));
    const rows = await db.select().from(donations).where(eq(donations.donorId, d.donor.id));
    expect(rows.find((r) => r.id === rec.id)?.status).toBe('voided');
    expect(fixed).toMatchObject({ status: 'unverified', correctsDonationId: rec.id });
    const trail = await donationTrail(d.actor, rec.id);
    expect(trail.map((t) => t.event.action)).toEqual(['created', 'corrected']);
  });

  it('other users cannot see, void, correct or submit someone else’s record', async () => {
    const { community } = await setup();
    const d = await makeDonor();
    const rec = await addOwnDonation(d.actor, input('2026-05-05'), null);
    const other = await makeDonor();
    await expect(voidDonation(other.actor, rec.id, 'x')).rejects.toMatchObject({ code: 'not_found' });
    await expect(correctDonation(other.actor, rec.id, input('2026-05-06'))).rejects.toMatchObject({ code: 'not_found' });
    await expect(submitDonationForReview(other.actor, rec.id, community.id)).rejects.toMatchObject({ code: 'not_found' });
    await expect(donationTrail(other.actor, rec.id)).rejects.toMatchObject({ code: 'not_found' });
  });

  it('coordinators record witnessed donations as verified for members only', async () => {
    const { leader, community, donor } = await setup();
    const rec = await recordDonationForMember(leader.actor, community.id, donor.donor.id, input('2026-06-01'));
    expect(rec).toMatchObject({ status: 'verified', source: 'community' });
    const outsider = await makeDonor();
    await expect(recordDonationForMember(leader.actor, community.id, outsider.donor.id, input('2026-06-01'))).rejects.toMatchObject({ code: 'forbidden' });
    expect((await db.select().from(donationEvents)).length).toBeGreaterThan(0);
  });
});
