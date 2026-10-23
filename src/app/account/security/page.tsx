import type { Metadata } from 'next';
import { KeyRound, Laptop, PowerOff, Smartphone, Trash2, TriangleAlert } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { getSession, requireActor } from '@/server/auth/current';
import { listSessions } from '@/server/services/accounts';
import { myDeletionRequest } from '@/server/services/privacy';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { TextArea, TextField } from '@/components/form/fields';
import { IconTile, PageHead } from '@/components/account/bits';
import { Alert, Badge } from '@/components/ui';
import {
  cancelDeletionAction,
  changePasswordAction,
  deactivateAction,
  requestDeletionAction,
  revokeOtherSessionsAction,
  revokeSessionAction,
} from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.security.title, robots: { index: false } };
}

/** Short, non-identifying device description from the stored user agent. */
function deviceLabel(ua: string | null): string | null {
  if (!ua) return null;
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac OS/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : null;
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : null;
  return [browser, os].filter(Boolean).join(' · ') || null;
}

const isPhone = (ua: string | null) => !!ua && /Android|iPhone|iPad|Mobile/i.test(ua);

export default async function SecurityPage() {
  const { t, dateTime, instantDate } = await getI18n();
  const s = t.account.security;
  const actor = await requireActor('/account/security');
  const [session, sessions, deletion] = await Promise.all([getSession(), listSessions(actor.userId), myDeletionRequest(actor)]);
  const others = sessions.filter((x) => x.id !== session?.sessionId);

  return (
    <>
      <PageHead title={s.title} intro={s.intro} />

      <ActionForm action={changePasswordAction} aria-label={s.passwordTitle} className="form">
        <fieldset className="form-section">
          <legend id="password-title">
            <KeyRound size={20} aria-hidden="true" />
            {s.passwordTitle}
          </legend>
          <TextField name="currentPassword" type="password" label={s.currentPassword} autoComplete="current-password" required maxLength={128} />
          <TextField name="newPassword" type="password" label={s.newPassword} hint={s.passwordHint} autoComplete="new-password" required maxLength={128} />
          <TextField name="confirmPassword" type="password" label={s.confirmPassword} autoComplete="new-password" required maxLength={128} />
          <div className="acct-form-actions">
            <SubmitButton label={s.changeButton} pendingLabel={t.common.actions.saving} className="btn btn-primary btn-lg" />
          </div>
        </fieldset>
      </ActionForm>

      <section className="card" aria-labelledby="sessions-title">
        <div className="acct-card-head">
          <IconTile icon={Laptop} tone="neutral" />
          <div>
            <h2 id="sessions-title">{s.sessionsTitle}</h2>
            <p>{s.sessionsHint}</p>
          </div>
        </div>
        <ul className="org-members">
          {sessions.map((x) => {
            const current = x.id === session?.sessionId;
            return (
              <li key={x.id}>
                <div className="org-member">
                  <IconTile icon={isPhone(x.userAgent) ? Smartphone : Laptop} tone={current ? 'success' : 'neutral'} small />
                  <div>
                    <p className="org-member-name" style={{ margin: 0 }}>
                      <span>{deviceLabel(x.userAgent) ?? s.unknownDevice}</span>
                      {current && <Badge tone="success">{s.sessionCurrent}</Badge>}
                    </p>
                    <p className="acct-meta">
                      <span>{s.sessionStarted(dateTime(x.createdAt))}</span>
                      <span>{s.sessionLastSeen(dateTime(x.lastSeenAt))}</span>
                    </p>
                  </div>
                </div>
                {!current && (
                  <ActionForm action={revokeSessionAction} className="stack-sm org-member-actions">
                    <input type="hidden" name="sessionId" value={x.id} />
                    <div>
                      <SubmitButton label={s.revoke} pendingLabel={t.common.actions.saving} className="btn btn-sm" />
                    </div>
                  </ActionForm>
                )}
              </li>
            );
          })}
        </ul>
        {others.length > 0 && (
          <ActionForm action={revokeOtherSessionsAction} className="stack-sm">
            <div style={{ paddingTop: 'var(--space-3)', borderTop: '1px solid var(--line)' }}>
              <SubmitButton label={s.signOutOthers} pendingLabel={t.common.actions.saving} className="btn" />
            </div>
          </ActionForm>
        )}
      </section>

      <section aria-labelledby="danger-title" className="stack">
        <h2 id="danger-title" className="acct-h2">
          <TriangleAlert size={20} aria-hidden="true" className="icon-brand" />
          {s.dangerTitle}
        </h2>

        <section className="card acct-danger" aria-labelledby="deactivate-title">
          <div className="acct-card-head">
            <IconTile icon={PowerOff} tone="warning" />
            <div>
              <h3 id="deactivate-title">{s.deactivateTitle}</h3>
              <p>{s.deactivateHint}</p>
            </div>
          </div>
          <details className="disclosure">
            <summary>{s.deactivateButton}</summary>
            <p>{s.deactivateBody}</p>
            <ActionForm action={deactivateAction}>
              <TextField name="password" type="password" label={s.confirmWithPassword} autoComplete="current-password" required maxLength={128} />
              <div className="form-actions">
                <SubmitButton label={s.deactivateButton} pendingLabel={t.common.actions.saving} className="btn btn-danger" />
              </div>
            </ActionForm>
          </details>
        </section>

        <section className="card acct-danger" aria-labelledby="deletion-title" id="deletion">
          <div className="acct-card-head">
            <IconTile icon={Trash2} tone="danger" />
            <div>
              <h3 id="deletion-title">{s.deletionTitle}</h3>
              <p>{s.deletionHint}</p>
            </div>
          </div>
          {deletion ? (
            <div className="stack-sm">
              <Alert tone="warning">{s.deletionPending(instantDate(deletion.createdAt))}</Alert>
              <ActionForm action={cancelDeletionAction} className="stack-sm">
                <div>
                  <SubmitButton label={s.cancelDeletion} pendingLabel={t.common.actions.saving} className="btn btn-soft" />
                </div>
              </ActionForm>
            </div>
          ) : (
            <details className="disclosure">
              <summary>{s.deletionButton}</summary>
              <p>{s.deletionBody}</p>
              <p className="acct-quote small">{s.deletionItems}</p>
              <p className="small muted">{s.deletionKept}</p>
              <ActionForm action={requestDeletionAction}>
                <TextArea name="reason" label={s.deletionReason} maxLength={300} />
                <TextField name="password" type="password" label={s.confirmWithPassword} autoComplete="current-password" required maxLength={128} />
                <div className="form-actions">
                  <SubmitButton label={s.deletionButton} pendingLabel={t.common.actions.submitting} className="btn btn-danger" />
                </div>
              </ActionForm>
            </details>
          )}
        </section>
      </section>
    </>
  );
}
