import type { Metadata } from 'next';
import Link from 'next/link';
import { getI18n } from '@/i18n/server';
import { checkResetToken } from '@/server/services/accounts';
import { resetPasswordAction } from '../../_actions/auth';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { TextField } from '@/components/form/fields';
import { Alert, PageHeader } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.resetTitle, robots: { index: false }, referrer: 'no-referrer' };
}

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { t } = await getI18n();
  const { token } = await params;
  const valid = token.length >= 20 && token.length <= 100 && !!(await checkResetToken(token));
  return (
    <>
      <PageHeader title={t.auth.resetTitle} intro={valid ? t.auth.resetIntro : undefined} />
      <div className="container container-narrow section stack">
        {valid ? (
          <div className="card">
            <ActionForm action={resetPasswordAction}>
              <input type="hidden" name="token" value={token} />
              <TextField name="password" label={t.auth.newPassword} hint={t.auth.passwordHint} type="password" autoComplete="new-password" required maxLength={128} />
              <TextField name="confirmPassword" label={t.auth.confirmPassword} type="password" autoComplete="new-password" required maxLength={128} />
              <SubmitButton label={t.auth.resetButton} pendingLabel={t.common.actions.saving} />
            </ActionForm>
          </div>
        ) : (
          <>
            <Alert tone="error">{t.auth.resetInvalid}</Alert>
            <Link href="/contact">{t.auth.forgotContact}</Link>
          </>
        )}
      </div>
    </>
  );
}
