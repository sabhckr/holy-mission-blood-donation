import { CalendarDays, ClipboardPlus, Droplet, Info, MapPin, UserCheck } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { DONATION_TYPES } from '@/server/domain/constants';
import { todayInBangladesh } from '@/server/domain/dates';
import { activeDonorMembers } from '@/server/services/community-queries';
import { pendingDonationReviews } from '@/server/services/donations';
import { pendingProfileVerifications } from '@/server/services/donors';
import { getLocationIndex, labelFrom } from '@/server/services/location-index';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { SelectField, TextArea, TextField } from '@/components/form/fields';
import { ManageHead } from '@/components/community/ManageHead';
import { Badge, BloodGroupBadge, NoAccess } from '@/components/ui';
import { recordDonationAction, reviewDonationAction, reviewProfileAction } from '../actions';
import { requireManageCapability } from '../_context';

export default async function ManageVerificationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t, n, date, dateTime, locale } = await getI18n();
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
      <div className="acct-actions">
        <SubmitButton name="decision" value="verified" label={c.verify} pendingLabel={t.common.actions.saving} className="btn btn-primary btn-sm" />
        <SubmitButton name="decision" value="rejected" label={c.reject} pendingLabel={t.common.actions.saving} className="btn btn-sm" />
      </div>
    </>
  );
  const queueHead = (icon: typeof Droplet, id: string, title: string, count: number, intro: string) => {
    const Icon = icon;
    return (
      <div className="acct-card-head">
        <span className={`acct-icon${count > 0 ? ' acct-icon-warning' : ' acct-icon-neutral'}`}>
          <Icon size={22} aria-hidden="true" />
        </span>
        <div>
          <h3 id={id} className="acct-h3">
            {title}
            {count > 0 && <Badge tone="warning">{n(count)}</Badge>}
          </h3>
          <p>{intro}</p>
        </div>
      </div>
    );
  };

  return (
    <>
      <ManageHead title={c.verificationsTitle} />

      <section className="card" aria-labelledby="records">
        {queueHead(Droplet, 'records', c.donationQueueTitle, records.length, c.donationQueueIntro)}
        {records.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {c.noDonationQueue}
          </p>
        ) : (
          <ul className="acct-list">
            {records.map((r) => {
              const self = r.donorUserId === access.actor.userId;
              return (
                <li key={r.id} className="org-review">
                  <div className="org-donor-head">
                    <BloodGroupBadge group={r.bloodGroup} small label={t.common.bloodGroup} />
                    <div>
                      <p className="acct-item-title">{r.donorName}</p>
                      <div className="acct-item-badges">
                        <Badge tone="warning">{t.common.verification.selfReported}</Badge>
                      </div>
                    </div>
                  </div>
                  <dl className="dl">
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
                  {self ? (
                    <p className="acct-note">
                      <Info size={16} aria-hidden="true" />
                      <span>{t.errors.self_verification}</span>
                    </p>
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

      <section className="card" aria-labelledby="profiles">
        {queueHead(UserCheck, 'profiles', c.profileQueueTitle, profiles.length, c.profileQueueIntro)}
        {profiles.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {c.noProfileQueue}
          </p>
        ) : (
          <ul className="acct-list">
            {profiles.map((p) => {
              const self = p.userId === access.actor.userId;
              return (
                <li key={p.donorId} className="org-review">
                  <div className="org-donor-head">
                    <BloodGroupBadge group={p.bloodGroup} small label={t.common.bloodGroup} />
                    <div>
                      <p className="acct-item-title">{p.fullName}</p>
                      <p className="acct-meta">
                        <span>
                          <MapPin size={14} aria-hidden="true" />
                          {labelFrom(index, locale, p.districtId)}
                        </span>
                        <span>
                          <CalendarDays size={14} aria-hidden="true" />
                          {c.submittedOn}: {dateTime(p.requestedAt)}
                        </span>
                      </p>
                    </div>
                  </div>
                  {self ? (
                    <p className="acct-note">
                      <Info size={16} aria-hidden="true" />
                      <span>{t.errors.self_verification}</span>
                    </p>
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

      <section aria-labelledby="record">
        {members.length === 0 ? (
          <div className="card">
            {queueHead(ClipboardPlus, 'record', c.recordTitle, 0, c.recordIntro)}
            <p className="muted" style={{ margin: 0 }}>
              {c.noDonorMembers}
            </p>
          </div>
        ) : (
          <ActionForm action={recordDonationAction} className="form">
            <fieldset className="form-section">
              <legend id="record">
                <ClipboardPlus size={20} aria-hidden="true" />
                {c.recordTitle}
              </legend>
              <p className="acct-legend-hint">{c.recordIntro}</p>
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
              <div className="acct-form-actions">
                <SubmitButton label={c.recordSubmit} pendingLabel={t.common.actions.saving} className="btn btn-soft" />
              </div>
            </fieldset>
          </ActionForm>
        )}
      </section>
    </>
  );
}
