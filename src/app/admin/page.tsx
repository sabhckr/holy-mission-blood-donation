import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Building2,
  CircleCheck,
  ClipboardList,
  Droplets,
  HeartPulse,
  History,
  Search,
  ShieldCheck,
  Siren,
  UserRoundCheck,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { getExternalProvider } from '@/server/notify/providers';
import { can, type PlatformPermission } from '@/server/policy';
import { duplicateCandidates, platformStats } from '@/server/services/admin';
import { recentStaffActivity, staffDonorStats } from '@/server/services/donor-admin';
import { AdminAction } from '@/components/admin/AdminAction';
import { AdminPageHead, SectionTitle } from '@/components/admin/AdminUi';
import { ADMIN_ICONS } from '@/components/admin/icons';
import { statusIcon, statusTone } from '@/components/admin/StatusBadges';
import { Alert, EmptyState, Stat } from '@/components/ui';
import { runExpiryAction, sendQueuedAction } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.overview.title, robots: { index: false } };
}

/** Duplicate candidates are capped at this many by the service. */
const DUPLICATE_CAP = 100;

export default async function AdminOverviewPage() {
  const actor = await requirePermission('/admin', 'overview.view');
  const { t, n, dateTime } = await getI18n();
  const [s, d, activity, duplicates] = await Promise.all([
    platformStats(actor),
    staffDonorStats(actor),
    recentStaffActivity(actor, 12),
    can(actor, 'duplicates.review') ? duplicateCandidates(actor) : Promise.resolve(null),
  ]);
  const a = t.admin.overview;
  const actionLabels = t.admin.activity.actions as Record<string, string>;
  const providerOn = !!getExternalProvider();
  const approvedOrganisations = s.communitiesByStatus.find((c) => c.status === 'approved')?.n ?? 0;
  const shownInSearch = s.byGroup.reduce((sum, g) => sum + g.n, 0);
  const roleLabel = (role: string | null) => (role === 'admin' || role === 'moderator' ? t.common.roles[role] : null);

  /** Only queues the viewer may open are shown; each card links to the filtered list. */
  const queues: { key: string; value: number; label: string; href: string; icon: LucideIcon; permission: PlatformPermission; capped?: boolean }[] = [
    { key: 'donors', value: d.pending, label: a.pendingDonors, href: '/admin/donors?registration=pending', icon: UserRoundCheck, permission: 'donors.review' },
    { key: 'verify', value: s.records.pending + s.donors.pendingVerification, label: a.verificationQueue, href: '/admin/verifications', icon: ADMIN_ICONS.verifications, permission: 'verifications.review' },
    { key: 'reports', value: s.queues.openReports, label: a.openReports, href: '/admin/reports', icon: ADMIN_ICONS.reports, permission: 'reports.handle' },
    { key: 'communities', value: s.queues.pendingCommunities, label: a.pendingCommunities, href: '/admin/communities?status=pending', icon: ADMIN_ICONS.communities, permission: 'communities.review' },
    { key: 'duplicates', value: duplicates?.length ?? 0, label: a.duplicatesQueue, href: '/admin/duplicates', icon: ADMIN_ICONS.duplicates, permission: 'duplicates.review', capped: (duplicates?.length ?? 0) >= DUPLICATE_CAP },
    { key: 'deletions', value: s.queues.pendingDeletions, label: a.pendingDeletions, href: '/admin/deletions', icon: ADMIN_ICONS.deletions, permission: 'deletions.process' },
  ];
  const visibleQueues = queues.filter((q) => can(actor, q.permission));
  const waiting = visibleQueues.reduce((sum, q) => sum + q.value, 0);

  /** A count row that links to its filtered list only when the viewer may open it. */
  const countRow = (key: string, label: string, value: number, opts: { href?: string; permission?: PlatformPermission; icon?: LucideIcon; tone?: string } = {}) => {
    const Icon = opts.icon;
    const inner = (
      <>
        {Icon && <Icon size={16} className={`tone-${opts.tone ?? 'neutral'}`} aria-hidden="true" />}
        <span>{label}</span>
      </>
    );
    const linked = opts.href && (!opts.permission || can(actor, opts.permission));
    return (
      <li key={key}>
        {linked ? (
          <Link className="count-label" href={opts.href!}>
            {inner}
          </Link>
        ) : (
          <span className="count-label">{inner}</span>
        )}
        <span className="count-value">{n(value)}</span>
      </li>
    );
  };

  return (
    <>
      <AdminPageHead icon={ADMIN_ICONS.overview} title={a.title} intro={a.intro} />

      <section className="stack" aria-labelledby="queues">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <div>
            <SectionTitle id="queues" icon={ClipboardList}>
              {a.queuesTitle}
            </SectionTitle>
            <p>{waiting > 0 ? a.attentionIntro : a.nothingWaiting}</p>
          </div>
        </div>
        <ul className="attention-grid">
          {visibleQueues.map((q) => (
            <li key={q.key}>
              <Link className={`attention-card ${q.value > 0 ? 'is-waiting' : 'is-clear'}`} href={q.href}>
                <span className="attention-icon">
                  <q.icon size={22} aria-hidden="true" />
                </span>
                <span className="attention-count">{q.capped ? `${n(DUPLICATE_CAP)}+` : n(q.value)}</span>
                <span className="attention-label">{q.label}</span>
                <span className="attention-cta">
                  {q.value > 0 ? (
                    <>
                      {a.queueOpen}
                      <ArrowRight size={15} aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      <CircleCheck size={15} aria-hidden="true" />
                      {a.queueClear}
                    </>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="stack" aria-labelledby="figures">
        <SectionTitle id="figures" icon={HeartPulse}>
          {a.keyFiguresTitle}
        </SectionTitle>
        <div className="admin-stats">
          <Stat icon={<Users size={20} aria-hidden="true" />} value={n(d.total)} label={a.donorsTotal} />
          <Stat icon={<Search size={20} aria-hidden="true" />} value={n(shownInSearch)} label={a.shownInSearch} note={a.shownInSearchNote} />
          <Stat icon={<HeartPulse size={20} aria-hidden="true" />} value={n(d.available)} label={t.common.availability.available} />
          <Stat icon={<BadgeCheck size={20} aria-hidden="true" />} value={n(s.donors.verified)} label={a.verifiedProfiles} note={a.unverifiedNote} />
          <Stat icon={<Building2 size={20} aria-hidden="true" />} value={n(approvedOrganisations)} label={a.activeOrganisations} />
          <Stat icon={<ShieldCheck size={20} aria-hidden="true" />} value={n(s.queues.users)} label={a.usersTotal} />
        </div>
      </section>

      <section className="stack" aria-labelledby="breakdown">
        <SectionTitle id="breakdown" icon={Droplets}>
          {a.breakdownTitle}
        </SectionTitle>
        <div className="breakdown-grid">
          <div className="card card-tight breakdown-card">
            <h3>
              <Users size={18} aria-hidden="true" />
              {a.donorsTitle}
            </h3>
            <ul className="count-list">
              {(['pending', 'approved', 'rejected'] as const).map((st) =>
                countRow(st, t.common.registrationStatus[st], d[st], {
                  href: `/admin/donors?registration=${st}`,
                  permission: 'donors.review',
                  icon: statusIcon.registration(st),
                  tone: statusTone.registration(st),
                }),
              )}
            </ul>
            <h4>{a.listingTitle}</h4>
            <ul className="count-list">
              {countRow('listed', a.shownInSearch, shownInSearch, { icon: statusIcon.listing('active'), tone: 'success' })}
              {countRow('paused', a.pausedOrDeactivated, d.deactivated, { icon: statusIcon.listing('paused') })}
              {countRow('removed', a.removed, d.removed, { href: '/admin/donors?listing=removed', permission: 'donors.review', icon: statusIcon.listing('removed'), tone: 'danger' })}
            </ul>
          </div>

          <div className="card card-tight breakdown-card">
            <h3>
              <HeartPulse size={18} aria-hidden="true" />
              {a.availabilityTitle}
            </h3>
            <p className="hint">{a.availabilityIntro}</p>
            <ul className="count-list">
              {countRow('available', t.common.availability.available, d.available, { icon: statusIcon.stated('available'), tone: 'success' })}
              {countRow('unavailable', t.common.availability.unavailable, d.unavailable, { icon: statusIcon.stated('unavailable') })}
              {countRow('unknown', t.common.availability.unknown, d.unknown, { icon: statusIcon.stated('unknown'), tone: 'warning' })}
              {countRow('staff', a.staffSet, d.staffSet, { icon: ADMIN_ICONS.users, tone: 'info' })}
            </ul>
            <p className="small muted" style={{ marginTop: 'var(--space-2)', marginBottom: 0 }}>
              {a.staffSetNote} {t.common.availability.explain}
            </p>
          </div>

          <div className="card card-tight breakdown-card">
            <h3>
              <Droplets size={18} aria-hidden="true" />
              {a.byGroupTitle}
            </h3>
            {s.byGroup.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                {t.admin.none}
              </p>
            ) : (
              <ul className="group-counts">
                {s.byGroup.map((g) => (
                  <li key={g.bloodGroup}>
                    <span className="group-name">{g.bloodGroup}</span>
                    <span className="group-n">{n(g.n)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card card-tight breakdown-card">
            <h3>
              <BadgeCheck size={18} aria-hidden="true" />
              {a.recordsTitle}
            </h3>
            <ul className="count-list">
              {countRow('rv', a.recordsVerified, s.records.verified, { icon: statusIcon.verification('verified'), tone: 'info' })}
              {countRow('rs', a.recordsSelfReported, s.records.selfReported, { icon: statusIcon.verification('unverified') })}
              {countRow('rp', a.recordsPending, s.records.pending, { href: '/admin/verifications', permission: 'verifications.review', icon: statusIcon.verification('pending'), tone: 'warning' })}
              {countRow('rr', a.recordsRejected, s.records.rejected, { icon: statusIcon.verification('rejected'), tone: 'danger' })}
            </ul>
            <p className="small muted" style={{ marginTop: 'var(--space-2)', marginBottom: 0 }}>
              {a.recordsNote}
            </p>
          </div>

          <div className="card card-tight breakdown-card">
            <h3>
              <Building2 size={18} aria-hidden="true" />
              {a.communitiesTitle}
            </h3>
            {s.communitiesByStatus.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                {t.admin.none}
              </p>
            ) : (
              <ul className="count-list">
                {s.communitiesByStatus.map((c) =>
                  countRow(c.status, t.common.communityStatus[c.status], c.n, {
                    href: `/admin/communities?status=${c.status}`,
                    permission: 'communities.review',
                    icon: statusIcon.community(c.status),
                    tone: statusTone.community(c.status),
                  }),
                )}
              </ul>
            )}
          </div>

          <div className="card card-tight breakdown-card">
            <h3>
              <Siren size={18} aria-hidden="true" />
              {a.requestsTitle}
            </h3>
            {s.requestsByStatus.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                {t.admin.none}
              </p>
            ) : (
              <ul className="count-list">
                {s.requestsByStatus.map((r) =>
                  countRow(r.status, t.common.requestStatus[r.status], r.n, {
                    href: `/admin/requests?status=${r.status}`,
                    permission: 'requests.view',
                    icon: statusIcon.request(r.status),
                    tone: statusTone.request(r.status),
                  }),
                )}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="stack" aria-labelledby="activity">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <div>
            <SectionTitle id="activity" icon={History}>
              {t.admin.activity.title}
            </SectionTitle>
            <p>{t.admin.activity.intro}</p>
          </div>
          {can(actor, 'audit.view') && (
            <Link className="section-link" href="/admin/audit">
              {t.admin.activity.openAudit}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
        </div>
        {activity.length === 0 ? (
          <EmptyState title={t.admin.activity.empty} />
        ) : (
          <ul className="activity-list">
            {activity.map((row) => {
              const role = roleLabel(row.actorRole);
              const href = row.targetType === 'donor' && row.targetId && can(actor, 'donors.review') ? `/admin/donors/${row.targetId}` : null;
              const label = actionLabels[row.action] ?? row.action;
              return (
                <li key={row.id}>
                  <span className="activity-dot">
                    <History size={16} aria-hidden="true" />
                  </span>
                  <div className="activity-body">
                    <p className="activity-what">{href ? <Link href={href}>{label}</Link> : label}</p>
                    <p className="activity-meta">
                      <span>
                        {row.actorName ?? t.admin.activity.system}
                        {role && ` (${role})`}
                      </span>
                      <span>{dateTime(row.createdAt)}</span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card stack" aria-labelledby="deliveries">
        <h2 id="deliveries" className="admin-section-title">
          <Bell size={20} aria-hidden="true" />
          {a.deliveriesTitle}
        </h2>
        <Alert tone={providerOn ? 'info' : 'warning'}>{providerOn ? a.providerConfigured : a.providerNotConfigured}</Alert>
        <ul className="count-list">
          {countRow('sent', a.deliveriesSent, s.queues.deliveriesSent, { icon: CircleCheck, tone: 'success' })}
          {countRow('failed', a.deliveriesFailed, s.queues.deliveriesFailed, { icon: statusIcon.verification('rejected'), tone: 'danger' })}
          {countRow('nc', a.deliveriesNotConfigured, s.queues.deliveriesNotConfigured, { icon: statusIcon.stated('unknown'), tone: 'warning' })}
        </ul>
      </section>

      {can(actor, 'settings.manage') && (
        <section className="card stack" aria-labelledby="maintenance">
          <div>
            <h2 id="maintenance" className="admin-section-title">
              <Wrench size={20} aria-hidden="true" />
              {a.maintenanceTitle}
            </h2>
            <p className="hint" style={{ marginTop: 'var(--space-1)' }}>
              {a.maintenanceIntro}
            </p>
          </div>
          <div className="action-split">
            <AdminAction action={runExpiryAction} hidden={{}} submit={a.runExpiry} pending={t.common.actions.submitting} size="md" />
            <AdminAction action={sendQueuedAction} hidden={{}} submit={a.sendQueued} pending={t.common.actions.submitting} size="md" />
          </div>
        </section>
      )}
    </>
  );
}
