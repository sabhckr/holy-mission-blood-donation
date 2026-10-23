import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, CircleHelp, Flag, Mail, Phone, UserCog } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { normalizeBdPhone, formatBdPhone } from '@/server/domain/phone';
import { Alert, PageHeader } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.legal.contactTitle };
}

const WAY_ICONS = [Flag, Building2, UserCog];

/** Official contact details come from configuration (PUBLIC_CONTACT_EMAIL / PUBLIC_CONTACT_PHONE); none are invented. */
export default async function ContactPage() {
  const { t } = await getI18n();
  const email = process.env.PUBLIC_CONTACT_EMAIL?.trim() || null;
  const phone = normalizeBdPhone(process.env.PUBLIC_CONTACT_PHONE ?? '');
  return (
    <>
      <PageHeader title={t.legal.contactTitle} intro={t.legal.contactIntro} />
      <div className="section pub-body">
        <div className="container container-narrow stack">
          <Alert tone="warning">{t.legal.contactEmergency}</Alert>

          <section className="stack-sm" aria-labelledby="direct-title">
            <h2 id="direct-title" className="pub-panel-title">
              {t.legal.contactDirectTitle}
            </h2>
            {email || phone ? (
              <div className="contact-methods">
                {phone && (
                  <a className="card contact-method" href={`tel:${phone}`}>
                    <span className="pub-icon">
                      <Phone size={20} aria-hidden="true" />
                    </span>
                    <span className="auth-choice-text">
                      <span>{t.legal.contactPhone}</span>
                      <strong>{formatBdPhone(phone)}</strong>
                    </span>
                  </a>
                )}
                {email && (
                  <a className="card contact-method" href={`mailto:${email}`}>
                    <span className="pub-icon">
                      <Mail size={20} aria-hidden="true" />
                    </span>
                    <span className="auth-choice-text">
                      <span>{t.legal.contactEmail}</span>
                      <strong>{email}</strong>
                    </span>
                  </a>
                )}
              </div>
            ) : (
              <p className="card card-muted card-tight" style={{ margin: 0 }}>
                {t.legal.contactNotPublished}
              </p>
            )}
          </section>

          <section className="card stack" aria-labelledby="ways-title">
            <h2 id="ways-title" className="pub-panel-title">
              {t.legal.contactWaysTitle}
            </h2>
            <ul className="advice-list">
              {t.legal.contactWays.map((w, i) => {
                const Icon = WAY_ICONS[i] ?? CircleHelp;
                return (
                  <li key={w}>
                    <Icon size={20} aria-hidden="true" />
                    <span>{w}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="cluster">
            <Link className="btn" href="/communities">
              <Building2 size={18} aria-hidden="true" />
              {t.common.nav.communities}
            </Link>
            <Link className="btn" href="/help">
              <CircleHelp size={18} aria-hidden="true" />
              {t.common.nav.help}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
