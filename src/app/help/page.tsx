import type { Metadata } from 'next';
import Link from 'next/link';
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
    ['emergency', h.emergencyTitle],
    ['find', h.findTitle],
    ['eligibility', h.eligibilityTitle],
    ['availability', h.availabilityTitle],
    ['verification', h.verificationTitle],
    ['privacy', h.privacyTitle],
    ['communities', h.communitiesTitle],
    ['payment', h.paymentTitle],
    ['notifications', h.notificationsTitle],
  ] as const;
  return (
    <>
      <PageHeader title={h.title} intro={h.intro} />
      <div className="container container-narrow section stack-lg">
        <nav aria-label={h.tocLabel} className="card card-tight">
          <p style={{ fontWeight: 700 }}>{h.tocLabel}</p>
          <ul className="stack-sm" style={{ margin: 0, paddingLeft: '1.2rem' }}>
            {toc.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`}>{label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <section id="emergency" className="card card-accent stack">
          <h2>{h.emergencyTitle}</h2>
          <ol className="stack-sm" style={{ paddingLeft: '1.2rem', margin: 0 }}>
            {h.emergencySteps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <Alert tone="warning">{h.emergencyWarning}</Alert>
          <div className="cluster">
            <Link className="btn btn-primary" href="/donors">
              {t.common.nav.findDonors}
            </Link>
            <Link className="btn" href="/requests/new">
              {t.common.nav.newRequest}
            </Link>
          </div>
        </section>

        <section id="find" className="stack">
          <h2>{h.findTitle}</h2>
          <ol className="stack-sm" style={{ paddingLeft: '1.2rem', margin: 0 }}>
            {h.findSteps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>

        <section id="eligibility" className="stack">
          <h2>{h.eligibilityTitle}</h2>
          <p>{h.eligibilityBody}</p>
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
                    <td>{n(settings.eligibilityIntervals[d])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Alert tone="warning">{h.eligibilityWarning}</Alert>
          <p className="small muted">{h.eligibilitySources}</p>
        </section>

        {(
          [
            ['availability', h.availabilityTitle, h.availabilityBody],
            ['verification', h.verificationTitle, h.verificationBody],
            ['privacy', h.privacyTitle, h.privacyBody],
            ['communities', h.communitiesTitle, h.communitiesBody],
            ['payment', h.paymentTitle, h.paymentBody],
            ['notifications', h.notificationsTitle, h.notificationsBody],
          ] as const
        ).map(([id, title, body]) => (
          <section key={id} id={id} className="stack-sm">
            <h2>{title}</h2>
            <p>{body}</p>
          </section>
        ))}

        <section className="card stack-sm">
          <h2>{h.stillNeedHelp}</h2>
          <div className="cluster">
            <Link className="btn" href="/contact">
              {t.common.footer.contact}
            </Link>
            <Link className="btn" href="/communities">
              {t.common.nav.communities}
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
