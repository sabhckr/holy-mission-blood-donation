import type { Metadata } from 'next';
import { Laptop } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { getSession, requireActor } from '@/server/auth/current';
import { listSessions } from '@/server/services/accounts';
import { myDeletionRequest } from '@/server/services/privacy';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { TextArea, TextField } from '@/components/form/fields';
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

export default async function SecurityPage() {
  const { t, dateTime, instantDate } = await getI18n();
  const s = t.account.security;
  const actor = await requireActor('/account/security');
  const [session, sessions, deletion] = await Promise.all([getSession(), listSessions(actor.userId), myDeletionRequest(actor)]);
  const others = sessions.filter((x) => x.id !== session?.sessionId);

  return (
    <>
      <h1>{s.title}</h1>

      <section className="stack" aria-labelledby="password-title">
        <h2 id="password-title" style={{ fontSize: '1.15rem' }}>
          {s.passwordTitle}
        </h2>
        <ActionForm action={changePasswordAction} aria-label={s.passwordTitle}>
          <fieldset className="form-section">
            <legend className="visually-hidden">{s.passwordTitle}</legend>
            <TextField name="currentPassword" type="password" label={s.currentPassword} autoComplete="current-password" required maxLength={128} />
            <TextField name="newPassword" type="password" label={s.newPassword} hint={s.passwordHint} autoComplete="new-password" required maxLength={128} />
            <TextField name="confirmPassword" type="password" label={s.confirmPassword} autoComplete="new-password" required maxLength={128} />
          </fieldset>
          <SubmitButton label={s.changeButton} pendingLabel={t.common.actions.saving} />
        </ActionForm>
      </section>

      <section className="card stack" aria-labelledby="sessions-title">
        <h2 id="sessions-title" style={{ fontSize: '1.15rem' }}>
          {s.sessionsTitle}
        </h2>
        <ul className="list-plain list-divided">
          {sessions.map((x) => {
            const current = x.id === session?.sessionId;
            return (
              <li key={x.id} className="cluster between">
                <span className="cluster-sm" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                  <Laptop size={18} aria-hidden="true" style={{ marginTop: 4, flex: 'none' }} />
                  <span>
                    <strong>{deviceLabel(x.userAgent) ?? s.unknownDevice}</strong> {current && <Badge tone="success">{s.sessionCurrent}</Badge>}
                    <br />
                    <span className="small muted">
                      {s.sessionStarted(dateTime(x.createdAt))} · {s.sessionLastSeen(dateTime(x.lastSeenAt))}
                    </span>
                  </span>
                </span>
                {!current && (
                  <ActionForm action={revokeSessionAction} className="stack-sm">
                    <input type="hidden" name="sessionId" value={x.id} />
                    <SubmitButton label={s.revoke} pendingLabel={t.common.actions.saving} className="btn btn-sm" />
                  </ActionForm>
                )}
              </li>
            );
          })}
        </ul>
        {others.length > 0 && (
          <ActionForm action={revokeOtherSessionsAction} className="stack-sm">
            <SubmitButton label={s.signOutOthers} pendingLabel={t.common.actions.saving} className="btn" />
          </ActionForm>
        )}
      </section>

      <section className="card stack" aria-labelledby="deactivate-title">
        <h2 id="deactivate-title" style={{ fontSize: '1.15rem' }}>
          {s.deactivateTitle}
        </h2>
        <p style={{ margin: 0 }}>{s.deactivateBody}</p>
        <details className="disclosure">
          <summary>{s.deactivateButton}</summary>
          <ActionForm action={deactivateAction}>
            <TextField name="password" type="password" label={s.confirmWithPassword} autoComplete="current-password" required maxLength={128} />
            <div className="form-actions">
              <SubmitButton label={s.deactivateButton} pendingLabel={t.common.actions.saving} className="btn btn-danger" />
            </div>
          </ActionForm>
        </details>
      </section>

      <section className="card stack" aria-labelledby="deletion-title" id="deletion">
        <h2 id="deletion-title" style={{ fontSize: '1.15rem' }}>
          {s.deletionTitle}
        </h2>
        {deletion ? (
          <>
            <Alert tone="warning">{s.deletionPending(instantDate(deletion.createdAt))}</Alert>
            <ActionForm action={cancelDeletionAction} className="stack-sm">
              <SubmitButton label={s.cancelDeletion} pendingLabel={t.common.actions.saving} className="btn" />
            </ActionForm>
          </>
        ) : (
          <>
            <p style={{ margin: 0 }}>{s.deletionBody}</p>
            <p style={{ margin: 0 }}>{s.deletionItems}</p>
            <p className="small muted" style={{ margin: 0 }}>
              {s.deletionKept}
            </p>
            <details className="disclosure">
              <summary>{s.deletionButton}</summary>
              <ActionForm action={requestDeletionAction}>
                <TextArea name="reason" label={s.deletionReason} maxLength={300} />
                <TextField name="password" type="password" label={s.confirmWithPassword} autoComplete="current-password" required maxLength={128} />
                <div className="form-actions">
                  <SubmitButton label={s.deletionButton} pendingLabel={t.common.actions.submitting} className="btn btn-danger" />
                </div>
              </ActionForm>
            </details>
          </>
        )}
      </section>
    </>
  );
}
