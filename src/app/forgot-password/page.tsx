import type { Metadata } from 'next';
import Link from 'next/link';
import { getI18n } from '@/i18n/server';
import { Alert, PageHeader } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.forgotTitle };
}

export default async function ForgotPasswordPage() {
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t.auth.forgotTitle} />
      <div className="container container-narrow section stack">
        <Alert tone="info">
          <p>{t.auth.forgotBody}</p>
          <p>{t.auth.forgotSteps}</p>
        </Alert>
        <div className="cluster">
          <Link className="btn btn-primary" href="/contact">
            {t.auth.forgotContact}
          </Link>
          <Link className="btn" href="/signin">
            {t.common.nav.signIn}
          </Link>
        </div>
      </div>
    </>
  );
}
