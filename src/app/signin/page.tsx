import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, HeartHandshake, Info, LogIn, UserPlus } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getI18n } from '@/i18n/server';
import { getActor, safeNextPath } from '@/server/auth/current';
import { signInAction } from '../_actions/auth';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { clientValidationMessages } from '@/components/form/client-messages';
import { TextField } from '@/components/form/fields';
import { Alert } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.signInTitle };
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const { t } = await getI18n();
  const sp = await searchParams;
  const next = safeNextPath(sp.next);
  if (await getActor()) redirect(next);
  const a = t.auth;
  return (
    <div className="auth-page">
      <div className="container auth-column">
        <div className="card auth-card">
          <span className="auth-icon">
            <LogIn size={26} aria-hidden="true" />
          </span>
          <h1>{a.signInTitle}</h1>
          <p className="auth-intro">{a.signInIntro}</p>
          {sp.reset === '1' && <Alert tone="success">{a.resetDone}</Alert>}
          <ActionForm action={signInAction} clientMessages={clientValidationMessages(t)}>
            <input type="hidden" name="next" value={next} />
            <TextField name="phone" label={a.phone} hint={a.phoneHint} type="tel" inputMode="tel" autoComplete="tel" required maxLength={20} />
            <TextField name="password" label={a.password} type="password" autoComplete="current-password" required maxLength={128} />
            <p className="auth-forgot">
              <Link href="/forgot-password">{a.forgotLink}</Link>
            </p>
            <SubmitButton label={a.signInButton} pendingLabel={a.signingIn} className="btn btn-primary btn-lg btn-block" />
          </ActionForm>
        </div>

        <section className="card auth-alt" aria-labelledby="no-account">
          <h2 id="no-account">{a.noAccount}</h2>
          <Link className="auth-choice" href="/register">
            <span className="pub-icon">
              <HeartHandshake size={20} aria-hidden="true" />
            </span>
            <span className="auth-choice-text">
              <strong>{a.registerDonorLink}</strong>
              <span>{a.registerDonorHint}</span>
            </span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <Link className="auth-choice" href={`/register/account?next=${encodeURIComponent(next)}`}>
            <span className="pub-icon">
              <UserPlus size={20} aria-hidden="true" />
            </span>
            <span className="auth-choice-text">
              <strong>{a.registerAccountLink}</strong>
              <span>{a.registerAccountHint}</span>
            </span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </section>

        <p className="pub-meta auth-note">
          <Info size={16} aria-hidden="true" />
          <span>{a.signedOutNote}</span>
        </p>
      </div>
    </div>
  );
}
