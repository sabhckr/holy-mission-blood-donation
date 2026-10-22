import type { Metadata } from 'next';
import Link from 'next/link';
import { getI18n } from '@/i18n/server';
import { requireAdmin } from '@/server/auth/current';
import { getExternalProvider } from '@/server/notify/providers';
import { platformStats } from '@/server/services/admin';
import { AdminAction } from '@/components/admin/AdminAction';
import { Alert, Stat } from '@/components/ui';
import { runExpiryAction, sendQueuedAction } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.overview.title, robots: { index: false } };
}

export default async function AdminOverviewPage() {
  const actor = await requireAdmin('/admin');
  const { t, n } = await getI18n();
  const s = await platformStats(actor);
  const a = t.admin.overview;
  const providerOn = !!getExternalProvider();
  return (
    <>
      <header className="stack-sm">
        <h1>{a.title}</h1>
        <p className="muted">{a.intro}</p>
      </header>

      <section className="stack" aria-labelledby="queues">
        <h2 id="queues">{a.queuesTitle}</h2>
        <div className="grid grid-4">
          <Link className="card-link" href="/admin/communities?status=pending">
            <Stat value={n(s.queues.pendingCommunities)} label={a.pendingCommunities} />
          </Link>
          <Link className="card-link" href="/admin/verifications">
            <Stat value={n(s.records.pending + s.donors.pendingVerification)} label={t.admin.nav.verifications} />
          </Link>
          <Link className="card-link" href="/admin/reports">
            <Stat value={n(s.queues.openReports)} label={a.openReports} />
          </Link>
          <Link className="card-link" href="/admin/deletions">
            <Stat value={n(s.queues.pendingDeletions)} label={a.pendingDeletions} />
          </Link>
        </div>
      </section>

      <section className="stack" aria-labelledby="donors">
        <h2 id="donors">{a.donorsTitle}</h2>
        <div className="grid grid-4">
          <Stat value={n(s.donors.total)} label={a.donorsTotal} />
          <Stat value={n(s.donors.listed)} label={a.donorsListed} />
          <Stat value={n(s.donors.availableNow)} label={a.availableNow} />
          <Stat value={n(s.donors.verified)} label={a.verifiedProfiles} />
        </div>
        <p className="small muted">{t.common.availability.explain}</p>
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
        <p className="small muted">
          {a.usersTotal}: {n(s.queues.users)}
        </p>
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
        <div className="card stack-sm">
          <h2>{a.communitiesTitle}</h2>
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

      <section className="card stack" aria-labelledby="maintenance">
        <h2 id="maintenance">{a.maintenanceTitle}</h2>
        <p className="muted">{a.maintenanceIntro}</p>
        <div className="grid grid-2">
          <AdminAction action={runExpiryAction} hidden={{}} submit={a.runExpiry} pending={t.common.actions.submitting} />
          <AdminAction action={sendQueuedAction} hidden={{}} submit={a.sendQueued} pending={t.common.actions.submitting} />
        </div>
      </section>
    </>
  );
}
