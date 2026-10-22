import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getI18n } from '@/i18n/server';
import type { Messages } from '@/i18n/messages';
import { requirePermission } from '@/server/auth/current';
import { BLOOD_GROUPS } from '@/server/domain/constants';
import { todayInBangladesh } from '@/server/domain/dates';
import { formatBdPhone } from '@/server/domain/phone';
import { can } from '@/server/policy';
import { getRequestMeta } from '@/server/security/request-meta';
import { getDonorForStaff } from '@/server/services/donor-admin';
import { compactLocations, getLocationIndex, labelFrom } from '@/server/services/location-index';
import { AdminAction } from '@/components/admin/AdminAction';
import { ConsentSummary } from '@/components/admin/ConsentSummary';
import { adminProfileLabels } from '@/components/admin/labels';
import { ListingBadge, RegistrationBadge, StatedAvailabilityBadge, statedAvailability } from '@/components/admin/StatusBadges';
import { ProfileFields } from '@/components/DonorFormParts';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { RadioGroup, TextArea } from '@/components/form/fields';
import { Alert, Badge, Breadcrumbs, EmptyState, VerificationBadge } from '@/components/ui';
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
  const { t, date, instantDate, dateTime, locale } = await getI18n();
  let detail;
  try {
    detail = await getDonorForStaff(actor, id, await getRequestMeta());
  } catch {
    notFound();
  }
  const { donor, account, consent, availabilityHistory, verification, history, isSelf } = detail;
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

  return (
    <>
      <header className="stack-sm">
        <Breadcrumbs items={[{ href: '/admin/donors', label: t.admin.donors.title }]} label={t.common.nav.breadcrumbs} />
        <h1>{donor.fullName}</h1>
        <div className="cluster-sm">
          <Badge tone="neutral">
            {t.common.bloodGroup}: {donor.bloodGroup}
          </Badge>
          <RegistrationBadge status={donor.registrationStatus} t={t} />
          <ListingBadge status={donor.status} t={t} />
          <StatedAvailabilityBadge state={stated} source={donor.availabilitySource} t={t} />
          <VerificationBadge status={donor.verificationStatus} t={t} />
          {account && account.status !== 'active' && <Badge tone="danger">{t.common.accountStatus[account.status]}</Badge>}
        </div>
      </header>

      {created && (
        <Alert tone="success" live>
          {d.created}
        </Alert>
      )}
      <Alert tone="info">{d.loggedNote}</Alert>

      <section className="card stack-sm" aria-labelledby="details">
        <h2 id="details">{d.detailsTitle}</h2>
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
          <dd>{[donor.locality, labelFrom(index, locale, donor.upazilaId, donor.districtId, donor.divisionId)].filter(Boolean).join(', ')}</dd>
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
        <div className="cluster">
          {publiclyVisible && <Link href={`/donors/${donor.publicId}`}>{d.publicProfile}</Link>}
          {account && can(actor, 'users.manage') && <Link href={`/admin/users/${account.id}`}>{d.accountLink}</Link>}
        </div>
      </section>

      <section className="card stack-sm" aria-labelledby="status">
        <h2 id="status">{d.statusTitle}</h2>
        <dl className="dl">
          <dt>{d.registration}</dt>
          <dd className="stack-sm">
            <span>
              <RegistrationBadge status={donor.registrationStatus} t={t} />
            </span>
            {donor.registrationReviewedAt && <span className="small muted">{d.reviewedOn(instantDate(donor.registrationReviewedAt))}</span>}
          </dd>
          {donor.registrationNote && (
            <>
              <dt>{d.registrationNote}</dt>
              <dd>{donor.registrationNote}</dd>
            </>
          )}
          <dt>{d.listing}</dt>
          <dd>
            <ListingBadge status={donor.status} t={t} />
          </dd>
          {donor.restrictedReason && (
            <>
              <dt>{d.listingReason}</dt>
              <dd>{donor.restrictedReason}</dd>
            </>
          )}
          <dt>{d.availability}</dt>
          <dd className="stack-sm">
            <span>
              <StatedAvailabilityBadge state={stated} source={donor.availabilitySource} t={t} />
            </span>
            {donor.availabilityConfirmedAt && (
              <span className="small muted">
                {donor.availabilitySource === 'staff' ? t.common.availability.sourceStaff : t.common.availability.sourceDonor} ·{' '}
                {t.common.availability.lastUpdated(dateTime(donor.availabilityConfirmedAt))}
              </span>
            )}
          </dd>
          <dt>{d.verification}</dt>
          <dd>
            <VerificationBadge status={donor.verificationStatus} t={t} />
          </dd>
        </dl>
        <p className="small muted">{t.common.availability.explain}</p>
      </section>

      {consent && (
        <section className="card stack-sm" aria-labelledby="consent">
          <h2 id="consent">{t.admin.consent.title}</h2>
          <ConsentSummary consent={consent} t={t} instantDate={instantDate} />
        </section>
      )}

      <section className="stack" aria-labelledby="actions">
        <h2 id="actions">{d.actionsTitle}</h2>
        {isSelf ? (
          <Alert tone="info">{d.selfNote}</Alert>
        ) : (
          <>
            {can(actor, 'donors.review') && (
              <div className="card stack-sm">
                <h3>{d.reviewTitle}</h3>
                <p className="hint">{d.reviewIntro}</p>
                <div className="grid grid-2">
                  {donor.registrationStatus !== 'approved' && (
                    <AdminAction
                      action={reviewRegistrationAction}
                      hidden={{ donorId: donor.id, decision: 'approved' }}
                      submit={d.approve}
                      pending={pending}
                      tone="primary"
                      note={{ name: 'reason', label: t.admin.noteLabel, hint: t.admin.reasonHint }}
                    />
                  )}
                  {donor.registrationStatus !== 'rejected' && (
                    <details className="disclosure">
                      <summary>{d.reject}</summary>
                      <AdminAction
                        action={reviewRegistrationAction}
                        hidden={{ donorId: donor.id, decision: 'rejected' }}
                        submit={d.reject}
                        pending={pending}
                        tone="danger"
                        note={reasonField(d.rejectReason)}
                        confirm={d.rejectConfirm}
                      />
                    </details>
                  )}
                </div>
              </div>
            )}

            {can(actor, 'donors.availability') && (
              <div className="card stack-sm">
                <h3>{d.availabilityTitle}</h3>
                <p className="hint">{d.availabilityIntro(t.common.availability.sourceStaff)}</p>
                <ActionForm action={staffSetAvailabilityAction} aria-label={d.availabilityTitle}>
                  <input type="hidden" name="donorId" value={donor.id} />
                  <RadioGroup
                    name="status"
                    legend={d.availabilityChoice}
                    defaultValue={stated}
                    options={(['available', 'unavailable', 'unknown'] as const).map((s) => ({ value: s, label: t.common.availability[s] }))}
                  />
                  <TextArea name="reason" label={d.availabilityReason} hint={t.admin.reasonHint} required maxLength={300} rows={2} />
                  <div className="form-actions">
                    <SubmitButton label={d.availabilitySave} pendingLabel={pending} className="btn btn-primary btn-sm" />
                  </div>
                </ActionForm>
              </div>
            )}

            {can(actor, 'donors.manage') && (
              <div className="card stack-sm">
                <h3>{d.listingTitle}</h3>
                <p className="hint">{d.listingIntro}</p>
                {donor.status === 'paused' && <Alert tone="info">{d.pausedNote}</Alert>}
                <div className="stack-sm">
                  {(donor.status === 'restricted' || donor.status === 'removed') && (
                    <details className="disclosure">
                      <summary>{d.restore}</summary>
                      <p className="hint">{d.restoreHint}</p>
                      <AdminAction action={staffSetListingAction} hidden={{ donorId: donor.id, status: 'active' }} submit={d.restore} pending={pending} tone="primary" note={reasonField()} />
                    </details>
                  )}
                  {(donor.status === 'active' || donor.status === 'paused') && (
                    <details className="disclosure">
                      <summary>{d.deactivate}</summary>
                      <p className="hint">{d.deactivateHint}</p>
                      <AdminAction
                        action={staffSetListingAction}
                        hidden={{ donorId: donor.id, status: 'restricted' }}
                        submit={d.deactivate}
                        pending={pending}
                        tone="danger"
                        note={reasonField()}
                        confirm={d.confirmDeactivate}
                      />
                    </details>
                  )}
                  {donor.status !== 'removed' && (
                    <details className="disclosure">
                      <summary>{d.remove}</summary>
                      <p className="hint">{d.removeHint}</p>
                      <AdminAction
                        action={staffSetListingAction}
                        hidden={{ donorId: donor.id, status: 'removed' }}
                        submit={d.remove}
                        pending={pending}
                        tone="danger"
                        note={reasonField()}
                        confirm={d.confirmRemove}
                      />
                    </details>
                  )}
                </div>
              </div>
            )}

            {can(actor, 'donors.manage') && (
              <details className="disclosure">
                <summary>{d.editTitle}</summary>
                <ActionForm action={staffUpdateDonorAction} aria-label={d.editTitle}>
                  <p className="hint">{d.editIntro}</p>
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
            )}

            {can(actor, 'verifications.review') && (
              <div className="card stack-sm">
                <h3>{d.verificationTitle}</h3>
                <p className="hint">{d.verificationIntro}</p>
                <div className="grid grid-2">
                  {donor.verificationStatus !== 'verified' && (
                    <AdminAction
                      action={reviewProfileAction}
                      hidden={{ donorId: donor.id, decision: 'verified' }}
                      submit={d.verify}
                      pending={pending}
                      tone="primary"
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
                      note={{ name: 'note', label: t.admin.noteLabel, hint: t.admin.reasonHint }}
                    />
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className="stack-sm" aria-labelledby="availability-history">
        <h2 id="availability-history">{d.availabilityHistoryTitle}</h2>
        {availabilityHistory.length === 0 ? (
          <EmptyState title={d.historyEmpty} />
        ) : (
          <div className="table-wrap">
            <table>
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
                    <td>{dateTime(update.confirmedAt)}</td>
                    <td>{availabilityValue(update.status)}</td>
                    <td>
                      {update.source === 'staff' ? t.common.availability.sourceStaff : t.common.availability.sourceDonor}
                      {update.source === 'staff' && setByName && <span className="small muted"> · {setByName}</span>}
                    </td>
                    <td>{availabilityValue(update.previousStatus)}</td>
                    <td>{update.reason ?? update.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="stack-sm" aria-labelledby="verification-history">
        <h2 id="verification-history">{d.verificationHistoryTitle}</h2>
        {verification.length === 0 ? (
          <EmptyState title={d.historyEmpty} />
        ) : (
          <div className="table-wrap">
            <table>
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
                    <td>{dateTime(event.createdAt)}</td>
                    <td>
                      {t.common.verification[event.fromStatus]} → {t.common.verification[event.toStatus]}
                    </td>
                    <td>{actorName ?? t.admin.activity.system}</td>
                    <td>{event.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="stack-sm" aria-labelledby="audit-history">
        <h2 id="audit-history">{d.auditTitle}</h2>
        {history.length === 0 ? (
          <EmptyState title={d.historyEmpty} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">{d.hWhen}</th>
                  <th scope="col">{t.admin.activity.who}</th>
                  <th scope="col">{t.admin.activity.what}</th>
                  <th scope="col">{t.admin.activity.details}</th>
                </tr>
              </thead>
              <tbody>
                {history.map(({ log, actorName }) => {
                  const role = roleLabel(log.actorRole);
                  const details = auditDetails(t, log.action, log.metadata);
                  return (
                    <tr key={log.id}>
                      <td>{dateTime(log.createdAt)}</td>
                      <td>
                        {actorName ?? t.admin.activity.system}
                        {role && <span className="small muted"> · {role}</span>}
                      </td>
                      <td>{actionLabels[log.action] ?? log.action}</td>
                      <td>
                        {details.length === 0
                          ? '—'
                          : details.map((line) => (
                              <div key={line} className="small">
                                {line}
                              </div>
                            ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
