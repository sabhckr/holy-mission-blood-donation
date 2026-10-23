import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, BadgeCheck, CalendarDays, ClipboardCheck, HeartPulse, History, IdCard, ListChecks, Lock, MapPin, PencilLine, Phone, ScrollText, ShieldCheck, TriangleAlert, UserRound } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import type { Messages } from '@/i18n/messages';
import { requirePermission } from '@/server/auth/current';
import { BLOOD_GROUPS } from '@/server/domain/constants';
import { todayInBangladesh } from '@/server/domain/dates';
import { formatBdPhone } from '@/server/domain/phone';
import { can } from '@/server/policy';
import { getRequestMeta } from '@/server/security/request-meta';
import { getDonorForStaff } from '@/server/services/donor-admin';
import { getServiceArea } from '@/server/services/service-area';
import { compactLocations, getLocationIndex, labelFrom } from '@/server/services/location-index';
import { AdminAction } from '@/components/admin/AdminAction';
import { ActionCard, LoggedNote, SectionTitle } from '@/components/admin/AdminUi';
import { AuditTrail, type AuditEntry } from '@/components/admin/AuditTrail';
import { ConsentSummary } from '@/components/admin/ConsentSummary';
import { adminProfileLabels } from '@/components/admin/labels';
import { AccountStatusBadge, ListingBadge, RegistrationBadge, StatedAvailabilityBadge, VerificationStatusBadge, statedAvailability } from '@/components/admin/StatusBadges';
import { ProfileFields } from '@/components/DonorFormParts';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { clientValidationMessages } from '@/components/form/client-messages';
import { CheckboxField, RadioGroup, TextArea } from '@/components/form/fields';
import { Alert, Badge, BloodGroupBadge, Breadcrumbs } from '@/components/ui';
import { reviewProfileAction, reviewRegistrationAction, staffSetAvailabilityAction, staffSetListingAction, staffUpdateDonorAction } from '../../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.donor.title, robots: { index: false } };
}

const phone = (value: string | null | undefined) => (value && value.startsWith('+880') ? formatBdPhone(value) : '—');

type StatusCode = string | null | undefined;

/** Translates the status codes kept in audit metadata where the action tells us which kind they are. */
function codeLabel(t: Messages, action: string, code: StatusCode): string | null {
  if (typeof code !== 'string') return null;
  if (action.startsWith('staff.donor_registration_') && code in t.common.registrationStatus) return t.common.registrationStatus[code as keyof Messages['common']['registrationStatus']];
  if (/^staff\.donor_(restored|removed|deactivated)$/.test(action) && code in t.common.listingStatus) return t.common.listingStatus[code as keyof Messages['common']['listingStatus']];
  if (action === 'staff.availability_overridden' && (code === 'available' || code === 'unavailable' || code === 'unknown')) return t.common.availability[code];
  return code;
}

function auditDetails(t: Messages, action: string, metadata: Record<string, unknown>): string[] {
  const out: string[] = [];
  const from = codeLabel(t, action, metadata.from as StatusCode);
  const to = codeLabel(t, action, metadata.to as StatusCode);
  if (from && to) out.push(`${from} → ${to}`);
  if (Array.isArray(metadata.changed) && metadata.changed.length) {
    const fields = t.admin.activity.fields as Record<string, string>;
    out.push(t.admin.activity.changed(metadata.changed.map((c) => fields[String(c)] ?? String(c)).join(', ')));
  }
  if (metadata.verificationReset === true) out.push(t.admin.activity.verificationReset);
  if (typeof metadata.reason === 'string' && metadata.reason) out.push(`${t.admin.donor.hReason}: ${metadata.reason}`);
  return out;
}

