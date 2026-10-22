import type { Metadata } from 'next';
import Link from 'next/link';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { pendingProfileVerificationsAll } from '@/server/services/admin-queries';
import { pendingDonationReviews } from '@/server/services/donations';
import { getLocationIndex, labelFrom } from '@/server/services/location-index';
import { AdminAction } from '@/components/admin/AdminAction';
import { EmptyState } from '@/components/ui';
import { reviewDonationAction, reviewProfileAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.verifications.title, robots: { index: false } };
}

export default async function AdminVerificationsPage() {
  const actor = await requirePermission('/admin/verifications', 'verifications.review');
  const { t, date, instantDate, locale } = await getI18n();
  const [records, profiles, index] = await Promise.all([pendingDonationReviews(null), pendingProfileVerificationsAll(actor), getLocationIndex()]);
  const v = t.admin.verifications;
  const pending = t.common.actions.submitting;
  const noteField = { name: 'note', label: t.admin.noteLabel, hint: t.admin.reasonHint };
  return (
    <>
      <header className="stack-sm">
        <h1>{v.title}</h1>
        <p className="muted">{v.intro}</p>
      </header>

      <section className="stack" aria-labelledby="records">
        <h2 id="records">{v.donationsTitle}</h2>
        {records.length === 0 ? (
          <EmptyState title={v.emptyDonations} />
        ) : (
          <ul className="list-plain stack">
            {records.map((r) => (
              <li key={r.id} className="card card-tight stack-sm">
                <div className="cluster between">
                  <strong>
                    <Link href={`/admin/donors/${r.donorId}`}>{r.donorName}</Link> · {r.bloodGroup}
                  </strong>
                  <span className="small muted">
                    {v.submitted}: {instantDate(r.createdAt)}
                  </span>
                </div>
                <dl className="dl">
                  <dt>{v.date}</dt>
                  <dd>{date(r.donatedOn)}</dd>
                  <dt>{v.type}</dt>
                  <dd>{t.common.donationType[r.donationType]}</dd>
                  {r.place && (
                    <>
                      <dt>{v.place}</dt>
                      <dd>{r.place}</dd>
                    </>
                  )}
                  {r.note && (
                    <>
                      <dt>{v.note}</dt>
                      <dd>{r.note}</dd>
                    </>
                  )}
                  <dt>{v.community}</dt>
                  <dd>{r.communityName ?? t.admin.none}</dd>
                </dl>
                {r.donorUserId !== actor.userId && (
                  <div className="grid grid-2">
                    <AdminAction action={reviewDonationAction} hidden={{ donationId: r.id, decision: 'verified' }} submit={v.verify} pending={pending} tone="primary" note={noteField} />
                    <AdminAction action={reviewDonationAction} hidden={{ donationId: r.id, decision: 'rejected' }} submit={v.reject} pending={pending} tone="danger" note={noteField} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stack" aria-labelledby="profiles">
        <h2 id="profiles">{v.profilesTitle}</h2>
        {profiles.length === 0 ? (
          <EmptyState title={v.emptyProfiles} />
        ) : (
          <ul className="list-plain stack">
            {profiles.map((p) => (
              <li key={p.donorId} className="card card-tight stack-sm">
                <div className="cluster between">
                  <strong>
                    <Link href={`/admin/donors/${p.donorId}`}>{p.fullName}</Link> · {p.bloodGroup}
                  </strong>
                  <span className="small muted">
                    {v.submitted}: {instantDate(p.requestedAt)}
                  </span>
                </div>
                <p className="small" style={{ margin: 0 }}>
                  {labelFrom(index, locale, p.upazilaId, p.districtId)} · {v.community}: {p.communityName ?? t.admin.none}
                </p>
                {p.userId !== actor.userId && (
                  <div className="grid grid-2">
                    <AdminAction action={reviewProfileAction} hidden={{ donorId: p.donorId, decision: 'verified' }} submit={v.verify} pending={pending} tone="primary" note={noteField} />
                    <AdminAction action={reviewProfileAction} hidden={{ donorId: p.donorId, decision: 'rejected' }} submit={v.reject} pending={pending} tone="danger" note={noteField} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
