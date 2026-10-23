import { BadgeCheck, Building2, CircleCheck, CirclePause, CircleX, Crown, HeartHandshake, Hourglass, LogOut, UserCog, UserRound, UserX, type LucideIcon } from 'lucide-react';
import type { Messages } from '@/i18n/messages';
import { Badge } from '@/components/ui';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
export type CommunityStatus = 'pending' | 'approved' | 'suspended' | 'rejected';

/**
 * Each organisation status has its own word, colour and icon. Only "approved" uses the check
 * badge, so a pending organisation never looks reviewed.
 */
export const COMMUNITY_STATUS: Record<CommunityStatus, { tone: Tone; icon: LucideIcon }> = {
  pending: { tone: 'warning', icon: Hourglass },
  approved: { tone: 'success', icon: BadgeCheck },
  suspended: { tone: 'danger', icon: CirclePause },
  rejected: { tone: 'danger', icon: CircleX },
};

export function CommunityStatusBadge({ status, t, withLabel }: { status: CommunityStatus; t: Messages; withLabel?: boolean }) {
  const s = COMMUNITY_STATUS[status];
  return (
    <Badge tone={s.tone}>
      <s.icon size={14} aria-hidden="true" />
      {withLabel ? `${t.community.statusLabel}: ${t.common.communityStatus[status]}` : t.common.communityStatus[status]}
    </Badge>
  );
}

/** "Holy Mission's own" only for affiliation holy_mission; everything else is "independent". */
export function AffiliationBadge({ affiliation, t }: { affiliation: 'independent' | 'holy_mission'; t: Messages }) {
  const holyMission = affiliation === 'holy_mission';
  const Icon = holyMission ? HeartHandshake : Building2;
  return (
    <Badge tone={holyMission ? 'info' : 'neutral'}>
      <Icon size={14} aria-hidden="true" />
      {t.common.affiliation[affiliation]}
    </Badge>
  );
}

const ROLE_ICON = { leader: Crown, coordinator: UserCog, member: UserRound } as const;

export function RoleBadge({ role, t }: { role: 'leader' | 'coordinator' | 'member'; t: Messages }) {
  const Icon = ROLE_ICON[role];
  const cls = role === 'leader' ? 'badge acct-badge-brand' : role === 'coordinator' ? 'badge badge-info' : 'badge badge-neutral';
  return (
    <span className={cls}>
      <Icon size={14} aria-hidden="true" />
      {t.common.roles[role]}
    </span>
  );
}

const MEMBERSHIP: Record<'pending' | 'active' | 'rejected' | 'removed' | 'left', { tone: Tone; icon: LucideIcon }> = {
  pending: { tone: 'warning', icon: Hourglass },
  active: { tone: 'success', icon: CircleCheck },
  rejected: { tone: 'danger', icon: CircleX },
  removed: { tone: 'danger', icon: UserX },
  left: { tone: 'neutral', icon: LogOut },
};

export function MembershipBadge({ status, t }: { status: keyof typeof MEMBERSHIP; t: Messages }) {
  const s = MEMBERSHIP[status];
  return (
    <Badge tone={s.tone}>
      <s.icon size={14} aria-hidden="true" />
      {t.account.communities.membershipStatus[status]}
    </Badge>
  );
}