export default async function AdminDonorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const actor = await requirePermission(`/admin/donors/${id}`, 'donors.review');
  const { t, n, date, instantDate, dateTime, locale } = await getI18n();
  let detail;
  try {
    detail = await getDonorForStaff(actor, id, await getRequestMeta());
  } catch {
    notFound();
  }
  const { donor, account, consent, availabilityHistory, verification, history, isSelf } = detail;
  const inServiceArea = donor.districtId === (await getServiceArea()).districtId;
  const created = (await searchParams).created === '1';
  const [index, locs] = await Promise.all([getLocationIndex(), compactLocations(locale)]);
  const d = t.admin.donor;
  const pending = t.common.actions.submitting;
  const stated = statedAvailability(donor);
  const actionLabels = t.admin.activity.actions as Record<string, string>;
  const availabilityValue = (v: string | null) => (v === 'available' || v === 'unavailable' || v === 'unknown' ? t.common.availability[v] : '—');
  const publiclyVisible = donor.registrationStatus === 'approved' && donor.status === 'active' && account?.status === 'active' && !!consent?.listedInSearch;
  const reasonField = (label: string = t.admin.reasonLabel) => ({ name: 'reason', label, hint: t.admin.reasonHint, required: true });
  const roleLabel = (role: string | null) => (role === 'admin' || role === 'moderator' ? t.common.roles[role] : null);
  const place = [donor.locality, labelFrom(index, locale, donor.upazilaId, donor.districtId, donor.divisionId)].filter(Boolean).join(', ');
  const canReview = !isSelf && can(actor, 'donors.review');
  const reviewWaiting = canReview && donor.registrationStatus === 'pending';
  const checks = clientValidationMessages(t);
  /** Changes stay in view; page openings (recorded because full numbers are shown) fold away. */
  const toEntry = ({ log, actorName }: (typeof history)[number]): AuditEntry => ({
    id: log.id,
    what: actionLabels[log.action] ?? log.action,
    who: actorName ?? t.admin.activity.system,
    role: roleLabel(log.actorRole),
    when: dateTime(log.createdAt),
    details: auditDetails(t, log.action, log.metadata),
  });
  const changes = history.filter((h) => !h.log.action.endsWith('_viewed')).map(toEntry);
  const views = history.filter((h) => h.log.action.endsWith('_viewed')).map(toEntry);

  /** Approve and/or "do not approve", depending on the current registration status. */
  const reviewForms = (
    <div className="action-split">
      {donor.registrationStatus !== 'approved' && (
        <AdminAction
          action={reviewRegistrationAction}
          hidden={{ donorId: donor.id, decision: 'approved' }}
          submit={d.approve}
          pending={pending}
          tone="primary"
          size="md"
          note={{ name: 'reason', label: t.admin.noteLabel, hint: t.admin.reasonHint }}
        />
      )}
      {donor.registrationStatus !== 'rejected' && (
        <details className="disclosure disclosure-danger">
          <summary>{d.reject}</summary>
          <AdminAction
            action={reviewRegistrationAction}
            hidden={{ donorId: donor.id, decision: 'rejected' }}
            submit={d.reject}
            pending={pending}
            tone="danger"
            size="md"
            note={reasonField(d.rejectReason)}
            confirm={d.rejectConfirm}
          />
        </details>
      )}
    </div>
  );

  return (
    <>
      <div className="stack-sm">
        <Breadcrumbs items={[{ href: '/admin/donors', label: t.admin.donors.title }]} label={t.common.nav.breadcrumbs} />
        <section className="card record-head" aria-labelledby="donor-name">
          <div className="record-id">
            <BloodGroupBadge group={donor.bloodGroup} label={t.common.bloodGroup} />
            <div style={{ minWidth: 0 }}>
              <h1 id="donor-name">{donor.fullName}</h1>
              <ul className="record-facts">
                <li>
                  <IdCard size={16} aria-hidden="true" />
                  <span className="visually-hidden">{d.publicId}</span>
                  {donor.publicId}
                </li>
                <li>
                  <Phone size={16} aria-hidden="true" />
                  <span className="visually-hidden">{d.contactPhone}</span>
                  {donor.contactPhone.startsWith('+880') ? (
                    <a className="phone" href={`tel:${donor.contactPhone}`}>
                      {phone(donor.contactPhone)}
                    </a>
                  ) : (
                    '—'
                  )}
                </li>
                {place && (
                  <li>
                    <MapPin size={16} aria-hidden="true" />
                    <span className="visually-hidden">{d.area}</span>
                    {place}
                  </li>
                )}
                <li>
                  <CalendarDays size={16} aria-hidden="true" />
                  <span className="visually-hidden">{d.registeredOn}</span>
                  {instantDate(donor.createdAt)}
                </li>
              </ul>
            </div>
          </div>

          <ul className="status-strip" aria-label={d.statusTitle}>
            <li>
              <span className="status-label">{d.registration}</span>
              <RegistrationBadge status={donor.registrationStatus} t={t} />
              {donor.registrationReviewedAt && <p className="status-note">{d.reviewedOn(instantDate(donor.registrationReviewedAt))}</p>}
              {donor.registrationNote && <p className="status-note">{donor.registrationNote}</p>}
            </li>
            <li>
              <span className="status-label">{d.listing}</span>
              <ListingBadge status={donor.status} t={t} />
              {donor.restrictedReason && (
                <p className="status-note">
                  {d.listingReason}: {donor.restrictedReason}
                </p>
              )}
            </li>
            <li>
              <span className="status-label">{d.availability}</span>
              <StatedAvailabilityBadge state={stated} source={donor.availabilitySource} t={t} />
              {donor.availabilityConfirmedAt && (
                <p className="status-note">
                  {/* The staff badge above already says who set it; otherwise say it here. */}
                  {donor.availabilitySource === 'staff' && stated !== 'unknown'
                    ? t.common.availability.lastUpdated(dateTime(donor.availabilityConfirmedAt))
                    : `${donor.availabilitySource === 'staff' ? t.common.availability.sourceStaff : t.common.availability.sourceDonor} · ${t.common.availability.lastUpdated(dateTime(donor.availabilityConfirmedAt))}`}
                </p>
              )}
            </li>
            <li>
              <span className="status-label">{d.verification}</span>
              <VerificationStatusBadge status={donor.verificationStatus} t={t} />
            </li>
          </ul>

          {account && account.status !== 'active' && (
            <p className="cluster-sm" style={{ margin: 0 }}>
              <span className="small muted">{d.accountStatus}</span>
              <AccountStatusBadge status={account.status} t={t} />
            </p>
          )}

          {(publiclyVisible || (account && can(actor, 'users.manage'))) && (
            <div className="record-links">
              {publiclyVisible && (
                <Link className="section-link" href={`/donors/${donor.publicId}`}>
                  {d.publicProfile}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
              {account && can(actor, 'users.manage') && (
                <Link className="section-link" href={`/admin/users/${account.id}`}>
                  {d.accountLink}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
            </div>
          )}
        </section>
        <LoggedNote>{d.loggedNote}</LoggedNote>
      </div>

      {created && (
        <Alert tone="success" live>
          {d.created}
        </Alert>
      )}

      {!inServiceArea && (
        <Alert tone="warning" title={d.outsideTitle}>
          <p>{d.outsideBody}</p>
        </Alert>
      )}

      {reviewWaiting && (
        <ActionCard icon={ClipboardCheck} title={d.reviewPending} intro={d.reviewIntro} tone="accent" headingLevel={2} id="review">
          {reviewForms}
        </ActionCard>
      )}

      <section className="stack" aria-labelledby="actions">
        <SectionTitle id="actions" icon={ListChecks}>
          {d.actionsTitle}
        </SectionTitle>
        {isSelf ? (
          <Alert tone="info">{d.selfNote}</Alert>
        ) : (
          <div className="action-cards">
            {canReview && !reviewWaiting && (
              <ActionCard icon={ClipboardCheck} title={d.reviewTitle} intro={d.reviewIntro} id="review-again">
                {reviewForms}
              </ActionCard>
            )}

            {can(actor, 'verifications.review') && (
              <ActionCard icon={BadgeCheck} title={d.verificationTitle} intro={d.verificationIntro} id="verification-change">
                <div className="action-split">
                  {donor.verificationStatus !== 'verified' && (
                    <AdminAction
                      action={reviewProfileAction}
                      hidden={{ donorId: donor.id, decision: 'verified' }}
                      submit={d.verify}
                      pending={pending}
                      tone="primary"
                      size="md"
                      note={{ name: 'note', label: t.admin.noteLabel, hint: t.admin.reasonHint }}
                    />
                  )}
                  {donor.verificationStatus !== 'rejected' && donor.verificationStatus !== 'unverified' && (
                    <AdminAction
                      action={reviewProfileAction}
                      hidden={{ donorId: donor.id, decision: 'rejected' }}
                      submit={d.rejectVerification}
                      pending={pending}
                      tone="danger"
                      size="md"
                      note={{ name: 'note', label: t.admin.noteLabel, hint: t.admin.reasonHint }}
                    />
                  )}
                </div>
              </ActionCard>
            )}

            {can(actor, 'donors.manage') && (
              <ActionCard icon={PencilLine} title={d.editTitle} intro={d.editIntro} wide id="edit-details">
                <details className="disclosure">
                  <summary>{d.editOpen}</summary>
                  <ActionForm action={staffUpdateDonorAction} aria-label={d.editTitle} clientMessages={checks}>
                    <input type="hidden" name="donorId" value={donor.id} />
                    <ProfileFields
                      labels={adminProfileLabels(t)}
                      locations={locs}
                      bloodGroups={[...BLOOD_GROUPS]}
                      maxDate={todayInBangladesh()}
                      withContactPhone
                      defaults={{
                        fullName: donor.fullName,
                        dateOfBirth: donor.dateOfBirth,
                        bloodGroup: donor.bloodGroup,
                        divisionId: donor.divisionId,
                        districtId: donor.districtId,
                        upazilaId: donor.upazilaId,
                        locality: donor.locality,
                        preferredContactMethod: donor.preferredContactMethod,
                        contactPhone: donor.contactPhone.replace(/^\+88/, ''),
                      }}
                    />
                    <TextArea name="reason" label={d.editReason} hint={t.admin.reasonHint} required maxLength={300} rows={2} />
                    <div className="form-actions">
                      <SubmitButton label={d.editSave} pendingLabel={t.common.actions.saving} />
                    </div>
                  </ActionForm>
                </details>
              </ActionCard>
            )}
          </div>
        )}
      </section>

      {!isSelf && (can(actor, 'donors.availability') || can(actor, 'donors.manage')) && (
        <section className="danger-zone stack" aria-labelledby="careful">
          <div>
            <SectionTitle id="careful" icon={TriangleAlert}>
              {d.carefulTitle}
            </SectionTitle>
            <p className="hint" style={{ marginTop: 'var(--space-1)' }}>
              {d.carefulIntro}
            </p>
          </div>
          <div className="action-cards">
            {can(actor, 'donors.availability') && (
              <ActionCard icon={HeartPulse} title={d.availabilityTitle} intro={d.availabilityIntro(t.common.availability.sourceStaff)} tone="danger" id="availability-change">
                <ActionForm action={staffSetAvailabilityAction} aria-label={d.availabilityTitle} clientMessages={checks}>
                  <input type="hidden" name="donorId" value={donor.id} />
                  <RadioGroup
                    name="status"
                    legend={d.availabilityChoice}
                    defaultValue={stated}
                    options={(['available', 'unavailable', 'unknown'] as const).map((s) => ({ value: s, label: t.common.availability[s] }))}
                  />
                  <TextArea name="reason" label={d.availabilityReason} hint={t.admin.reasonHint} required maxLength={300} rows={2} />
                  <CheckboxField name="confirm" label={d.availabilityConfirm} required />
                  <div className="form-actions">
                    <SubmitButton label={d.availabilitySave} pendingLabel={pending} className="btn btn-danger" />
                  </div>
                </ActionForm>
              </ActionCard>
            )}

            {can(actor, 'donors.manage') && (
              <ActionCard icon={ShieldCheck} title={d.listingTitle} intro={d.listingIntro} tone="danger" id="listing-change">
                {donor.status === 'paused' && <Alert tone="info">{d.pausedNote}</Alert>}
                <div className="stack-sm">
                  {(donor.status === 'restricted' || donor.status === 'removed') && (
                    <details className="disclosure">
                      <summary>{d.restore}</summary>
                      <p className="hint">{d.restoreHint}</p>
                      <AdminAction action={staffSetListingAction} hidden={{ donorId: donor.id, status: 'active' }} submit={d.restore} pending={pending} tone="primary" size="md" note={reasonField()} />
                    </details>
                  )}
                  {(donor.status === 'active' || donor.status === 'paused') && (
                    <details className="disclosure disclosure-danger">
                      <summary>{d.deactivate}</summary>
                      <p className="hint">{d.deactivateHint}</p>
                      <AdminAction
                        action={staffSetListingAction}
                        hidden={{ donorId: donor.id, status: 'restricted' }}
                        submit={d.deactivate}
                        pending={pending}
                        tone="danger"
                        size="md"
                        note={reasonField()}
                        confirm={d.confirmDeactivate}
                      />
                    </details>
                  )}
                  {donor.status !== 'removed' && (
                    <details className="disclosure disclosure-danger">
                      <summary>{d.remove}</summary>
                      <p className="hint">{d.removeHint}</p>
                      <AdminAction
                        action={staffSetListingAction}
                        hidden={{ donorId: donor.id, status: 'removed' }}
                        submit={d.remove}
                        pending={pending}
                        tone="danger"
                        size="md"
                        note={reasonField()}
                        confirm={d.confirmRemove}
                      />
                    </details>
                  )}
                </div>
              </ActionCard>
            )}
          </div>
        </section>
      )}

      <section className="stack" aria-labelledby="details">
        <SectionTitle id="details" icon={UserRound}>
          {d.detailsTitle}
        </SectionTitle>
        <div className="stack">
          <div className="card card-tight">
            <dl className="dl">
              <dt>{d.publicId}</dt>
              <dd>{donor.publicId}</dd>
              <dt>{d.fullName}</dt>
              <dd>{donor.fullName}</dd>
              <dt>{d.dateOfBirth}</dt>
              <dd>{date(donor.dateOfBirth)}</dd>
              <dt>{t.common.bloodGroup}</dt>
              <dd>
                <strong>{donor.bloodGroup}</strong>
              </dd>
              <dt>{d.area}</dt>
              <dd>{place}</dd>
              <dt>{d.contactPhone}</dt>
              <dd>
                <span className="phone-reveal">{phone(donor.contactPhone)}</span>
              </dd>
              <dt>{d.loginPhone}</dt>
              <dd>{phone(account?.phone)}</dd>
              <dt>{d.preferredContact}</dt>
              <dd>{t.common.contactMethod[donor.preferredContactMethod]}</dd>
              <dt>{d.registeredOn}</dt>
              <dd>{instantDate(donor.createdAt)}</dd>
              {account && (
                <>
                  <dt>{d.accountStatus}</dt>
                  <dd>{t.common.accountStatus[account.status]}</dd>
                  <dt>{d.lastSignIn}</dt>
                  <dd>{account.lastSignInAt ? dateTime(account.lastSignInAt) : t.admin.never}</dd>
                </>
              )}
            </dl>
          </div>
          {consent && (
            <div className="card card-tight stack-sm">
              <h3 className="cluster-sm" style={{ fontSize: '1.02rem', margin: 0 }}>
                <Lock size={18} className="icon-brand" aria-hidden="true" />
                {t.admin.consent.title}
              </h3>
              <ConsentSummary consent={consent} t={t} instantDate={instantDate} />
            </div>
          )}
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          {t.common.availability.explain}
        </p>
      </section>

      <section className="stack" aria-labelledby="history">
        <div>
          <SectionTitle id="history" icon={History}>
            {d.historyTitle}
          </SectionTitle>
          <p className="hint" style={{ marginTop: 'var(--space-1)' }}>
            {d.historyIntro}
          </p>
        </div>
        <AuditTrail entries={changes} empty={d.historyEmpty} moreLabel={(count) => d.historyMore(n(count))} />
        <div className="history-list">
          <details className="disclosure">
            <summary>
              <span className="cluster-sm">
                <HeartPulse size={18} aria-hidden="true" />
                {d.availabilityHistoryTitle}
              </span>
              <Badge>{n(availabilityHistory.length)}</Badge>
            </summary>
            {availabilityHistory.length === 0 ? (
              <p className="history-empty">{d.historyEmpty}</p>
            ) : (
              <div className="table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">{d.hWhen}</th>
                      <th scope="col">{d.hValue}</th>
                      <th scope="col">{d.hBy}</th>
                      <th scope="col">{d.hPrevious}</th>
                      <th scope="col">{d.hReason}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availabilityHistory.map(({ update, setByName }) => (
                      <tr key={update.id}>
                        <td className="cell-main">{dateTime(update.confirmedAt)}</td>
                        <td data-label={d.hValue}>
                          <strong>{availabilityValue(update.status)}</strong>
                        </td>
                        <td data-label={d.hBy}>
                          <span>
                            {update.source === 'staff' ? t.common.availability.sourceStaff : t.common.availability.sourceDonor}
                            {update.source === 'staff' && setByName && <span className="cell-sub">{setByName}</span>}
                          </span>
                        </td>
                        <td data-label={d.hPrevious}>{availabilityValue(update.previousStatus)}</td>
                        <td data-label={d.hReason}>{update.reason ?? update.note ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </details>

          <details className="disclosure">
            <summary>
              <span className="cluster-sm">
                <BadgeCheck size={18} aria-hidden="true" />
                {d.verificationHistoryTitle}
              </span>
              <Badge>{n(verification.length)}</Badge>
            </summary>
            {verification.length === 0 ? (
              <p className="history-empty">{d.historyEmpty}</p>
            ) : (
              <div className="table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">{d.hWhen}</th>
                      <th scope="col">{d.hChange}</th>
                      <th scope="col">{t.admin.activity.who}</th>
                      <th scope="col">{d.hNote}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verification.map(({ event, actorName }) => (
                      <tr key={event.id}>
                        <td className="cell-main">{dateTime(event.createdAt)}</td>
                        <td data-label={d.hChange}>
                          {t.common.verification[event.fromStatus]} → {t.common.verification[event.toStatus]}
                        </td>
                        <td data-label={t.admin.activity.who}>{actorName ?? t.admin.activity.system}</td>
                        <td data-label={d.hNote}>{event.note ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </details>

          <details className="disclosure">
            <summary>
              <span className="cluster-sm">
                <ScrollText size={18} aria-hidden="true" />
                {d.viewsTitle}
              </span>
              <Badge>{n(views.length)}</Badge>
            </summary>
            {views.length === 0 ? (
              <p className="history-empty">{d.historyEmpty}</p>
            ) : (
              <AuditTrail entries={views} empty={d.historyEmpty} moreLabel={(count) => d.historyMore(n(count))} />
            )}
          </details>
        </div>
      </section>
    </>
  );
}
