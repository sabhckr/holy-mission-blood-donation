import { getI18n } from '@/i18n/server';
import { DONATION_TYPES } from '@/server/domain/constants';
import { todayInBangladesh } from '@/server/domain/dates';
import { activeDonorMembers } from '@/server/services/community-queries';
import { pendingDonationReviews } from '@/server/services/donations';
import { pendingProfileVerifications } from '@/server/services/donors';
import { getLocationIndex, labelFrom } from '@/server/services/location-index';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { SelectField, TextArea, TextField } from '@/components/form/fields';
import { Badge, BloodGroupBadge, NoAccess } from '@/components/ui';
import { recordDonationAction, reviewDonationAction, reviewProfileAction } from '../actions';
import { requireManageCapability } from '../_context';

export default async function ManageVerificationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t, date, dateTime, locale } = await getI18n();
  const access = await requireManageCapability(slug, 'verify_records');
  if (!access) return <NoAccess t={t} />;
  const c = t.community;
  const communityId = access.community.id;
  const [records, profiles, members, index] = await Promise.all([
    pendingDonationReviews(communityId),
    pendingProfileVerifications(communityId),
    activeDonorMembers(communityId),
    getLocationIndex(),
  ]);
  const opt = t.common.states.optional;
  const reviewFields = (targetId: string) => (
    <>
      <input type="hidden" name="communityId" value={communityId} />
      <input type="hidden" name="targetId" value={targetId} />
      <TextArea name="note" label={c.reviewNote} hint={c.reviewNoteHint} maxLength={300} rows={2} />
      <div className="cluster-sm">
        <SubmitButton name="decision" value="verified" label={c.verify} pendingLabel={t.common.actions.saving} className="btn btn-primary btn-sm" />
        <SubmitButton name="decision" value="rejected" label={c.reject} pendingLabel={t.common.actions.saving} className="btn btn-danger btn-sm" />
      </div>
    </>
  );

  return (
    <>
      <h2>{c.verificationsTitle}</h2>

      <section className="card stack" aria-labelledby="records">
        <h3 id="records">{c.donationQueueTitle}</h3>
        <p className="small muted">{c.donationQueueIntro}</p>
        {records.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {c.noDonationQueue}
          </p>
        ) : (
          <ul className="list-plain list-divided">
            {records.map((r) => {
              const self = r.donorUserId === access.actor.userId;
              return (
                <li key={r.id} className="stack-sm">
                  <div className="cluster" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                    <BloodGroupBadge group={r.bloodGroup} small label={t.common.bloodGroup} />
                    <div className="stack-sm" style={{ minWidth: 0 }}>
                      <strong>{r.donorName}</strong>
                      <dl className="dl small">
                        <dt>{c.donationDate}</dt>
                        <dd>{date(r.donatedOn)}</dd>
                        <dt>{c.donationType}</dt>
                        <dd>{t.common.donationType[r.donationType]}</dd>
                        {r.place && (
                          <>
                            <dt>{c.place}</dt>
                            <dd>{r.place}</dd>
                          </>
                        )}
                        {r.note && (
                          <>
                            <dt>{c.donorNote}</dt>
                            <dd>{r.note}</dd>
                          </>
                        )}
                        <dt>{c.submittedOn}</dt>
                        <dd>{dateTime(r.createdAt)}</dd>
                      </dl>
                      <Badge tone="warning">{t.common.verification.selfReported}</Badge>
                    </div>
                  </div>
                  {self ? (
                    <p className="small muted">{t.errors.self_verification}</p>
                  ) : (
                    <ActionForm action={reviewDonationAction} className="form">
                      {reviewFields(r.id)}
                    </ActionForm>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card stack" aria-labelledby="profiles">
        <h3 id="profiles">{c.profileQueueTitle}</h3>
        <p className="small muted">{c.profileQueueIntro}</p>
        {profiles.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {c.noProfileQueue}
          </p>
        ) : (
          <ul className="list-plain list-divided">
            {profiles.map((p) => {
              const self = p.userId === access.actor.userId;
              return (
                <li key={p.donorId} className="stack-sm">
                  <div className="cluster" style={{ flexWrap: 'nowrap' }}>
                    <BloodGroupBadge group={p.bloodGroup} small label={t.common.bloodGroup} />
                    <span>
                      <strong>{p.fullName}</strong>
                      <br />
                      <span className="small muted">
                        {labelFrom(index, locale, p.districtId)} · {c.submittedOn}: {dateTime(p.requestedAt)}
                      </span>
                    </span>
                  </div>
                  {self ? (
                    <p className="small muted">{t.errors.self_verification}</p>
                  ) : (
                    <ActionForm action={reviewProfileAction} className="form">
                      {reviewFields(p.donorId)}
                    </ActionForm>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card stack" aria-labelledby="record">
        <h3 id="record">{c.recordTitle}</h3>
        <p className="small muted">{c.recordIntro}</p>
        {members.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {c.noDonorMembers}
          </p>
        ) : (
          <ActionForm action={recordDonationAction}>
            <input type="hidden" name="communityId" value={communityId} />
            <SelectField
              name="donorId"
              label={c.recordDonor}
              required
              placeholder={c.chooseDonor}
              options={members.filter((m) => m.userId !== access.actor.userId).map((m) => ({ value: m.donorId, label: `${m.fullName} (${m.bloodGroup})` }))}
            />
            <div className="field-row">
              <TextField name="donatedOn" type="date" label={c.donationDate} required max={todayInBangladesh()} />
              <SelectField
                name="donationType"
                label={c.donationType}
                required
                defaultValue="whole_blood"
                options={DONATION_TYPES.map((d) => ({ value: d, label: t.common.donationType[d] }))}
              />
            </div>
            <TextField name="place" label={c.place} optionalLabel={opt} maxLength={120} />
            <TextArea name="note" label={c.reviewNote} hint={c.reviewNoteHint} maxLength={300} rows={2} />
            <SubmitButton label={c.recordSubmit} pendingLabel={t.common.actions.saving} />
          </ActionForm>
        )}
      </section>
    </>
  );
}
