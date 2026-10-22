import Link from 'next/link';
import { getI18n } from '@/i18n/server';
import { BLOOD_GROUPS } from '@/server/domain/constants';
import { communityReport } from '@/server/services/communities';
import { pendingCounts } from '@/server/services/community-queries';
import { NoAccess, Stat } from '@/components/ui';
import { loadManageContext } from './_context';

export default async function ManageOverviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t, n } = await getI18n();
  const { actor, ctx } = await loadManageContext(slug);
  if (!ctx || !ctx.caps.has('view_dashboard')) return <NoAccess t={t} />;
  const c = t.community;
  const base = `/manage/${ctx.community.slug}`;
  if (!ctx.caps.has('view_reports')) {
    // Pending communities: only details can be edited until approval.
    return (
      <section className="card stack">
        <h2>{c.overviewTitle}</h2>
        <p>{c.needsApproval}</p>
        <Link className="btn" href={`${base}/settings`}>
          {c.nav.settings}
        </Link>
      </section>
    );
  }
  const [report, pending] = await Promise.all([communityReport(actor, ctx.community.id), pendingCounts(ctx.community.id)]);
  const groupCounts = new Map(report.byGroup.map((g) => [g.bloodGroup, g.n]));
  const todo = [
    { n: pending.members, label: c.membersPending, href: `${base}/members` },
    { n: pending.records, label: c.pendingHere, href: `${base}/verifications` },
    { n: pending.profiles, label: c.pendingProfiles, href: `${base}/verifications` },
    { n: pending.openRequests, label: t.common.nav.requests, href: `${base}/requests` },
  ].filter((x) => x.n > 0);
  return (
    <>
      <h2>{c.overviewTitle}</h2>
      <section className="card stack-sm" aria-labelledby="todo">
        <h3 id="todo">{c.todoTitle}</h3>
        {todo.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {c.nothingToDo}
          </p>
        ) : (
          <ul className="list-plain list-divided">
            {todo.map((item) => (
              <li key={item.label} className="cluster between">
                <span>{item.label}</span>
                <Link className="btn btn-sm" href={item.href}>
                  {n(item.n)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="grid grid-3">
        <Stat value={n(report.members.active)} label={c.membersActive} />
        <Stat value={n(report.members.pending)} label={c.membersPending} />
        <Stat value={n(report.records.verifiedHere)} label={c.verifiedHere} note={t.common.verification.verified} />
        <Stat value={n(report.records.pendingHere)} label={c.pendingHere} />
        <Stat value={n(report.records.selfReportedByMembers)} label={c.selfReportedByMembers} note={t.common.verification.selfReported} />
      </div>
      <p className="small muted">{c.overviewNote}</p>
      <section className="card stack-sm" aria-labelledby="groups">
        <h3 id="groups">{c.membersByGroup}</h3>
        {report.byGroup.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {c.noDonorMembersYet}
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {BLOOD_GROUPS.map((g) => (
                    <th key={g} scope="col">
                      {g}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {BLOOD_GROUPS.map((g) => (
                    <td key={g}>{n(groupCounts.get(g) ?? 0)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="card stack-sm" aria-labelledby="requests">
        <h3 id="requests">{c.requestsByStatus}</h3>
        {report.requestsByStatus.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {c.noRequests}
          </p>
        ) : (
          <dl className="dl">
            {report.requestsByStatus.map((r) => (
              <div key={r.status} style={{ display: 'contents' }}>
                <dt>{t.common.requestStatus[r.status]}</dt>
                <dd>{n(r.n)}</dd>
              </div>
            ))}
          </dl>
        )}
        <Link className="btn" href={`${base}/requests`}>
          {c.openQueue}
        </Link>
      </section>
    </>
  );
}
