import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Building2, CalendarDays, History, Lock, MapPin, UserRound, Users } from 'lucide-react';
import { z } from 'zod';
import { getI18n } from '@/i18n/server';
import type { Messages } from '@/i18n/messages';
import { requirePermission } from '@/server/auth/current';
import { formatBdPhone } from '@/server/domain/phone';
import { adminCommunities, searchAuditLog } from '@/server/services/admin';
import { getLocationIndex, labelFrom } from '@/server/services/location-index';
import { AdminAction } from '@/components/admin/AdminAction';
import { AdminEmpty, AdminPageHead, StatusTabs } from '@/components/admin/AdminUi';
import { AuditTrail, type AuditEntry } from '@/components/admin/AuditTrail';
import { ADMIN_ICONS } from '@/components/admin/icons';
import { AffiliationBadge, CommunityStatusBadge } from '@/components/admin/StatusBadges';
import { reviewCommunityAction, setAffiliationAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.communities.title, robots: { index: false } };
}

const STATUSES = ['pending', 'approved', 'suspended', 'rejected'] as const;
type Status = (typeof STATUSES)[number];

/** "From → to" for organisation decisions recorded in the audit log. */
function decisionDetails(t: Messages, action: string, metadata: Record<string, unknown>): string[] {
  const from = metadata.from;
  const to = action.startsWith('community.') ? action.slice('community.'.length) : null;
  const label = (code: unknown) => (typeof code === 'string' && code in t.common.communityStatus ? t.common.communityStatus[code as Status] : null);
  const a = label(from);
  const b = label(to);
  return a && b ? [`${a} → ${b}`] : [];
}

