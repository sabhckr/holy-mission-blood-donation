import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import type { EligibilityEstimate } from '@/server/domain/eligibility';
import type { I18n } from '@/i18n/server';
import { Alert } from '@/components/ui';

/**
 * Estimated next donation date. Always paired with the reminder that reaching zero is not
 * medical eligibility — the blood service decides after screening.
 */
export function EligibilityCard({ estimate, i18n, showAddLink = true }: { estimate: EligibilityEstimate; i18n: I18n; showAddLink?: boolean }) {
  const { t, n, date } = i18n;
  const e = t.account.eligibility;
  return (
    <section className="card stack" aria-labelledby="eligibility-title">
      <h2 id="eligibility-title" className="cluster-sm" style={{ fontSize: '1.15rem' }}>
        <CalendarClock size={20} aria-hidden="true" />
        {e.title}
      </h2>
      {estimate.state === 'no_data' ? (
        <>
          <p>{e.noData}</p>
          {showAddLink && (
            <p style={{ margin: 0 }}>
              <Link href="/account/donations#add">{e.addRecord}</Link>
            </p>
          )}
        </>
      ) : (
        <>
          {estimate.state === 'waiting' ? (
            <div className="stack-sm">
              <div className="countdown">
                <span className="countdown-number">{n(estimate.daysLeft)}</span>
                <span>{e.daysLeftLabel}</span>
              </div>
              <p style={{ margin: 0 }}>{e.estimatedDate(date(estimate.nextDate))}</p>
            </div>
          ) : (
            <div className="stack-sm">
              <p style={{ fontWeight: 700, margin: 0 }}>{e.passedTitle}</p>
              <p style={{ margin: 0 }}>{e.passedBody(date(estimate.nextDate))}</p>
            </div>
          )}
          <p className="small muted" style={{ margin: 0 }}>
            {e.basedOn(date(estimate.basedOn.donatedOn), t.common.donationType[estimate.basedOn.donationType])}{' '}
            {estimate.basedOn.verified ? e.basedOnVerified : e.basedOnSelfReported}
          </p>
        </>
      )}
      <Alert tone="warning">
        <p>{e.disclaimer}</p>
      </Alert>
      <p className="small" style={{ margin: 0 }}>
        <Link href="/help#eligibility">{e.learnMore}</Link>
      </p>
    </section>
  );
}
