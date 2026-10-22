import { describe, expect, it } from 'vitest';
import {
  canChangeMemberRole,
  canRemoveMember,
  canSee,
  canVerifyRecord,
  communityCapabilities,
  publicViewerLevel,
  type Actor,
  type CommunityCapability,
} from '@/server/policy';

const user = (over: Partial<Actor> = {}): Actor => ({ userId: 'u1', role: 'user', status: 'active', displayName: 'U', donorId: null, ...over });
const admin = user({ userId: 'admin', role: 'admin' });

describe('visibility matrix', () => {
  const matrix: [Parameters<typeof canSee>[0], Record<'anonymous' | 'signed_in' | 'coordinator' | 'owner', boolean>][] = [
    ['public', { anonymous: true, signed_in: true, coordinator: true, owner: true }],
    ['signed_in', { anonymous: false, signed_in: true, coordinator: true, owner: true }],
    ['coordinators', { anonymous: false, signed_in: false, coordinator: true, owner: true }],
    ['private', { anonymous: false, signed_in: false, coordinator: false, owner: true }],
  ];
  it.each(matrix)('%s', (visibility, expected) => {
    for (const [viewer, allowed] of Object.entries(expected)) expect(canSee(visibility, viewer as keyof typeof expected)).toBe(allowed);
  });

  it('treats ordinary coordinators as signed-in users on public pages and admins as coordinator level', () => {
    expect(publicViewerLevel(null, 'd')).toBe('anonymous');
    expect(publicViewerLevel(user(), 'd')).toBe('signed_in');
    expect(publicViewerLevel(user({ userId: 'd' }), 'd')).toBe('owner');
    expect(publicViewerLevel(admin, 'd')).toBe('coordinator');
    expect(publicViewerLevel(user({ status: 'suspended' }), 'd')).toBe('anonymous');
  });
});

describe('community capabilities', () => {
  const active = (role: 'member' | 'coordinator' | 'leader') => ({ role, status: 'active' as const });
  it('gives leaders everything, coordinators no profile/role editing, members nothing', () => {
    expect([...communityCapabilities(user(), active('leader'), 'approved')]).toContain('manage_roles');
    const coord = communityCapabilities(user(), active('coordinator'), 'approved');
    expect(coord.has('verify_records')).toBe(true);
    expect(coord.has('find_donors')).toBe(true);
    expect(coord.has('manage_roles')).toBe(false);
    expect(coord.has('edit_profile')).toBe(false);
    expect(communityCapabilities(user(), active('member'), 'approved').size).toBe(0);
  });

  it('limits pending communities to profile editing and removes all powers when suspended', () => {
    expect([...communityCapabilities(user(), active('leader'), 'pending')].sort()).toEqual(['edit_profile', 'view_dashboard']);
    expect(communityCapabilities(user(), active('leader'), 'suspended').size).toBe(0);
    expect(communityCapabilities(user(), active('leader'), 'rejected').size).toBe(0);
  });

  it('ignores pending/removed memberships and suspended accounts', () => {
    expect(communityCapabilities(user(), { role: 'leader', status: 'pending' }, 'approved').size).toBe(0);
    expect(communityCapabilities(user(), { role: 'leader', status: 'removed' }, 'approved').size).toBe(0);
    expect(communityCapabilities(user({ status: 'suspended' }), active('leader'), 'approved').size).toBe(0);
    expect(communityCapabilities(null, active('leader'), 'approved').size).toBe(0);
  });

  it('lets platform admins oversee any community', () => {
    expect(communityCapabilities(admin, null, 'approved').has('verify_records')).toBe(true);
  });
});

describe('record verification', () => {
  const caps = new Set<CommunityCapability>(['verify_records']);
  it('requires verify capability AND the donor being an active member', () => {
    expect(canVerifyRecord(user(), { donorUserId: 'd', reviewerCapabilities: caps, donorIsActiveMember: true })).toBe(true);
    expect(canVerifyRecord(user(), { donorUserId: 'd', reviewerCapabilities: caps, donorIsActiveMember: false })).toBe(false);
    expect(canVerifyRecord(user(), { donorUserId: 'd', reviewerCapabilities: new Set(), donorIsActiveMember: true })).toBe(false);
  });
  it('never allows verifying your own record, even for admins', () => {
    expect(canVerifyRecord(user({ userId: 'd' }), { donorUserId: 'd', reviewerCapabilities: caps, donorIsActiveMember: true })).toBe(false);
    expect(canVerifyRecord({ ...admin, userId: 'd' }, { donorUserId: 'd', reviewerCapabilities: caps, donorIsActiveMember: true })).toBe(false);
    expect(canVerifyRecord(admin, { donorUserId: 'd', reviewerCapabilities: new Set(), donorIsActiveMember: false })).toBe(true);
  });
});

describe('membership management', () => {
  const leaderCaps = communityCapabilities(user(), { role: 'leader', status: 'active' }, 'approved');
  const coordCaps = communityCapabilities(user(), { role: 'coordinator', status: 'active' }, 'approved');
  it('only leaders change roles, never their own', () => {
    expect(canChangeMemberRole(leaderCaps, false, 'member', 'coordinator')).toBe(true);
    expect(canChangeMemberRole(leaderCaps, true, 'leader', 'member')).toBe(false);
    expect(canChangeMemberRole(coordCaps, false, 'member', 'coordinator')).toBe(false);
  });
  it('coordinators may remove only ordinary members', () => {
    expect(canRemoveMember(coordCaps, 'coordinator', 'member')).toBe(true);
    expect(canRemoveMember(coordCaps, 'coordinator', 'coordinator')).toBe(false);
    expect(canRemoveMember(leaderCaps, 'leader', 'coordinator')).toBe(true);
  });
});

describe('platform staff permissions', () => {
  const mod = user({ userId: 'm', role: 'moderator' });
  it('gives moderators donor work only, admins everything, users nothing', async () => {
    const { can, PLATFORM_PERMISSIONS, MODERATOR_PERMISSIONS, isStaff } = await import('@/server/policy');
    for (const p of PLATFORM_PERMISSIONS) {
      expect(can(admin, p)).toBe(true);
      expect(can(user(), p)).toBe(false);
      expect(can(mod, p)).toBe(MODERATOR_PERMISSIONS.includes(p));
    }
    for (const p of ['communities.review', 'operating_areas.manage', 'settings.manage', 'users.manage', 'data.export', 'deletions.process', 'audit.view'] as const) {
      expect(can(mod, p)).toBe(false);
    }
    expect(isStaff(mod)).toBe(true);
    expect(can({ ...mod, status: 'suspended' }, 'donors.review')).toBe(false);
  });
});
