import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Ban, BadgeCheck, Building2, CalendarDays, Droplets, History, KeyRound, ListChecks, LogOut, Mail, Phone, ShieldCheck, TriangleAlert, UserRound, UserX } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import type { Messages } from '@/i18n/messages';
import { requirePermission } from '@/server/auth/current';
import { formatBdPhone } from '@/server/domain/phone';
import { getRequestMeta } from '@/server/security/request-meta';
import { getUserDetail, searchAuditLog } from '@/server/services/admin';
import { getLocationIndex, labelFrom } from '@/server/services/location-index';
import { can } from '@/server/policy';
import { AdminAction } from '@/components/admin/AdminAction';
import { OneTimeValue } from '@/components/admin/AdminForms';
import { ActionCard, LoggedNote, SectionTitle } from '@/components/admin/AdminUi';
import { AuditTrail, type AuditEntry } from '@/components/admin/AuditTrail';
import { ConsentSummary } from '@/components/admin/ConsentSummary';
import { AccountStatusBadge, ListingBadge, RegistrationBadge, StatedAvailabilityBadge, VerificationStatusBadge, statedAvailability } from '@/components/admin/StatusBadges';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { clientValidationMessages } from '@/components/form/client-messages';
import { CheckboxField, RadioGroup, TextField } from '@/components/form/fields';
import { Alert, Badge, BloodGroupBadge, Breadcrumbs } from '@/components/ui';
import { issueResetAction, processDeletionAction, reviewDonationAction, revokeSessionsAction, setUserRoleAction, setUserStatusAction, voidDonationAction } from '../../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.user.title, robots: { index: false } };
}

