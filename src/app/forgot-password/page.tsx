import type { Metadata } from 'next';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.forgotTitle };
}

export default async function ForgotPasswordPage() {
  const { t, n } = await getI18n();
  const a = t.auth;
  return (
    <div className="auth-page">
      <div className="container auth-column">
        <div className="card auth-card">
          <span className="auth-icon">
            <KeyRound size={26} aria-hidden="true" />
          </span>
          <h1>{a.forgotTitle}</h1>
          <p className="auth-intro">{a.forgotBody}</p>
          <ol className="num-steps">
            {a.forgotSteps.map((step, i) => (
              <li key={step}>
                <span className="pub-step" aria-hidden="true">
                  {n(i + 1)}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <Link className="btn btn-primary btn-lg btn-block" href="/contact">
            {a.forgotContact}
          </Link>
        </div>
        <p className="auth-switch">
          <Link href="/signin">{t.common.nav.signIn}</Link>
        </p>
      </div>
    </div>
  );
}