export default async function AdminCommunitiesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const actor = await requirePermission('/admin/communities', 'communities.review');
  const { t, n, instantDate, dateTime, locale } = await getI18n();
  const parsed = z.enum(STATUSES).safeParse((await searchParams).status);
  const status = parsed.success ? parsed.data : null;
  const [rows, index] = await Promise.all([adminCommunities(actor, status), getLocationIndex()]);
  // Each organisation's own audit trail (decisions, edits, memberships), newest first.
  const trails = await Promise.all(rows.map(({ community }) => searchAuditLog(actor, { targetType: 'community', targetId: community.id, page: 1 })));
  const c = t.admin.communities;
  const actionLabels = t.admin.activity.actions as Record<string, string>;
  const roleLabel = (role: string | null) => (role === 'admin' || role === 'moderator' ? t.common.roles[role] : null);
  const pending = t.common.actions.submitting;
  const reasonField = { name: 'reason', label: c.decisionReason, hint: t.admin.reasonHint };
  const requiredReason = { name: 'reason', label: t.admin.reasonLabel, hint: t.admin.reasonHint, required: true };
  const notProvided = <span className="muted">{c.notProvided}</span>;

  return (
    <>
      <AdminPageHead icon={ADMIN_ICONS.communities} title={c.title} intro={c.intro} />
      <StatusTabs
        label={c.status}
        items={[
          { href: '/admin/communities', label: t.admin.any, current: status === null },
          ...STATUSES.map((s) => ({ href: `/admin/communities?status=${s}`, label: t.common.communityStatus[s], current: status === s })),
        ]}
      />
      {rows.length === 0 ? (
        <AdminEmpty title={c.empty} done={status === 'pending'} />
      ) : (
        <ul className="record-list">
          {rows.map(({ community, creatorName, members }, i) => {
            const trail: AuditEntry[] = trails[i].items.map(({ log, actorName }) => ({
              id: log.id,
              what: actionLabels[log.action] ?? log.action,
              who: actorName ?? t.admin.activity.system,
              role: roleLabel(log.actorRole),
              when: dateTime(log.createdAt),
              details: decisionDetails(t, log.action, log.metadata),
            }));
            const headingId = `org-${community.id}`;
            return (
              <li key={community.id}>
                <article className="card record-card" aria-labelledby={headingId}>
                  <div className="record-card-head">
                    <span className="record-card-icon">
                      <Building2 size={22} aria-hidden="true" />
                    </span>
                    <div className="record-card-title">
                      <h2 id={headingId}>{community.name}</h2>
                      <p className="cluster-sm">
                        <MapPin size={14} aria-hidden="true" />
                        <span className="visually-hidden">{c.district}</span>
                        {labelFrom(index, locale, community.districtId, community.divisionId)}
                      </p>
                    </div>
                  </div>
                  <div className="record-card-badges">
                    <CommunityStatusBadge status={community.status} t={t} />
                    <AffiliationBadge affiliation={community.affiliation} t={t} />
                  </div>

                  <dl className="meta-list">
                    <div>
                      <dt>
                        <Users size={14} aria-hidden="true" />
                        {c.members}
                      </dt>
                      <dd>{n(members)}</dd>
                    </div>
                    <div>
                      <dt>
                        <CalendarDays size={14} aria-hidden="true" />
                        {c.created}
                      </dt>
                      <dd>{instantDate(community.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>
                        <UserRound size={14} aria-hidden="true" />
                        {c.creator}
                      </dt>
                      <dd>{creatorName ?? t.admin.none}</dd>
                    </div>
                    {community.statusReason && (
                      <div className="meta-wide">
                        <dt>{c.reason}</dt>
                        <dd>{community.statusReason}</dd>
                      </div>
                    )}
                  </dl>
                  {community.description && <p className="small">{community.description}</p>}

                  <section className="private-box" aria-labelledby={`rep-${community.id}`}>
                    <h3 id={`rep-${community.id}`}>
                      <Lock size={16} aria-hidden="true" />
                      {c.representativeTitle}
                    </h3>
                    <p className="hint">{c.representativeIntro}</p>
                    <dl className="meta-list">
                      <div>
                        <dt>{c.representativeName}</dt>
                        <dd>{community.representativeName ?? notProvided}</dd>
                      </div>
                      <div>
                        <dt>{c.representativeRole}</dt>
                        <dd>{community.representativeRole ?? notProvided}</dd>
                      </div>
                      <div>
                        <dt>{c.representativePhone}</dt>
                        <dd>
                          {community.representativePhone?.startsWith('+880') ? (
                            <a className="phone-reveal" href={`tel:${community.representativePhone}`}>
                              {formatBdPhone(community.representativePhone)}
                            </a>
                          ) : (
                            notProvided
                          )}
                        </dd>
                      </div>
                      <div className="meta-wide">
                        <dt>{c.verificationInfo}</dt>
                        <dd style={{ whiteSpace: 'pre-line' }}>{community.verificationInfo ?? notProvided}</dd>
                      </div>
                    </dl>
                  </section>

                  <div className="record-links">
                    <Link className="section-link" href={`/communities/${community.slug}`}>
                      {c.publicPage}
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                    <Link className="section-link" href={`/manage/${community.slug}`}>
                      {c.manage}
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </div>

                  {community.status === 'pending' && (
                    <div className="action-row">
                      <AdminAction action={reviewCommunityAction} hidden={{ communityId: community.id, decision: 'approved' }} submit={c.approve} pending={pending} tone="primary" size="md" note={reasonField} />
                      <details className="disclosure disclosure-danger">
                        <summary>{c.reject}</summary>
                        <AdminAction action={reviewCommunityAction} hidden={{ communityId: community.id, decision: 'rejected' }} submit={c.reject} pending={pending} tone="danger" size="md" note={reasonField} />
                      </details>
                    </div>
                  )}
                  {(community.status === 'suspended' || community.status === 'rejected') && (
                    <div className="action-row">
                      <AdminAction
                        action={reviewCommunityAction}
                        hidden={{ communityId: community.id, decision: 'approved' }}
                        submit={community.status === 'suspended' ? c.reinstate : c.approve}
                        pending={pending}
                        tone="primary"
                        size="md"
                        note={reasonField}
                      />
                    </div>
                  )}

                  <details className="disclosure">
                    <summary>{c.affiliation}</summary>
                    <div className="stack-sm">
                      <p className="hint">{c.affiliationIntro}</p>
                      {community.affiliation === 'holy_mission' ? (
                        <AdminAction action={setAffiliationAction} hidden={{ communityId: community.id, affiliation: 'independent' }} submit={c.makeIndependent} pending={pending} size="md" note={requiredReason} />
                      ) : community.status === 'approved' ? (
                        <AdminAction
                          action={setAffiliationAction}
                          hidden={{ communityId: community.id, affiliation: 'holy_mission' }}
                          submit={c.makeHolyMission}
                          pending={pending}
                          tone="primary"
                          size="md"
                          note={requiredReason}
                          confirm={c.confirmHolyMission}
                        />
                      ) : (
                        <p className="small muted">{c.onlyApproved}</p>
                      )}
                    </div>
                  </details>

                  {community.status === 'approved' && (
                    <div className="danger-zone">
                      <details className="disclosure disclosure-danger">
                        <summary>{c.suspend}</summary>
                        <p className="hint">{c.suspendHint}</p>
                        <AdminAction
                          action={reviewCommunityAction}
                          hidden={{ communityId: community.id, decision: 'suspended' }}
                          submit={c.suspend}
                          pending={pending}
                          tone="danger"
                          size="md"
                          note={requiredReason}
                          confirm={c.confirmSuspend}
                        />
                      </details>
                    </div>
                  )}

                  <section className="stack-sm" aria-labelledby={`hist-${community.id}`}>
                    <h3 id={`hist-${community.id}`} className="admin-section-title" style={{ fontSize: '1rem' }}>
                      <History size={18} aria-hidden="true" />
                      {c.historyTitle}
                    </h3>
                    <AuditTrail entries={trail} empty={t.admin.donor.historyEmpty} moreLabel={(count) => t.admin.donor.historyMore(n(count))} visible={3} />
                  </section>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
