/**
 * Central permission rules. Every service calls these before touching data; the UI only
 * hides controls. See docs/PERMISSIONS.md for the full matrix.
 */
import type { Visibility } from './domain/constants';

export interface Actor {
  userId: string;
  role: 'user' | 'admin';
  status: 'active' | 'deactivated' | 'suspended' | 'deleted';
  displayName: string;
  donorId: string | null;
}

export const isAdmin = (actor: Actor | null | undefined): boolean => !!actor && actor.role === 'admin' && actor.status === 'active';

// ---------------------------------------------------------------------------
// Donor information visibility
// ---------------------------------------------------------------------------

/** How the viewer relates to the donor being viewed. */
export type ViewerLevel = 'anonymous' | 'signed_in' | 'coordinator' | 'owner';

const LEVEL_RANK: Record<ViewerLevel, number> = { anonymous: 0, signed_in: 1, coordinator: 2, owner: 3 };
const REQUIRED_RANK: Record<Visibility, number> = { public: 0, signed_in: 1, coordinators: 2, private: 3 };

export function canSee(visibility: Visibility, viewer: ViewerLevel): boolean {
  return LEVEL_RANK[viewer] >= REQUIRED_RANK[visibility];
}

/**
 * Viewer level on public pages. Coordinators are treated as ordinary signed-in users here;
 * the coordinator level only applies inside a community's donor finder, where the donor's
 * coordinator-contact consent and the community's service area are also checked.
 * Platform administrators see coordinator-level information.
 */
export function publicViewerLevel(actor: Actor | null, donorUserId: string): ViewerLevel {
  if (!actor || actor.status !== 'active') return 'anonymous';
  if (actor.userId === donorUserId) return 'owner';
  if (isAdmin(actor)) return 'coordinator';
  return 'signed_in';
}

// ---------------------------------------------------------------------------
// Community capabilities
// ---------------------------------------------------------------------------

export type CommunityCapability =
  | 'view_dashboard'
  | 'edit_profile'
  | 'manage_members'
  | 'manage_roles'
  | 'verify_records'
  | 'coordinate_requests'
  | 'find_donors'
  | 'view_reports';

export interface MembershipFacts {
  role: 'member' | 'coordinator' | 'leader';
  status: 'pending' | 'active' | 'rejected' | 'removed' | 'left';
}

export type CommunityStatus = 'pending' | 'approved' | 'suspended' | 'rejected';

const ROLE_CAPABILITIES: Record<MembershipFacts['role'], CommunityCapability[]> = {
  leader: ['view_dashboard', 'edit_profile', 'manage_members', 'manage_roles', 'verify_records', 'coordinate_requests', 'find_donors', 'view_reports'],
  coordinator: ['view_dashboard', 'manage_members', 'verify_records', 'coordinate_requests', 'find_donors', 'view_reports'],
  member: [],
};

/** Capabilities still allowed while a community waits for approval. */
const PENDING_CAPABILITIES: CommunityCapability[] = ['view_dashboard', 'edit_profile'];

export function communityCapabilities(
  actor: Actor | null,
  membership: MembershipFacts | null,
  communityStatus: CommunityStatus,
): Set<CommunityCapability> {
  if (!actor || actor.status !== 'active') return new Set();
  // Platform admins oversee every community (they still cannot verify their own records).
  if (isAdmin(actor)) return new Set(ROLE_CAPABILITIES.leader);
  if (!membership || membership.status !== 'active') return new Set();
  const caps = ROLE_CAPABILITIES[membership.role];
  if (communityStatus === 'approved') return new Set(caps);
  if (communityStatus === 'pending') return new Set(caps.filter((c) => PENDING_CAPABILITIES.includes(c)));
  return new Set(); // suspended or rejected communities lose all powers
}

// ---------------------------------------------------------------------------
// Donation record verification
// ---------------------------------------------------------------------------

export interface VerificationFacts {
  donorUserId: string;
  /** The reviewer's capabilities in the community the record was submitted to (empty if none). */
  reviewerCapabilities: Set<CommunityCapability>;
  /** Whether the donor is still an active member of that community. */
  donorIsActiveMember: boolean;
}

export function canVerifyRecord(actor: Actor | null, facts: VerificationFacts): boolean {
  if (!actor || actor.status !== 'active') return false;
  if (actor.userId === facts.donorUserId) return false; // nobody verifies their own records
  if (isAdmin(actor)) return true;
  return facts.reviewerCapabilities.has('verify_records') && facts.donorIsActiveMember;
}

// ---------------------------------------------------------------------------
// Membership role changes
// ---------------------------------------------------------------------------

export function canChangeMemberRole(
  actorCaps: Set<CommunityCapability>,
  actorIsTarget: boolean,
  targetCurrentRole: MembershipFacts['role'],
  newRole: MembershipFacts['role'],
): boolean {
  if (actorIsTarget) return false; // no self-promotion or self-demotion through this path
  if (!actorCaps.has('manage_roles')) return false;
  return targetCurrentRole !== newRole;
}

export function canRemoveMember(
  actorCaps: Set<CommunityCapability>,
  actorRole: MembershipFacts['role'] | 'admin',
  targetRole: MembershipFacts['role'],
): boolean {
  if (!actorCaps.has('manage_members')) return false;
  if (actorRole === 'admin' || actorRole === 'leader') return true;
  // coordinators can only remove ordinary members
  return targetRole === 'member';
}
