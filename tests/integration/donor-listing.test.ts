import { readFileSync } from 'node:fs';
import { and, eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/server/db/client';
import { auditLogs, donorProfiles, notifications, users } from '@/server/db/schema';
import { promoteAdmins } from '@/server/services/admin-bootstrap';
import { getCommunityContext, listCommunities } from '@/server/services/communities';
import { createDonorProfile, searchDonors } from '@/server/services/donors';
import { makeAdmin, makeCommunity, makeDonor, makeUser, moveOutsideServiceArea, OPEN_CONSENTS, place, resetDb } from './helpers';

beforeEach(resetDb);

describe('donors are listed without staff approval', () => {
  it('puts a new donor in the list as soon as they register', async () => {
    const donor = await makeDonor({ profile: { bloodGroup: 'AB-' } });
    expect(donor.donor.registrationStatus).toBe('approved');
    expect((await searchDonors({ bloodGroup: 'AB-' }, null)).items.map((d) => d.publicId)).toEqual([donor.donor.publicId]);
    // Nobody is told "your registration was approved", because nobody had to approve it.
    expect(await db.select().from(notifications).where(and(eq(notifications.userId, donor.user.id), eq(notifications.kind, 'registration_approved')))).toHaveLength(0);
  });

  it('still respects the donor’s own choices: not listed, or not able to give now', async () => {
    await makeDonor({ profile: { bloodGroup: 'B-' }, consents: { listedInSearch: false } });
    await makeDonor({ profile: { bloodGroup: 'B-' }, availableNow: false });
    expect((await searchDonors({ bloodGroup: 'B-' }, null)).total).toBe(0);
  });

  it('lists a donor profile added to an existing account straight away', async () => {
    const { actor } = await makeUser('Later Donor');
    const area = await place('Lakshmipur', 'Ramganj');
    const donor = await createDonorProfile(
      actor,
      { fullName: 'Shirin Akter', dateOfBirth: '1997-03-02', bloodGroup: 'A-', ...area, locality: null, contactPhone: '+8801711000222', preferredContactMethod: 'call' },
      OPEN_CONSENTS,
      true,
    );
    expect(donor.registrationStatus).toBe('approved');
    expect((await searchDonors({ bloodGroup: 'A-' }, null)).total).toBe(1);
  });

  it('organisations still wait for an administrator', async () => {
    const { actor: admin } = await makeAdmin();
    const leader = await makeUser('Leader');
    const c = await makeCommunity(leader.actor, admin, { approve: false, name: 'Ramgati Blood Friends' });
    expect((await getCommunityContext(leader.actor, { id: c.id }))?.community.status).toBe('pending');
    expect((await listCommunities({})).items.map((x) => x.id)).not.toContain(c.id);
  });
});

describe('migration 0004: approve donors who were waiting', () => {
  it('approves pending donors in Lakshmipur only and leaves other decisions alone', async () => {
    const waiting = await makeDonor({ pending: true });
    const rejected = await makeDonor();
    await db.update(donorProfiles).set({ registrationStatus: 'rejected', registrationNote: 'Wrong number' }).where(eq(donorProfiles.id, rejected.donor.id));
    const outside = await makeDonor({ pending: true });
    await moveOutsideServiceArea('donor', outside.donor.id, 'Dhaka', 'Savar');

    await db.execute(sql.raw(readFileSync('drizzle/0004_auto_approve_donors.sql', 'utf8')));

    const status = async (id: string) => (await db.select().from(donorProfiles).where(eq(donorProfiles.id, id)))[0];
    expect(await status(waiting.donor.id)).toMatchObject({ registrationStatus: 'approved', registrationNote: 'Approved automatically: donors no longer need approval' });
    expect(await status(rejected.donor.id)).toMatchObject({ registrationStatus: 'rejected', registrationNote: 'Wrong number' });
    expect(await status(outside.donor.id)).toMatchObject({ registrationStatus: 'pending' });
  });
});

describe('ADMIN_PHONE on deploy', () => {
  it('makes existing active accounts admins, once, with an audit entry', async () => {
    const owner = await makeUser('Owner');
    const result = await promoteAdmins(`${owner.user.phone.replace('+88', '')}, 01000000000, not-a-number`);
    expect(result).toEqual({ promoted: 1, alreadyAdmin: 0, notFound: 0 });
    expect((await db.select().from(users).where(eq(users.id, owner.user.id)))[0].role).toBe('admin');
    expect(await promoteAdmins(owner.user.phone)).toEqual({ promoted: 0, alreadyAdmin: 1, notFound: 0 });
    const logs = await db.select().from(auditLogs).where(and(eq(auditLogs.action, 'admin.role_changed'), eq(auditLogs.targetId, owner.user.id)));
    expect(logs).toHaveLength(1);
  });

  it('never creates accounts and skips suspended ones', async () => {
    expect(await promoteAdmins('01712345670')).toEqual({ promoted: 0, alreadyAdmin: 0, notFound: 1 });
    const suspended = await makeUser('Suspended');
    await db.update(users).set({ status: 'suspended' }).where(eq(users.id, suspended.user.id));
    expect(await promoteAdmins(suspended.user.phone)).toEqual({ promoted: 0, alreadyAdmin: 0, notFound: 1 });
    expect(await promoteAdmins(undefined)).toEqual({ promoted: 0, alreadyAdmin: 0, notFound: 0 });
  });
});
