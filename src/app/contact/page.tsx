import type { Metadata } from 'next';
import Link from 'next/link';
import { getI18n } from '@/i18n/server';
import { normalizeBdPhone, formatBdPhone } from '@/server/domain/phone';
import { Alert, PageHeader } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.legal.contactTitle };
}

/** Official contact details come from configuration (PUBLIC_CONTACT_EMAIL / PUBLIC_CONTACT_PHONE); none are invented. */
export default async function ContactPage() {
  const { t } = await getI18n();
  const email = process.env.PUBLIC_CONTACT_EMAIL?.trim() || null;
  const phone = normalizeBdPhone(process.env.PUBLIC_CONTACT_PHONE ?? '');
  return (
    <>
      <PageHeader title={t.legal.contactTitle} intro={t.legal.contactIntro} />
      <div className="container container-narrow section stack">
        <Alert tone="warning">{t.legal.contactEmergency}</Alert>
        {email || phone ? (
          <div className="card">
            <dl className="dl">
              {email && (
                <>
                  <dt>{t.legal.contactEmail}</dt>
                  <dd>
                    <a href={`mailto:${email}`}>{email}</a>
                  </dd>
                </>
              )}
              {phone && (
                <>
                  <dt>{t.legal.contactPhone}</dt>
                  <dd>
                    <a href={`tel:${phone}`}>{formatBdPhone(phone)}</a>
                  </dd>
                </>
              )}
            </dl>
          </div>
        ) : (
          <p>{t.legal.contactNotPublished}</p>
        )}
        <ul className="stack-sm" style={{ paddingLeft: '1.2rem' }}>
          {t.legal.contactWays.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
        <div className="cluster">
          <Link className="btn" href="/communities">
            {t.common.nav.communities}
          </Link>
          <Link className="btn" href="/help">
            {t.common.nav.help}
          </Link>
        </div>
      </div>
    </>
  );
}
