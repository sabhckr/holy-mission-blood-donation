import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getI18n } from '@/i18n/server';
import { getActor, safeNextPath } from '@/server/auth/current';
import { signInAction } from '../_actions/auth';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { clientValidationMessages } from '@/components/form/client-messages';
import { TextField } from '@/components/form/fields';
import { Alert, PageHeader } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.signInTitle };
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const { t } = await getI18n();
  const sp = await searchParams;
  const next = safeNextPath(sp.next);
  if (await getActor()) redirect(next);
  return (
    <>
      <PageHeader title={t.auth.signInTitle} intro={t.auth.signInIntro} />
      <div className="container container-narrow section stack">
        {sp.reset === '1' && <Alert tone="success">{t.auth.resetDone}</Alert>}
        <div className="card">
          <ActionForm action={signInAction} clientMessages={clientValidationMessages(t)}>
            <input type="hidden" name="next" value={next} />
            <TextField name="phone" label={t.auth.phone} hint={t.auth.phoneHint} type="tel" inputMode="tel" autoComplete="tel" required maxLength={20} />
            <TextField name="password" label={t.auth.password} type="password" autoComplete="current-password" required maxLength={128} />
            <div className="form-actions">
              <SubmitButton label={t.auth.signInButton} pendingLabel={t.auth.signingIn} className="btn btn-primary btn-block" />
            </div>
            <p className="small">
              <Link href="/forgot-password">{t.auth.forgotLink}</Link>
            </p>
          </ActionForm>
        </div>
        <div className="card stack-sm">
          <p style={{ fontWeight: 600, margin: 0 }}>{t.auth.noAccount}</p>
          <Link className="btn btn-primary" href="/register">
            {t.auth.registerDonorLink}
          </Link>
          <Link href={`/register/account?next=${encodeURIComponent(next)}`}>{t.auth.registerAccountLink}</Link>
        </div>
        <p className="small muted">{t.auth.signedOutNote}</p>
      </div>
    </>
  );
}
