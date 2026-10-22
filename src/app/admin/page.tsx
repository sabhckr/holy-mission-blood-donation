import type { Metadata } from 'next';
import Link from 'next/link';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { getExternalProvider } from '@/server/notify/providers';
import { can, type PlatformPermission } from '@/server/policy';
import { platformStats } from '@/server/services/admin';
import { recentStaffActivity, staffDonorStats } from '@/server/services/donor-admin';
import { AdminAction } from '@/components/admin/AdminAction';
import { Alert, EmptyState, Stat } from '@/components/ui';
import { runExpiryAction, sendQueuedAction } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.overview.title, robots: { index: false } };
}

export default async function AdminOverviewPage() {
  const actor = await requirePermission('/admin', 'overview.view');
  const { t, n, dateTime } = await getI18n();
  const [s, d, activity] = await Promise.all([platformStats(actor), staffDonorStats(actor), recentStaffActivity(actor, 12)]);
  const a = t.admin.overview;
  const actionLabels = t.admin.activity.actions as Record<string, string>;
  const providerOn = !!getExternalProvider();
  const approvedOrganisations = s.communitiesByStatus.find((c) => c.status === 'approved')?.n ?? 0;
  const shownInSearch = s.byGroup.reduce((sum, g) => sum + g.n, 0);
  const roleLabel = (role: string | null) => (role === 'admin' || role === 'moderator' ? t.common.roles[role] : null);

  /** A figure that links to its queue only when the viewer may open that queue. */
  const queue = (value: number, label: string, href: string, permission: PlatformPermission) =>
    can(actor, permission) ? (
      <Link className="card-link" href={href}>
        <Stat value={n(value)} label={label} />
      </Link>
    ) : (
      <Stat value={n(value)} label={label} />
    );

  return (
    <>
      <header className="stack-sm">
        <h1>{a.title}</h1>
        <p className="muted">{a.intro}</p>
      </header>

      <section className="stack" aria-labelledby="queues">
        <h2 id="queues">{a.queuesTitle}</h2>
        <div className="grid grid-3">
          {queue(d.pending, a.pendingDonors, '/admin/donors?registration=pending', 'donors.review')}
          {queue(s.records.pending + s.donors.pendingVerification, a.verificationQueue, '/admin/verifications', 'verifications.review')}
          {queue(s.queues.openReports, a.openReports, '/admin/reports', 'reports.handle')}
          {queue(s.queues.pendingCommunities, a.pendingCommunities, '/admin/communities?status=pending', 'communities.review')}
          {queue(s.queues.pendingDeletions, a.pendingDeletions, '/admin/deletions', 'deletions.process')}
        </div>
      </section>

      <section className="stack" aria-labelledby="donors">
        <h2 id="donors">{a.donorsTitle}</h2>
        <div className="grid grid-4">
          <Stat value={n(d.total)} label={a.donorsTotal} />
          {queue(d.pending, t.common.registrationStatus.pending, '/admin/donors?registration=pending', 'donors.review')}
          {queue(d.approved, t.common.registrationStatus.approved, '/admin/donors?registration=approved', 'donors.review')}
          {queue(d.rejected, t.common.registrationStatus.rejected, '/admin/donors?registration=rejected', 'donors.review')}
        </div>
        <h3>{a.listingTitle}</h3>
        <div className="grid grid-3">
          <Stat value={n(shownInSearch)} label={a.shownInSearch} note={a.shownInSearchNote} />
          <Stat value={n(d.deactivated)} label={a.pausedOrDeactivated} />
          {queue(d.removed, a.removed, '/admin/donors?listing=removed', 'donors.review')}
        </div>
      </section>

      <section className="stack" aria-labelledby="availability">
        <h2 id="availability">{a.availabilityTitle}</h2>
        <p className="muted">{a.availabilityIntro}</p>
        <div className="grid grid-4">
          <Stat value={n(d.available)} label={t.common.availability.available} />
          <Stat value={n(d.unavailable)} label={t.common.availability.unavailable} />
          <Stat value={n(d.unknown)} label={t.common.availability.unknown} />
          <Stat value={n(d.staffSet)} label={a.staffSet} note={a.staffSetNote} />
        </div>
        <p className="small muted">{t.common.availability.explain}</p>
      </section>

      <section className="stack" aria-labelledby="verification">
        <h2 id="verification">{a.verificationTitle}</h2>
        <div className="grid grid-2">
          <Stat value={n(s.donors.verified)} label={a.verifiedProfiles} note={a.unverifiedNote} />
          <Stat value={n(s.queues.users)} label={a.usersTotal} />
        </div>
        <h3>{a.byGroupTitle}</h3>
        {s.byGroup.length === 0 ? (
          <p className="muted">{t.admin.none}</p>
        ) : (
          <div className="cluster">
            {s.byGroup.map((g) => (
              <span key={g.bloodGroup} className="badge badge-neutral">
                {g.bloodGroup}: {n(g.n)}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="stack" aria-labelledby="records">
        <h2 id="records">{a.recordsTitle}</h2>
        <div className="grid grid-4">
          <Stat value={n(s.records.verified)} label={a.recordsVerified} />
          <Stat value={n(s.records.selfReported)} label={a.recordsSelfReported} />
          <Stat value={n(s.records.pending)} label={a.recordsPending} />
          <Stat value={n(s.records.rejected)} label={a.recordsRejected} />
        </div>
        <Alert tone="warning">{a.recordsNote}</Alert>
      </section>

      <section className="grid grid-2">
        <div className="card stack-sm">
          <h2>{a.organisationsTitle}</h2>
          <div className="grid grid-2">
            {queue(s.queues.pendingCommunities, a.pendingCommunities, '/admin/communities?status=pending', 'communities.review')}
            {queue(approvedOrganisations, a.activeOrganisations, '/admin/communities?status=approved', 'communities.review')}
          </div>
          <h3>{a.communitiesTitle}</h3>
          {s.communitiesByStatus.length === 0 ? (
            <p className="muted">{t.admin.none}</p>
          ) : (
            <dl className="dl">
              {s.communitiesByStatus.map((c) => (
                <div key={c.status} style={{ display: 'contents' }}>
                  <dt>{t.common.communityStatus[c.status]}</dt>
                  <dd>{n(c.n)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <div className="card stack-sm">
          <h2>{a.requestsTitle}</h2>
          {s.requestsByStatus.length === 0 ? (
            <p className="muted">{t.admin.none}</p>
          ) : (
            <dl className="dl">
              {s.requestsByStatus.map((r) => (
                <div key={r.status} style={{ display: 'contents' }}>
                  <dt>{t.common.requestStatus[r.status]}</dt>
                  <dd>{n(r.n)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      <section className="stack" aria-labelledby="activity">
        <h2 id="activity">{t.admin.activity.title}</h2>
        <p className="muted">{t.admin.activity.intro}</p>
        {activity.length === 0 ? (
          <EmptyState title={t.admin.activity.empty} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t.admin.activity.when}</th>
                  <th scope="col">{t.admin.activity.who}</th>
                  <th scope="col">{t.admin.activity.what}</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((row) => {
                  const role = roleLabel(row.actorRole);
                  const href = row.targetType === 'donor' && row.targetId && can(actor, 'donors.review') ? `/admin/donors/${row.targetId}` : null;
                  const label = actionLabels[row.action] ?? row.action;
                  return (
                    <tr key={row.id}>
                      <td>{dateTime(row.createdAt)}</td>
                      <td>
                        {row.actorName ?? t.admin.activity.system}
                        {role && <span className="small muted"> · {role}</span>}
                      </td>
                      <td>{href ? <Link href={href}>{label}</Link> : label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {can(actor, 'audit.view') && (
          <p>
            <Link href="/admin/audit">{t.admin.activity.openAudit}</Link>
          </p>
        )}
      </section>

      <section className="card stack" aria-labelledby="deliveries">
        <h2 id="deliveries">{a.deliveriesTitle}</h2>
        <Alert tone={providerOn ? 'info' : 'warning'}>{providerOn ? a.providerConfigured : a.providerNotConfigured}</Alert>
        <dl className="dl">
          <dt>{a.deliveriesSent}</dt>
          <dd>{n(s.queues.deliveriesSent)}</dd>
          <dt>{a.deliveriesFailed}</dt>
          <dd>{n(s.queues.deliveriesFailed)}</dd>
          <dt>{a.deliveriesNotConfigured}</dt>
          <dd>{n(s.queues.deliveriesNotConfigured)}</dd>
        </dl>
      </section>

      {can(actor, 'settings.manage') && (
        <section className="card stack" aria-labelledby="maintenance">
          <h2 id="maintenance">{a.maintenanceTitle}</h2>
          <p className="muted">{a.maintenanceIntro}</p>
          <div className="grid grid-2">
            <AdminAction action={runExpiryAction} hidden={{}} submit={a.runExpiry} pending={t.common.actions.submitting} />
            <AdminAction action={sendQueuedAction} hidden={{}} submit={a.sendQueued} pending={t.common.actions.submitting} />
          </div>
        </section>
      )}
    </>
  );
}
