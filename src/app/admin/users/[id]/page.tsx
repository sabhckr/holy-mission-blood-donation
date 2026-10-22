import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { formatBdPhone } from '@/server/domain/phone';
import { getRequestMeta } from '@/server/security/request-meta';
import { getUserDetail } from '@/server/services/admin';
import { getLocationIndex, labelFrom } from '@/server/services/location-index';
import { can } from '@/server/policy';
import { AdminAction } from '@/components/admin/AdminAction';
import { OneTimeValue } from '@/components/admin/AdminForms';
import { ConsentSummary } from '@/components/admin/ConsentSummary';
import { ListingBadge, RegistrationBadge, StatedAvailabilityBadge, statedAvailability } from '@/components/admin/StatusBadges';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { RadioGroup, TextField } from '@/components/form/fields';
import { Alert, Badge, Breadcrumbs, VerificationBadge } from '@/components/ui';
import { issueResetAction, processDeletionAction, reviewDonationAction, revokeSessionsAction, setUserRoleAction, setUserStatusAction, voidDonationAction } from '../../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.user.title, robots: { index: false } };
}

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const actor = await requirePermission(`/admin/users/${id}`, 'users.manage');
  const i18n = await getI18n();
  const { t, n, date, instantDate, dateTime, locale } = i18n;
  const meta = await getRequestMeta();
  let detail;
  try {
    detail = await getUserDetail(actor, id, meta);
  } catch {
    notFound();
  }
  const { user, donor, consent, memberships, sessionCount, deletion, donations } = detail;
  const index = await getLocationIndex();
  const u = t.admin.user;
  const pending = t.common.actions.submitting;
  const self = user.id === actor.userId;
  const deleted = user.status === 'deleted';
  const pendingDeletion = deletion.find((d) => d.status === 'pending');
  const noteField = { name: 'note', label: t.admin.noteLabel, hint: t.admin.reasonHint };
  const reasonField = { name: 'reason', label: t.admin.reasonLabel, hint: t.admin.reasonHint };

  return (
    <>
      <header className="stack-sm">
        <Breadcrumbs items={[{ href: '/admin/users', label: t.admin.users.title }]} label={t.common.nav.breadcrumbs} />
        <h1>{user.displayName}</h1>
        <div className="cluster-sm">
          <Badge tone={user.role === 'user' ? 'neutral' : 'info'}>{t.common.roles[user.role]}</Badge>
          <Badge tone={user.status === 'active' ? 'success' : user.status === 'suspended' ? 'danger' : 'neutral'}>{t.common.accountStatus[user.status]}</Badge>
        </div>
      </header>
      <Alert tone="info">{u.loggedNote}</Alert>
      {deleted && <Alert tone="warning">{u.deletedAccount}</Alert>}

      <section className="card stack-sm" aria-labelledby="account">
        <h2 id="account">{u.accountTitle}</h2>
        <dl className="dl">
          <dt>{u.phone}</dt>
          <dd>{user.phone.startsWith('+880') ? <span className="phone-reveal">{formatBdPhone(user.phone)}</span> : '—'}</dd>
          <dt>{u.email}</dt>
          <dd>{user.email ?? t.admin.none}</dd>
          <dt>{u.role}</dt>
          <dd>{t.common.roles[user.role]}</dd>
          <dt>{u.status}</dt>
          <dd>{t.common.accountStatus[user.status]}</dd>
          <dt>{u.createdAt}</dt>
          <dd>{instantDate(user.createdAt)}</dd>
          <dt>{u.lastSignIn}</dt>
          <dd>{user.lastSignInAt ? dateTime(user.lastSignInAt) : t.admin.never}</dd>
          <dt>{u.sessions}</dt>
          <dd>{n(sessionCount)}</dd>
        </dl>
      </section>

      <section className="card stack" aria-labelledby="donor">
        <h2 id="donor">{u.donorTitle}</h2>
        {!donor ? (
          <p className="muted">{u.noDonor}</p>
        ) : (
          <>
            <dl className="dl">
              <dt>{u.fullName}</dt>
              <dd>{donor.fullName}</dd>
              <dt>{u.dateOfBirth}</dt>
              <dd>{date(donor.dateOfBirth)}</dd>
              <dt>{t.common.bloodGroup}</dt>
              <dd>
                <strong>{donor.bloodGroup}</strong>
              </dd>
              <dt>{u.location}</dt>
              <dd>{[donor.locality, labelFrom(index, locale, donor.upazilaId, donor.districtId, donor.divisionId)].filter(Boolean).join(', ')}</dd>
              <dt>{u.contactPhone}</dt>
              <dd>{donor.contactPhone.startsWith('+880') ? formatBdPhone(donor.contactPhone) : '—'}</dd>
              <dt>{u.registration}</dt>
              <dd>
                <RegistrationBadge status={donor.registrationStatus} t={t} />
              </dd>
              <dt>{u.listing}</dt>
              <dd>
                <ListingBadge status={donor.status} t={t} />
              </dd>
              {donor.restrictedReason && (
                <>
                  <dt>{u.restrictedReason}</dt>
                  <dd>{donor.restrictedReason}</dd>
                </>
              )}
              <dt>{u.availability}</dt>
              <dd>
                <StatedAvailabilityBadge state={statedAvailability(donor)} source={donor.availabilitySource} t={t} />
              </dd>
              <dt>{u.verification}</dt>
              <dd>
                <VerificationBadge status={donor.verificationStatus} t={t} />
              </dd>
            </dl>
            <p className="hint">{u.donorRecordHint}</p>
            <p className="cluster">
              {can(actor, 'donors.review') && (
                <Link className="btn btn-sm btn-primary" href={`/admin/donors/${donor.id}`}>
                  {u.openDonorRecord}
                </Link>
              )}
              {donor.registrationStatus === 'approved' && donor.status === 'active' && user.status === 'active' && consent?.listedInSearch && (
                <Link href={`/donors/${donor.publicId}`}>{u.publicProfile}</Link>
              )}
            </p>
            {consent && (
              <>
                <h3>{t.admin.consent.title}</h3>
                <ConsentSummary consent={consent} t={t} instantDate={instantDate} />
              </>
            )}
          </>
        )}
      </section>

      <section className="card stack-sm" aria-labelledby="memberships">
        <h2 id="memberships">{u.membershipsTitle}</h2>
        {memberships.length === 0 ? (
          <p className="muted">{u.noMemberships}</p>
        ) : (
          <ul className="list-plain list-divided">
            {memberships.map((m) => (
              <li key={m.membership.id} className="cluster between">
                <Link href={`/communities/${m.communitySlug}`}>{m.communityName}</Link>
                <span className="cluster-sm">
                  <Badge>{t.common.roles[m.membership.role]}</Badge>
                  <Badge tone={m.membership.status === 'active' ? 'success' : 'neutral'}>{u.membershipStatus[m.membership.status]}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {donor && (
        <section className="stack" aria-labelledby="donations">
          <h2 id="donations">{u.donationsTitle}</h2>
          {donations.length === 0 ? (
            <p className="muted">{u.noDonations}</p>
          ) : (
            <ul className="list-plain stack">
              {donations.map((d) => (
                <li key={d.id} className="card card-tight stack-sm">
                  <div className="cluster between">
                    <strong>
                      {date(d.donatedOn)} · {t.common.donationType[d.donationType]}
                    </strong>
                    <span className="cluster-sm">
                      <Badge>{t.common.donationSource[d.source]}</Badge>
                      <VerificationBadge status={d.status} t={t} />
                    </span>
                  </div>
                  {d.place && <p className="small muted" style={{ margin: 0 }}>{d.place}</p>}
                  {d.voidedReason && <p className="small muted" style={{ margin: 0 }}>{d.voidedReason}</p>}
                  {!self && (d.status === 'pending' || d.status === 'unverified') && (
                    <details className="disclosure">
                      <summary>
                        {u.verify} / {u.reject}
                      </summary>
                      <div className="grid grid-2">
                        <AdminAction action={reviewDonationAction} hidden={{ donationId: d.id, decision: 'verified' }} submit={u.verify} pending={pending} tone="primary" note={noteField} />
                        <AdminAction action={reviewDonationAction} hidden={{ donationId: d.id, decision: 'rejected' }} submit={u.reject} pending={pending} tone="danger" note={noteField} />
                      </div>
                    </details>
                  )}
                  {d.status !== 'voided' && (
                    <details className="disclosure">
                      <summary>{u.withdraw}</summary>
                      <AdminAction action={voidDonationAction} hidden={{ donationId: d.id }} submit={u.withdraw} pending={pending} tone="danger" note={{ ...reasonField, label: u.withdrawReason, required: true }} />
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!deleted && (
        <section className="stack" aria-labelledby="actions">
          <h2 id="actions">{u.actionsTitle}</h2>
          {self ? (
            <Alert tone="info">{u.ownAccount}</Alert>
          ) : (
            <>
              <details className="disclosure">
                <summary>{u.suspendTitle}</summary>
                <p className="hint">{u.suspendHint}</p>
                {user.status === 'suspended' ? (
                  <AdminAction action={setUserStatusAction} hidden={{ userId: user.id, status: 'active' }} submit={u.reinstate} pending={pending} tone="primary" note={reasonField} />
                ) : (
                  <AdminAction action={setUserStatusAction} hidden={{ userId: user.id, status: 'suspended' }} submit={u.suspend} pending={pending} tone="danger" note={reasonField} />
                )}
              </details>
              <details className="disclosure">
                <summary>{u.roleTitle}</summary>
                <p className="hint">{u.roleIntro}</p>
                <ActionForm action={setUserRoleAction} className="stack-sm" aria-label={u.roleTitle}>
                  <input type="hidden" name="userId" value={user.id} />
                  <RadioGroup
                    name="role"
                    legend={u.newRole}
                    hint={u.roleHint}
                    defaultValue={user.role}
                    options={(['user', 'moderator', 'admin'] as const).map((r) => ({ value: r, label: t.common.roles[r] }))}
                  />
                  <TextField name="password" type="password" label={t.admin.yourPassword} hint={t.admin.yourPasswordHint} autoComplete="current-password" required maxLength={128} />
                  <div className="form-actions">
                    <SubmitButton label={u.changeRole} pendingLabel={pending} className="btn btn-primary btn-sm" />
                  </div>
                </ActionForm>
              </details>
              <details className="disclosure">
                <summary>{u.sessionsTitle}</summary>
                <AdminAction action={revokeSessionsAction} hidden={{ userId: user.id }} submit={u.revokeSessions} pending={pending} tone="danger" />
              </details>
              <details className="disclosure">
                <summary>{u.resetTitle}</summary>
                <p className="hint">{u.resetIntro}</p>
                <AdminAction action={issueResetAction} hidden={{ userId: user.id }} submit={u.issueReset} pending={pending}>
                  <OneTimeValue dataKey="link" label={u.resetLink} hint={u.resetCopyHint} warning={u.resetWarning} />
                </AdminAction>
              </details>
              <details className="disclosure" open={!!pendingDeletion}>
                <summary>{u.deletionTitle}</summary>
                {pendingDeletion ? (
                  <div className="stack-sm">
                    <p>{u.deletionPending(instantDate(pendingDeletion.createdAt))}</p>
                    {pendingDeletion.reason && <p className="muted">{pendingDeletion.reason}</p>}
                    <AdminAction
                      action={processDeletionAction}
                      hidden={{ requestId: pendingDeletion.id }}
                      submit={t.admin.deletions.process}
                      pending={pending}
                      tone="danger"
                      confirm={t.admin.deletions.confirm}
                    />
                  </div>
                ) : (
                  <p className="muted">{u.deletionNone}</p>
                )}
              </details>
            </>
          )}
        </section>
      )}
    </>
  );
}
