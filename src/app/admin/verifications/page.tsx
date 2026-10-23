import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck, Building2, CalendarDays, Droplet, MapPin, StickyNote, UserRoundCheck } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { pendingProfileVerificationsAll } from '@/server/services/admin-queries';
import { pendingDonationReviews } from '@/server/services/donations';
import { getLocationIndex, labelFrom } from '@/server/services/location-index';
import { AdminAction } from '@/components/admin/AdminAction';
import { AdminEmpty, AdminPageHead, SectionTitle } from '@/components/admin/AdminUi';
import { ADMIN_ICONS } from '@/components/admin/icons';
import { Badge, BloodGroupBadge } from '@/components/ui';
import { reviewDonationAction, reviewProfileAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.verifications.title, robots: { index: false } };
}

export default async function AdminVerificationsPage() {
  const actor = await requirePermission('/admin/verifications', 'verifications.review');
  const { t, n, date, instantDate, locale } = await getI18n();
  const [records, profiles, index] = await Promise.all([pendingDonationReviews(null), pendingProfileVerificationsAll(actor), getLocationIndex()]);
  const v = t.admin.verifications;
  const pending = t.common.actions.submitting;
  const noteField = { name: 'note', label: t.admin.noteLabel, hint: t.admin.reasonHint };
  return (
    <>
      <AdminPageHead icon={ADMIN_ICONS.verifications} title={v.title} intro={v.intro} />

      <section className="stack" aria-labelledby="profiles">
        <SectionTitle id="profiles" icon={UserRoundCheck} count={n(profiles.length)}>
          {v.profilesTitle}
        </SectionTitle>
        {profiles.length === 0 ? (
          <AdminEmpty title={v.emptyProfiles} done />
        ) : (
          <ul className="record-list">
            {profiles.map((p) => (
              <li key={p.donorId}>
                <article className="card card-tight record-card" aria-labelledby={`p-${p.donorId}`}>
                  <div className="record-card-head">
                    <BloodGroupBadge group={p.bloodGroup} small label={t.common.bloodGroup} />
                    <div className="record-card-title">
                      <h3 id={`p-${p.donorId}`}>
                        <Link href={`/admin/donors/${p.donorId}`}>{p.fullName}</Link>
                      </h3>
                      <p>
                        {v.submitted}: {instantDate(p.requestedAt)}
                      </p>
                    </div>
                  </div>
                  <dl className="meta-list">
                    <div>
                      <dt>
                        <MapPin size={14} aria-hidden="true" />
                        {t.admin.donors.area}
                      </dt>
                      <dd>{labelFrom(index, locale, p.upazilaId, p.districtId)}</dd>
                    </div>
                    <div>
                      <dt>
                        <Building2 size={14} aria-hidden="true" />
                        {v.community}
                      </dt>
                      <dd>{p.communityName ?? t.admin.none}</dd>
                    </div>
                  </dl>
                  {p.userId === actor.userId ? (
                    <p className="self-note">{v.ownRecord}</p>
                  ) : (
                    <div className="action-row">
                      <AdminAction action={reviewProfileAction} hidden={{ donorId: p.donorId, decision: 'verified' }} submit={v.verify} pending={pending} tone="primary" size="md" note={noteField} />
                      <details className="disclosure disclosure-danger">
                        <summary>{v.reject}</summary>
                        <AdminAction action={reviewProfileAction} hidden={{ donorId: p.donorId, decision: 'rejected' }} submit={v.reject} pending={pending} tone="danger" size="md" note={noteField} />
                      </details>
                    </div>
                  )}
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stack" aria-labelledby="records">
        <SectionTitle id="records" icon={BadgeCheck} count={n(records.length)}>
          {v.donationsTitle}
        </SectionTitle>
        {records.length === 0 ? (
          <AdminEmpty title={v.emptyDonations} done />
        ) : (
          <ul className="record-list">
            {records.map((r) => (
              <li key={r.id}>
                <article className="card card-tight record-card" aria-labelledby={`r-${r.id}`}>
                  <div className="record-card-head">
                    <BloodGroupBadge group={r.bloodGroup} small label={t.common.bloodGroup} />
                    <div className="record-card-title">
                      <h3 id={`r-${r.id}`}>
                        <Link href={`/admin/donors/${r.donorId}`}>{r.donorName}</Link>
                      </h3>
                      <p>
                        {v.submitted}: {instantDate(r.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="record-card-badges">
                    <Badge tone="warning">
                      <Droplet size={14} aria-hidden="true" />
                      {t.common.donationType[r.donationType]}
                    </Badge>
                  </div>
                  <dl className="meta-list">
                    <div>
                      <dt>
                        <CalendarDays size={14} aria-hidden="true" />
                        {v.date}
                      </dt>
                      <dd>{date(r.donatedOn)}</dd>
                    </div>
                    {r.place && (
                      <div>
                        <dt>
                          <MapPin size={14} aria-hidden="true" />
                          {v.place}
                        </dt>
                        <dd>{r.place}</dd>
                      </div>
                    )}
                    <div>
                      <dt>
                        <Building2 size={14} aria-hidden="true" />
                        {v.community}
                      </dt>
                      <dd>{r.communityName ?? t.admin.none}</dd>
                    </div>
                    {r.note && (
                      <div className="meta-wide">
                        <dt>
                          <StickyNote size={14} aria-hidden="true" />
                          {v.note}
                        </dt>
                        <dd>{r.note}</dd>
                      </div>
                    )}
                  </dl>
                  {r.donorUserId === actor.userId ? (
                    <p className="self-note">{v.ownRecord}</p>
                  ) : (
                    <div className="action-row">
                      <AdminAction action={reviewDonationAction} hidden={{ donationId: r.id, decision: 'verified' }} submit={v.verify} pending={pending} tone="primary" size="md" note={noteField} />
                      <details className="disclosure disclosure-danger">
                        <summary>{v.reject}</summary>
                        <AdminAction action={reviewDonationAction} hidden={{ donationId: r.id, decision: 'rejected' }} submit={v.reject} pending={pending} tone="danger" size="md" note={noteField} />
                      </details>
                    </div>
                  )}
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
