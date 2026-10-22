import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getI18n } from '@/i18n/server';
import { getActor, safeNextPath } from '@/server/auth/current';
import { registerAccountAction } from '../../_actions/auth';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { clientValidationMessages } from '@/components/form/client-messages';
import { CheckboxField, TextField } from '@/components/form/fields';
import { PageHeader } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.accountTitle };
}

export default async function RegisterAccountPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { t } = await getI18n();
  const next = safeNextPath((await searchParams).next);
  if (await getActor()) redirect(next);
  const opt = t.common.states.optional;
  return (
    <>
      <PageHeader title={t.auth.accountTitle} intro={t.auth.accountIntro} />
      <div className="container container-narrow section stack">
        <div className="card">
          <ActionForm action={registerAccountAction} clientMessages={clientValidationMessages(t)}>
            <input type="hidden" name="next" value={next} />
            <TextField name="displayName" label={t.auth.displayName} autoComplete="name" required maxLength={80} />
            <TextField name="phone" label={t.auth.phone} hint={t.auth.phoneHint} type="tel" inputMode="tel" autoComplete="tel" required maxLength={20} />
            <TextField name="email" label={t.auth.email} hint={t.auth.emailHint} type="email" autoComplete="email" optionalLabel={opt} maxLength={200} />
            <TextField name="password" label={t.auth.password} hint={t.auth.passwordHint} type="password" autoComplete="new-password" required maxLength={128} />
            <TextField name="confirmPassword" label={t.auth.confirmPassword} type="password" autoComplete="new-password" required maxLength={128} />
            <CheckboxField
              name="acceptPrivacy"
              required
              label={
                <>
                  {t.auth.acceptPrivacy} (<Link href="/privacy">{t.auth.privacyLink}</Link>, <Link href="/terms">{t.auth.termsLink}</Link>)
                </>
              }
            />
            <SubmitButton label={t.auth.accountButton} pendingLabel={t.common.actions.submitting} className="btn btn-primary btn-block" />
          </ActionForm>
        </div>
        <p>
          {t.auth.haveAccount} <Link href="/signin">{t.common.nav.signIn}</Link>
        </p>
      </div>
    </>
  );
}
