import type { Metadata } from 'next';
import Link from 'next/link';
import { KeyRound, LinkIcon } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { checkResetToken } from '@/server/services/accounts';
import { resetPasswordAction } from '../../_actions/auth';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { clientValidationMessages } from '@/components/form/client-messages';
import { TextField } from '@/components/form/fields';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.resetTitle, robots: { index: false }, referrer: 'no-referrer' };
}

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { t } = await getI18n();
  const { token } = await params;
  const valid = token.length >= 20 && token.length <= 100 && !!(await checkResetToken(token));
  const a = t.auth;
  return (
    <div className="auth-page">
      <div className="container auth-column">
        {valid ? (
          <div className="card auth-card">
            <span className="auth-icon">
              <KeyRound size={26} aria-hidden="true" />
            </span>
            <h1>{a.resetTitle}</h1>
            <p className="auth-intro">{a.resetIntro}</p>
            <ActionForm action={resetPasswordAction} clientMessages={clientValidationMessages(t)}>
              <input type="hidden" name="token" value={token} />
              <TextField name="password" label={a.newPassword} hint={a.passwordHint} type="password" autoComplete="new-password" required maxLength={128} />
              <TextField name="confirmPassword" label={a.confirmPassword} type="password" autoComplete="new-password" required maxLength={128} />
              <SubmitButton label={a.resetButton} pendingLabel={t.common.actions.saving} className="btn btn-primary btn-lg btn-block" />
            </ActionForm>
          </div>
        ) : (
          <div className="card auth-card">
            <span className="auth-icon auth-icon-error">
              <LinkIcon size={26} aria-hidden="true" />
            </span>
            <h1>{a.resetInvalidTitle}</h1>
            <p className="auth-intro">{a.resetInvalid}</p>
            <Link className="btn btn-primary btn-lg btn-block" href="/contact">
              {a.forgotContact}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
