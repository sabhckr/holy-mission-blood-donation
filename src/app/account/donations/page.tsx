import type { Metadata } from 'next';
import Link from 'next/link';
import { getI18n } from '@/i18n/server';
import { requireActor } from '@/server/auth/current';
import { DONATION_TYPES } from '@/server/domain/constants';
import { todayInBangladesh } from '@/server/domain/dates';
import { verifyingCommunities } from '@/server/services/account-queries';
import { donationTrail, listOwnDonations } from '@/server/services/donations';
import { getOwnDonorOverview } from '@/server/services/donors';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { SelectField, TextArea, TextField } from '@/components/form/fields';
import { EligibilityCard } from '@/components/account/EligibilityCard';
import { Alert, Badge, EmptyState, VerificationBadge } from '@/components/ui';
import { addDonationAction, correctDonationAction, submitDonationAction, voidDonationAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.donations.title, robots: { index: false } };
}

const TRAIL_LIMIT = 30;

export default async function DonationsPage() {
  const i18n = await getI18n();
  const { t, n, date, dateTime, locale } = i18n;
  const dn = t.account.donations;
  const actor = await requireActor('/account/donations');
  const overview = await getOwnDonorOverview(actor);
  if (!overview) {
    return (
      <>
        <h1>{dn.title}</h1>
        <Alert tone="info">
          <p>{t.errors.donor_profile_required}</p>
          <Link href="/account/profile">{t.account.dashboard.createDonorCta}</Link>
        </Alert>
      </>
    );
  }
  const [records, communities] = await Promise.all([listOwnDonations(actor), verifyingCommunities(actor)]);
  const trails = await Promise.all(records.slice(0, TRAIL_LIMIT).map((r) => donationTrail(actor, r.donation.id).catch(() => [])));
  const today = todayInBangladesh();
  const typeOptions = DONATION_TYPES.map((d) => ({ value: d, label: t.common.donationType[d] }));
  const commOptions = communities.map((c) => ({ value: c.id, label: locale === 'en' && c.nameEn ? c.nameEn : c.name }));
  const opt = t.common.states.optional;
  const actionLabel = (action: string) => (dn.trailActions as Record<string, string>)[action] ?? action;

  return (
    <>
      <h1>{dn.title}</h1>
      <p>{dn.intro}</p>

      <div className="grid grid-2">
        <EligibilityCard estimate={overview.estimate} i18n={i18n} showAddLink={false} />
        <section className="card stack" aria-labelledby="intervals-title">
          <h2 id="intervals-title" style={{ fontSize: '1.15rem' }}>
            {t.account.eligibility.intervalsTitle}
          </h2>
          <p className="small" style={{ margin: 0 }}>
            {t.account.eligibility.intervalsIntro}
          </p>
          <dl className="dl">
            {DONATION_TYPES.map((type) => (
              <div key={type} style={{ display: 'contents' }}>
                <dt>{t.common.donationType[type]}</dt>
                <dd>{t.account.eligibility.intervalDays(n(overview.settings.eligibilityIntervals[type]))}</dd>
              </div>
            ))}
          </dl>
          <Link className="small" href="/help#eligibility">
            {t.account.eligibility.learnMore}
          </Link>
        </section>
      </div>

      <section className="stack" aria-labelledby="history-title">
        <h2 id="history-title" style={{ fontSize: '1.15rem' }}>
          {dn.title}
        </h2>
        <p className="small muted" style={{ margin: 0 }}>
          {dn.verifiedHelp}
        </p>
        {records.length === 0 ? (
          <EmptyState title={dn.empty} />
        ) : (
          <ul className="list-plain stack">
            {records.map(({ donation: d, reviewCommunityName, reviewCommunitySlug }, i) => {
              const trail = i < TRAIL_LIMIT ? trails[i] : [];
              const editable = d.status !== 'voided';
              return (
                <li key={d.id} className="card card-tight stack-sm">
                  <div className="cluster between">
                    <strong>
                      {date(d.donatedOn)} · {t.common.donationType[d.donationType]}
                    </strong>
                    <span className="cluster-sm">
                      <VerificationBadge status={d.status} t={t} />
                      {d.source === 'self_reported' && d.status !== 'verified' && <Badge>{t.common.verification.selfReported}</Badge>}
                    </span>
                  </div>
                  <dl className="dl small">
                    <dt>{dn.colSource}</dt>
                    <dd>{t.common.donationSource[d.source]}</dd>
                    {reviewCommunityName && (
                      <>
                        <dt>{dn.colCommunity}</dt>
                        <dd>{reviewCommunitySlug ? <Link href={`/communities/${reviewCommunitySlug}`}>{reviewCommunityName}</Link> : reviewCommunityName}</dd>
                      </>
                    )}
                    {d.place && (
                      <>
                        <dt>{dn.colPlace}</dt>
                        <dd>{d.place}</dd>
                      </>
                    )}
                    {d.note && (
                      <>
                        <dt>{dn.note}</dt>
                        <dd>{d.note}</dd>
                      </>
                    )}
                  </dl>
                  {d.reviewNote && <p className="small" style={{ margin: 0 }}>{dn.reviewNote(d.reviewNote)}</p>}
                  {d.voidedReason && <p className="small muted" style={{ margin: 0 }}>{dn.voidedReason(d.voidedReason === 'corrected' ? dn.trailActions.corrected : d.voidedReason)}</p>}

                  {trail.length > 0 && (
                    <details className="disclosure">
                      <summary>{dn.trailTitle}</summary>
                      <ol className="list-plain list-divided small">
                        {trail.map(({ event, actorName }) => (
                          <li key={event.id}>
                            <strong>{actionLabel(event.action)}</strong> · {dateTime(event.createdAt)}
                            {actorName && <span className="muted"> · {dn.trailBy(actorName)}</span>}
                            {event.note && event.note !== 'correction' && event.note !== 'recorded by community' && <div className="muted">{event.note}</div>}
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}

                  {(d.status === 'unverified' || d.status === 'rejected') && (
                    <details className="disclosure">
                      <summary>{dn.submitTitle}</summary>
                      {commOptions.length > 0 ? (
                        <ActionForm action={submitDonationAction}>
                          <input type="hidden" name="donationId" value={d.id} />
                          <SelectField name="communityId" label={dn.reviewCommunity} hint={dn.reviewCommunityHint} options={commOptions} defaultValue={commOptions[0]?.value} required />
                          <div className="form-actions">
                            <SubmitButton label={dn.submitButton} pendingLabel={t.common.actions.submitting} className="btn" />
                          </div>
                        </ActionForm>
                      ) : (
                        <p className="small" style={{ margin: 0 }}>
                          {dn.noCommunity} <Link href="/communities">{t.account.communities.find}</Link>
                        </p>
                      )}
                    </details>
                  )}

                  {editable && (
                    <details className="disclosure">
                      <summary>{dn.correctTitle}</summary>
                      <ActionForm action={correctDonationAction}>
                        <p className="hint">{dn.correctHint}</p>
                        <input type="hidden" name="donationId" value={d.id} />
                        <div className="field-row">
                          <TextField name="donatedOn" type="date" label={dn.donatedOn} required max={today} defaultValue={d.donatedOn} />
                          <SelectField name="donationType" label={dn.donationType} options={typeOptions} defaultValue={d.donationType} required />
                        </div>
                        <TextField name="place" label={dn.place} hint={dn.placeHint} optionalLabel={opt} maxLength={120} defaultValue={d.place} />
                        <TextArea name="note" label={dn.note} hint={dn.noteHint} optionalLabel={opt} maxLength={300} defaultValue={d.note} />
                        <div className="form-actions">
                          <SubmitButton label={dn.correctButton} pendingLabel={t.common.actions.saving} className="btn" />
                        </div>
                      </ActionForm>
                    </details>
                  )}

                  {editable && (
                    <details className="disclosure">
                      <summary>{dn.voidTitle}</summary>
                      <ActionForm action={voidDonationAction}>
                        <input type="hidden" name="donationId" value={d.id} />
                        <TextField name="reason" label={dn.voidReason} hint={dn.voidReasonHint} required maxLength={200} />
                        <div className="form-actions">
                          <SubmitButton label={dn.voidButton} pendingLabel={t.common.actions.saving} className="btn btn-danger" />
                        </div>
                      </ActionForm>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="stack" aria-labelledby="add-title" id="add">
        <h2 id="add-title" style={{ fontSize: '1.15rem' }}>
          {dn.addTitle}
        </h2>
        <ActionForm action={addDonationAction} aria-label={dn.addTitle}>
          <fieldset className="form-section">
            <legend className="visually-hidden">{dn.addTitle}</legend>
            <div className="field-row">
              <TextField name="donatedOn" type="date" label={dn.donatedOn} required max={today} />
              <SelectField name="donationType" label={dn.donationType} options={typeOptions} defaultValue="whole_blood" required />
            </div>
            <TextField name="place" label={dn.place} hint={dn.placeHint} optionalLabel={opt} maxLength={120} />
            <TextArea name="note" label={dn.note} hint={dn.noteHint} optionalLabel={opt} maxLength={300} />
            {commOptions.length > 0 ? (
              <SelectField name="reviewCommunityId" label={dn.reviewCommunity} hint={dn.reviewCommunityHint} options={commOptions} placeholder={dn.noReview} />
            ) : (
              <p className="small muted" style={{ margin: 0 }}>
                {dn.noCommunity}
              </p>
            )}
          </fieldset>
          <SubmitButton label={dn.addButton} pendingLabel={t.common.actions.saving} />
        </ActionForm>
      </section>
    </>
  );
}