/** "From → to" and the reason, for account changes recorded in the audit log. */
function accountDetails(t: Messages, action: string, metadata: Record<string, unknown>): string[] {
  const out: string[] = [];
  const word = (code: unknown): string | null => {
    if (typeof code !== 'string') return null;
    if (code in t.common.roles) return t.common.roles[code as keyof Messages['common']['roles']];
    if (code in t.common.accountStatus) return t.common.accountStatus[code as keyof Messages['common']['accountStatus']];
    return code;
  };
  const from = word(metadata.from);
  const to = action === 'admin.user_suspended' ? t.common.accountStatus.suspended : action === 'admin.user_reinstated' ? t.common.accountStatus.active : word(metadata.to);
  if (from && to) out.push(`${from} → ${to}`);
  if (typeof metadata.reason === 'string' && metadata.reason) out.push(`${t.admin.donor.hReason}: ${metadata.reason}`);
  return out;
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
  const [index, audit] = await Promise.all([getLocationIndex(), searchAuditLog(actor, { targetType: 'user', targetId: user.id, page: 1 })]);
  const u = t.admin.user;
  const pending = t.common.actions.submitting;
  const checks = clientValidationMessages(t);
  const self = user.id === actor.userId;
  const deleted = user.status === 'deleted';
  const pendingDeletion = deletion.find((d) => d.status === 'pending');
  const noteField = { name: 'note', label: t.admin.noteLabel, hint: t.admin.reasonHint };
  const reasonField = { name: 'reason', label: t.admin.reasonLabel, hint: t.admin.reasonHint };
  const actionLabels = t.admin.activity.actions as Record<string, string>;
  const roleLabel = (role: string | null) => (role === 'admin' || role === 'moderator' ? t.common.roles[role] : null);
  const toEntry = ({ log, actorName }: (typeof audit.items)[number]): AuditEntry => ({
    id: log.id,
    what: actionLabels[log.action] ?? log.action,
    who: actorName ?? t.admin.activity.system,
    role: roleLabel(log.actorRole),
    when: dateTime(log.createdAt),
    details: accountDetails(t, log.action, log.metadata),
  });
  const changes = audit.items.filter((h) => !h.log.action.endsWith('_viewed')).map(toEntry);
  const views = audit.items.filter((h) => h.log.action.endsWith('_viewed')).map(toEntry);

  return (
    <>
      <div className="stack-sm">
        <Breadcrumbs items={[{ href: '/admin/users', label: t.admin.users.title }]} label={t.common.nav.breadcrumbs} />
        <section className="card record-head" aria-labelledby="user-name">
          <div className="record-id">
            <span className="admin-head-icon">
              <UserRound size={26} aria-hidden="true" />
            </span>
            <div style={{ minWidth: 0 }}>
              <h1 id="user-name">{user.displayName}</h1>
              <ul className="record-facts">
                <li>
                  <Phone size={16} aria-hidden="true" />
                  <span className="visually-hidden">{u.phone}</span>
                  {user.phone.startsWith('+880') ? (
                    <a className="phone" href={`tel:${user.phone}`}>
                      {formatBdPhone(user.phone)}
                    </a>
                  ) : (
                    '—'
                  )}
                </li>
                <li>
                  <Mail size={16} aria-hidden="true" />
                  <span className="visually-hidden">{u.email}</span>
                  {user.email ?? t.admin.none}
                </li>
                <li>
                  <CalendarDays size={16} aria-hidden="true" />
                  <span className="visually-hidden">{u.createdAt}</span>
                  {instantDate(user.createdAt)}
                </li>
              </ul>
            </div>
          </div>
          <ul className="status-strip" aria-label={u.accountTitle}>
            <li>
              <span className="status-label">{u.role}</span>
              <Badge tone={user.role === 'user' ? 'neutral' : 'info'}>
                <ShieldCheck size={14} aria-hidden="true" />
                {t.common.roles[user.role]}
              </Badge>
            </li>
            <li>
              <span className="status-label">{u.status}</span>
              <AccountStatusBadge status={user.status} t={t} />
            </li>
            <li>
              <span className="status-label">{u.sessions}</span>
              <strong>{n(sessionCount)}</strong>
            </li>
            <li>
              <span className="status-label">{u.lastSignIn}</span>
              <span className="status-note">{user.lastSignInAt ? dateTime(user.lastSignInAt) : t.admin.never}</span>
            </li>
          </ul>
        </section>
        <LoggedNote>{u.loggedNote}</LoggedNote>
      </div>
      {deleted && <Alert tone="warning">{u.deletedAccount}</Alert>}

      <section className="card stack" aria-labelledby="donor">
        <h2 id="donor" className="admin-section-title">
          <Droplets size={20} aria-hidden="true" />
          {u.donorTitle}
        </h2>
        {!donor ? (
          <p className="muted" style={{ margin: 0 }}>
            {u.noDonor}
          </p>
        ) : (
          <>
            <div className="donor-cell">
              <BloodGroupBadge group={donor.bloodGroup} label={t.common.bloodGroup} />
              <div>
                <strong>{donor.fullName}</strong>
                <span className="cell-sub">{[donor.locality, labelFrom(index, locale, donor.upazilaId, donor.districtId, donor.divisionId)].filter(Boolean).join(', ')}</span>
              </div>
            </div>
            <ul className="status-strip" aria-label={u.donorTitle}>
              <li>
                <span className="status-label">{u.registration}</span>
                <RegistrationBadge status={donor.registrationStatus} t={t} />
              </li>
              <li>
                <span className="status-label">{u.listing}</span>
                <ListingBadge status={donor.status} t={t} />
                {donor.restrictedReason && (
                  <p className="status-note">
                    {u.restrictedReason}: {donor.restrictedReason}
                  </p>
                )}
              </li>
              <li>
                <span className="status-label">{u.availability}</span>
                <StatedAvailabilityBadge state={statedAvailability(donor)} source={donor.availabilitySource} t={t} />
              </li>
              <li>
                <span className="status-label">{u.verification}</span>
                <VerificationStatusBadge status={donor.verificationStatus} t={t} />
              </li>
            </ul>
            <dl className="dl">
              <dt>{u.dateOfBirth}</dt>
              <dd>{date(donor.dateOfBirth)}</dd>
              <dt>{u.contactPhone}</dt>
              <dd>{donor.contactPhone.startsWith('+880') ? formatBdPhone(donor.contactPhone) : '—'}</dd>
            </dl>
            <p className="hint" style={{ margin: 0 }}>
              {u.donorRecordHint}
            </p>
            <div className="cluster">
              {can(actor, 'donors.review') && (
                <Link className="btn btn-primary" href={`/admin/donors/${donor.id}`}>
                  {u.openDonorRecord}
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              )}
              {donor.registrationStatus === 'approved' && donor.status === 'active' && user.status === 'active' && consent?.listedInSearch && (
                <Link className="section-link" href={`/donors/${donor.publicId}`}>
                  {u.publicProfile}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
            </div>
            {consent && (
              <details className="disclosure">
                <summary>{t.admin.consent.title}</summary>
                <ConsentSummary consent={consent} t={t} instantDate={instantDate} />
              </details>
            )}
          </>
        )}
      </section>

      <section className="card stack-sm" aria-labelledby="memberships">
        <h2 id="memberships" className="admin-section-title">
          <Building2 size={20} aria-hidden="true" />
          {u.membershipsTitle}
        </h2>
        {memberships.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {u.noMemberships}
          </p>
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
          <SectionTitle id="donations" icon={BadgeCheck} count={n(donations.length)}>
            {u.donationsTitle}
          </SectionTitle>
          {donations.length === 0 ? (
            <p className="muted card card-tight">{u.noDonations}</p>
          ) : (
            <ul className="record-list" style={{ gap: 'var(--space-3)' }}>
              {donations.map((d) => (
                <li key={d.id} className="card card-tight record-card">
                  <div className="cluster between">
                    <strong>
                      {date(d.donatedOn)} · {t.common.donationType[d.donationType]}
                    </strong>
                    <span className="cluster-sm">
                      <Badge>{t.common.donationSource[d.source]}</Badge>
                      <VerificationStatusBadge status={d.status} t={t} />
                    </span>
                  </div>
                  {d.place && <p className="small muted">{d.place}</p>}
                  {d.voidedReason && <p className="small muted">{d.voidedReason}</p>}
                  {!self && (d.status === 'pending' || d.status === 'unverified') && (
                    <details className="disclosure">
                      <summary>
                        {u.verify} / {u.reject}
                      </summary>
                      <div className="action-split">
                        <AdminAction action={reviewDonationAction} hidden={{ donationId: d.id, decision: 'verified' }} submit={u.verify} pending={pending} tone="primary" size="md" note={noteField} />
                        <AdminAction action={reviewDonationAction} hidden={{ donationId: d.id, decision: 'rejected' }} submit={u.reject} pending={pending} tone="danger" size="md" note={noteField} />
                      </div>
                    </details>
                  )}
                  {d.status !== 'voided' && (
                    <details className="disclosure disclosure-danger">
                      <summary>{u.withdraw}</summary>
                      <AdminAction action={voidDonationAction} hidden={{ donationId: d.id }} submit={u.withdraw} pending={pending} tone="danger" size="md" note={{ ...reasonField, label: u.withdrawReason, required: true }} />
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
          <SectionTitle id="actions" icon={ListChecks}>
            {u.actionsTitle}
          </SectionTitle>
          {self ? (
            <Alert tone="info">{u.ownAccount}</Alert>
          ) : (
            <div className="action-cards">
              <ActionCard icon={KeyRound} title={u.resetTitle} intro={u.resetIntro} id="reset">
                <AdminAction action={issueResetAction} hidden={{ userId: user.id }} submit={u.issueReset} pending={pending} size="md">
                  <OneTimeValue dataKey="link" label={u.resetLink} hint={u.resetCopyHint} warning={u.resetWarning} />
                </AdminAction>
              </ActionCard>
              <ActionCard icon={LogOut} title={u.sessionsTitle} intro={u.sessionsHint} id="sessions">
                <AdminAction action={revokeSessionsAction} hidden={{ userId: user.id }} submit={u.revokeSessions} pending={pending} size="md" />
              </ActionCard>
            </div>
          )}
        </section>
      )}

      {!deleted && !self && (
        <section className="danger-zone stack" aria-labelledby="careful">
          <div>
            <SectionTitle id="careful" icon={TriangleAlert}>
              {t.admin.donor.carefulTitle}
            </SectionTitle>
            <p className="hint" style={{ marginTop: 'var(--space-1)' }}>
              {u.carefulIntro}
            </p>
          </div>
          <div className="action-cards">
            <ActionCard icon={Ban} title={u.suspendTitle} intro={u.suspendHint} tone="danger" id="suspend">
              {user.status === 'suspended' ? (
                <AdminAction action={setUserStatusAction} hidden={{ userId: user.id, status: 'active' }} submit={u.reinstate} pending={pending} tone="primary" size="md" note={reasonField} />
              ) : (
                <AdminAction
                  action={setUserStatusAction}
                  hidden={{ userId: user.id, status: 'suspended' }}
                  submit={u.suspend}
                  pending={pending}
                  tone="danger"
                  size="md"
                  note={{ ...reasonField, required: true }}
                  confirm={u.suspendConfirm}
                />
              )}
            </ActionCard>
            <ActionCard icon={ShieldCheck} title={u.roleTitle} intro={u.roleIntro} tone="danger" id="role">
              <ActionForm action={setUserRoleAction} className="stack-sm" aria-label={u.roleTitle} clientMessages={checks}>
                <input type="hidden" name="userId" value={user.id} />
                <RadioGroup
                  name="role"
                  legend={u.newRole}
                  hint={u.roleHint}
                  defaultValue={user.role}
                  options={(['user', 'moderator', 'admin'] as const).map((r) => ({ value: r, label: t.common.roles[r] }))}
                />
                <TextField name="password" type="password" label={t.admin.yourPassword} hint={t.admin.yourPasswordHint} autoComplete="current-password" required maxLength={128} />
                <CheckboxField name="confirm" label={u.roleConfirm} required />
                <div className="form-actions">
                  <SubmitButton label={u.changeRole} pendingLabel={pending} className="btn btn-danger" />
                </div>
              </ActionForm>
            </ActionCard>
            <ActionCard icon={UserX} title={u.deletionTitle} tone="danger" id="deletion">
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
                    size="md"
                    confirm={t.admin.deletions.confirm}
                  />
                </div>
              ) : (
                <p className="muted">{u.deletionNone}</p>
              )}
            </ActionCard>
          </div>
        </section>
      )}

      <section className="stack" aria-labelledby="history">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <div>
            <SectionTitle id="history" icon={History}>
              {u.historyTitle}
            </SectionTitle>
            <p>{t.admin.donor.historyIntro}</p>
          </div>
          <Link className="section-link" href={`/admin/audit?targetType=user&targetId=${user.id}`}>
            {t.admin.activity.openAudit}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <AuditTrail entries={changes} empty={t.admin.donor.historyEmpty} moreLabel={(count) => t.admin.donor.historyMore(n(count))} />
        {views.length > 0 && (
          <details className="disclosure">
            <summary>
              <span>{t.admin.donor.viewsTitle}</span>
              <Badge>{n(views.length)}</Badge>
            </summary>
            <AuditTrail entries={views} empty={t.admin.donor.historyEmpty} moreLabel={(count) => t.admin.donor.historyMore(n(count))} />
          </details>
        )}
      </section>
    </>
  );
}
