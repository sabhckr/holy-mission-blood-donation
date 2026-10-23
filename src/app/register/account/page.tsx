import type { Metadata } from 'next';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getI18n } from '@/i18n/server';
import { getActor, safeNextPath } from '@/server/auth/current';
import { registerAccountAction } from '../../_actions/auth';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { clientValidationMessages } from '@/components/form/client-messages';
import { CheckboxField, TextField } from '@/components/form/fields';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.accountTitle };
}

export default async function RegisterAccountPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { t } = await getI18n();
  const next = safeNextPath((await searchParams).next);
  if (await getActor()) redirect(next);
  const opt = t.common.states.optional;
  const a = t.auth;
  return (
    <div className="auth-page">
      <div className="container auth-column">
        <div className="card auth-card">
          <span className="auth-icon">
            <UserPlus size={26} aria-hidden="true" />
          </span>
          <h1>{a.accountTitle}</h1>
          <p className="auth-intro">{a.accountIntro}</p>
          <ActionForm action={registerAccountAction} clientMessages={clientValidationMessages(t)}>
            <input type="hidden" name="next" value={next} />
            <TextField name="displayName" label={a.displayName} autoComplete="name" required maxLength={80} />
            <TextField name="phone" label={a.phone} hint={a.phoneHint} type="tel" inputMode="tel" autoComplete="tel" required maxLength={20} />
            <TextField name="email" label={a.email} hint={a.emailHint} type="email" autoComplete="email" optionalLabel={opt} maxLength={200} />
            <TextField name="password" label={a.password} hint={a.passwordHint} type="password" autoComplete="new-password" required maxLength={128} />
            <TextField name="confirmPassword" label={a.confirmPassword} type="password" autoComplete="new-password" required maxLength={128} />
            <div className="consent-box">
              <CheckboxField
                name="acceptPrivacy"
                required
                label={
                  <>
                    {a.acceptPrivacy} (<Link href="/privacy">{a.privacyLink}</Link>, <Link href="/terms">{a.termsLink}</Link>)
                  </>
                }
              />
            </div>
            <SubmitButton label={a.accountButton} pendingLabel={t.common.actions.submitting} className="btn btn-primary btn-lg btn-block" />
          </ActionForm>
        </div>
        <p className="auth-switch">
          {a.haveAccount} <Link href={`/signin?next=${encodeURIComponent(next)}`}>{t.common.nav.signIn}</Link>
        </p>
      </div>
    </div>
  );
}
