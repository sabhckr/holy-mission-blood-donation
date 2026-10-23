import Link from 'next/link';
import { ArrowRight, BadgeCheck, CircleCheck, ClipboardList, Droplet, Hourglass, Settings, Siren, UserCheck, UserPlus, Users } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { BLOOD_GROUPS } from '@/server/domain/constants';
import { communityReport } from '@/server/services/communities';
import { pendingCounts } from '@/server/services/community-queries';
import { IconTile } from '@/components/account/bits';
import { ManageHead } from '@/components/community/ManageHead';
import { STATUS_TONE } from '@/components/request/RequestCard';
import { Badge, NoAccess, Stat } from '@/components/ui';
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
      <section className="card stack" aria-labelledby="overview-title">
        <div className="acct-card-head" style={{ marginBottom: 0 }}>
          <IconTile icon={Hourglass} tone="warning" />
          <div>
            <h2 id="overview-title">{c.overviewTitle}</h2>
            <p>{c.needsApproval}</p>
          </div>
        </div>
        <div>
          <Link className="btn btn-primary" href={`${base}/settings`}>
            <Settings size={18} aria-hidden="true" />
            {c.nav.settings}
          </Link>
        </div>
      </section>
    );
  }
  const [report, pending] = await Promise.all([communityReport(actor, ctx.community.id), pendingCounts(ctx.community.id)]);
  const groupCounts = new Map(report.byGroup.map((g) => [g.bloodGroup, g.n]));
  const todo = [
    { n: pending.members, label: c.membersPending, href: `${base}/members`, icon: UserPlus },
    { n: pending.records, label: c.pendingHere, href: `${base}/verifications`, icon: Droplet },
    { n: pending.profiles, label: c.pendingProfiles, href: `${base}/verifications`, icon: UserCheck },
    { n: pending.openRequests, label: c.openRequests, href: `${base}/requests`, icon: Siren },
  ].filter((x) => x.n > 0);
  return (
    <>
      <ManageHead title={c.overviewTitle} />

      <section aria-labelledby="todo">
        <h3 id="todo" className="acct-h2">
          <Hourglass size={20} aria-hidden="true" className="icon-brand" />
          {c.todoTitle}
        </h3>
        {todo.length === 0 ? (
          <div className="card card-tight org-clear">
            <IconTile icon={CircleCheck} tone="success" />
            <p>{c.nothingToDo}</p>
          </div>
        ) : (
          <ul className="org-attention">
            {todo.map((item) => (
              <li key={item.label}>
                <Link href={item.href}>
                  <IconTile icon={item.icon} tone="warning" />
                  <span>
                    <strong>{n(item.n)}</strong>
                    <span className="small">{item.label}</span>
                  </span>
                  <ArrowRight size={20} aria-hidden="true" className="acct-arrow" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="numbers">
        <h3 id="numbers" className="acct-h2">
          {c.statsTitle}
        </h3>
        <div className="org-stats">
          <Stat icon={<Users size={22} aria-hidden="true" />} value={n(report.members.active)} label={c.membersActive} />
          <Stat icon={<UserPlus size={22} aria-hidden="true" />} value={n(report.members.pending)} label={c.membersPending} />
          <Stat icon={<BadgeCheck size={22} aria-hidden="true" />} value={n(report.records.verifiedHere)} label={c.verifiedHere} note={t.common.verification.verified} />
          <Stat icon={<Hourglass size={22} aria-hidden="true" />} value={n(report.records.pendingHere)} label={c.pendingHere} />
          <Stat
            icon={<ClipboardList size={22} aria-hidden="true" />}
            value={n(report.records.selfReportedByMembers)}
            label={c.selfReportedByMembers}
            note={t.common.verification.selfReported}
          />
        </div>
        <p className="acct-note" style={{ marginTop: 'var(--space-3)' }}>
          <span>{c.overviewNote}</span>
        </p>
      </section>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <section className="card" aria-labelledby="groups">
          <div className="acct-card-head">
            <IconTile icon={Droplet} />
            <h3 id="groups">{c.membersByGroup}</h3>
          </div>
          {report.byGroup.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              {c.noDonorMembersYet}
            </p>
          ) : (
            <ul className="org-groups">
              {BLOOD_GROUPS.map((g) => {
                const count = groupCounts.get(g) ?? 0;
                return (
                  <li key={g} className={count === 0 ? 'org-group-zero' : undefined}>
                    <span className="org-group-name">{g}</span>
                    <strong>{n(count)}</strong>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="card" aria-labelledby="requests">
          <div className="acct-card-head">
            <IconTile icon={Siren} />
            <h3 id="requests">{c.requestsByStatus}</h3>
          </div>
          {report.requestsByStatus.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              {c.noRequests}
            </p>
          ) : (
            <ul className="org-status-list">
              {report.requestsByStatus.map((r) => (
                <li key={r.status}>
                  <Badge tone={STATUS_TONE[r.status]}>{t.common.requestStatus[r.status]}</Badge>
                  <strong>{n(r.n)}</strong>
                </li>
              ))}
            </ul>
          )}
          <p style={{ margin: 'var(--space-4) 0 0' }}>
            <Link className="btn btn-soft" href={`${base}/requests`}>
              {c.openQueue}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </p>
        </section>
      </div>
    </>
  );
}
