import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Building2, CalendarClock, CircleHelp, Mail, Search, Siren, TriangleAlert } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { DONATION_TYPES } from '@/server/domain/constants';
import { getSettings } from '@/server/services/settings';
import { Alert, PageHeader } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.help.title, description: t.help.intro };
}

export default async function HelpPage() {
  const { t, n } = await getI18n();
  const settings = await getSettings();
  const h = t.help;
  const toc = [
    ['emergency', h.toc.emergency, Siren],
    ['find', h.toc.find, Search],
    ['eligibility', h.toc.eligibility, CalendarClock],
    ['faq', h.toc.faq, CircleHelp],
  ] as const;
  const faq = [
    ['availability', h.availabilityTitle, h.availabilityBody],
    ['verification', h.verificationTitle, h.verificationBody],
    ['privacy', h.privacyTitle, h.privacyBody],
    ['communities', h.communitiesTitle, h.communitiesBody],
    ['payment', h.paymentTitle, h.paymentBody],
    ['notifications', h.notificationsTitle, h.notificationsBody],
  ] as const;
  return (
    <>
      <PageHeader title={h.title} intro={h.intro} />
      <div className="section pub-body">
        <div className="container container-narrow stack-lg">
          <nav aria-label={h.tocLabel} className="toc-chips">
            <ul>
              {toc.map(([id, label, Icon]) => (
                <li key={id}>
                  <a href={`#${id}`}>
                    <Icon size={16} aria-hidden="true" />
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <section id="emergency" className="emergency-card" aria-labelledby="emergency-title">
            <div className="emergency-head">
              <Siren size={26} aria-hidden="true" />
              <h2 id="emergency-title">{h.emergencyTitle}</h2>
            </div>
            <div className="emergency-body stack">
              <ol className="num-steps">
                {h.emergencySteps.map((s, i) => (
                  <li key={s}>
                    <span className="pub-step" aria-hidden="true">
                      {n(i + 1)}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
              <Alert tone="warning">{h.emergencyWarning}</Alert>
              <div className="emergency-actions">
                <Link className="btn btn-primary btn-lg" href="/donors">
                  <Search size={20} aria-hidden="true" />
                  {t.common.nav.findDonors}
                </Link>
                <Link className="btn btn-lg" href="/requests/new">
                  <Siren size={20} aria-hidden="true" />
                  {t.common.nav.newRequest}
                </Link>
              </div>
            </div>
          </section>

          <section id="find" className="card stack" aria-labelledby="find-title">
            <h2 id="find-title" className="pub-panel-title">
              <Search size={22} aria-hidden="true" />
              {h.findTitle}
            </h2>
            <ol className="num-steps">
              {h.findSteps.map((s, i) => (
                <li key={s}>
                  <span className="pub-step pub-step-soft" aria-hidden="true">
                    {n(i + 1)}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </section>

          <section id="eligibility" className="card stack" aria-labelledby="eligibility-title">
            <h2 id="eligibility-title" className="pub-panel-title">
              <CalendarClock size={22} aria-hidden="true" />
              {h.eligibilityTitle}
            </h2>
            <p className="prose-text">{h.eligibilityBody}</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{h.eligibilityTableType}</th>
                    <th scope="col">{h.eligibilityTableDays}</th>
                  </tr>
                </thead>
                <tbody>
                  {DONATION_TYPES.map((d) => (
                    <tr key={d}>
                      <td>{t.common.donationType[d]}</td>
                      <td>
                        <strong>{n(settings.eligibilityIntervals[d])}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="pub-meta pub-warn-line">
              <TriangleAlert size={18} aria-hidden="true" />
              <span>{h.eligibilityWarning}</span>
            </p>
            <p className="small muted" style={{ marginBottom: 0 }}>
              {h.eligibilitySources}
            </p>
          </section>

          <section id="faq" className="stack" aria-labelledby="faq-title">
            <div>
              <h2 id="faq-title" className="pub-panel-title">
                <CircleHelp size={22} aria-hidden="true" />
                {h.faqTitle}
              </h2>
              <p className="small muted" style={{ margin: 0 }}>
                {h.faqIntro}
              </p>
            </div>
            <div className="faq-list">
              {faq.map(([id, title, body]) => (
                <details key={id} id={id} className="disclosure">
                  <summary>{title}</summary>
                  <p className="prose-text">{body}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="card card-muted help-more" aria-labelledby="more-help">
            <div>
              <h2 id="more-help">{h.stillNeedHelp}</h2>
              <p>{h.stillNeedHelpBody}</p>
            </div>
            <div className="cluster">
              <Link className="btn" href="/contact">
                <Mail size={18} aria-hidden="true" />
                {t.common.footer.contact}
              </Link>
              <Link className="btn" href="/communities">
                <Building2 size={18} aria-hidden="true" />
                {t.common.nav.communities}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
