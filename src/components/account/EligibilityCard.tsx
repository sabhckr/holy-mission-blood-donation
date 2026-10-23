import Link from 'next/link';
import type { CSSProperties } from 'react';
import { CalendarClock, CalendarPlus, CircleCheck, Info, Stethoscope } from 'lucide-react';
import type { DonationType } from '@/server/domain/constants';
import type { EligibilityEstimate } from '@/server/domain/eligibility';
import type { I18n } from '@/i18n/server';
import { IconTile } from './bits';

/**
 * Estimated next donation date as a countdown ring. Always paired with the reminder that
 * reaching zero is not medical eligibility — the blood service decides after screening.
 */
export function EligibilityCard({
  estimate,
  i18n,
  intervals,
  showAddLink = true,
}: {
  estimate: EligibilityEstimate;
  i18n: I18n;
  /** Minimum interval per donation type, to draw how much of the wait has passed. */
  intervals?: Record<DonationType, number>;
  showAddLink?: boolean;
}) {
  const { t, n, date } = i18n;
  const e = t.account.eligibility;
  const total = estimate.state === 'no_data' ? 0 : (intervals?.[estimate.basedOn.donationType] ?? 0);
  const progress = estimate.state === 'waiting' && total > 0 ? Math.min(100, Math.max(0, Math.round(((total - estimate.daysLeft) / total) * 100))) : 0;
  return (
    <section className="card stack" aria-labelledby="eligibility-title">
      <div className="acct-card-head">
        <IconTile icon={CalendarClock} />
        <h2 id="eligibility-title">{e.title}</h2>
      </div>
      {estimate.state === 'no_data' ? (
        <div className="acct-eligibility-body">
          <span className="acct-ring acct-ring-empty" aria-hidden="true">
            <span>
              <CalendarPlus size={34} />
            </span>
          </span>
          <div className="stack-sm">
            <p>{e.noData}</p>
            {showAddLink && (
              <Link className="btn btn-soft btn-sm" href="/account/donations#add">
                {e.addRecord}
              </Link>
            )}
          </div>
        </div>
      ) : estimate.state === 'waiting' ? (
        <div className="acct-eligibility-body">
          <span className="acct-ring" style={{ '--p': progress } as CSSProperties}>
            <span>
              <span className="acct-ring-number">{n(estimate.daysLeft)}</span>
              <span className="acct-ring-label">{e.daysLeftLabel}</span>
            </span>
          </span>
          <div className="stack-sm">
            <p className="acct-date">{e.estimatedDate(date(estimate.nextDate))}</p>
            <p className="small muted">
              {e.basedOn(date(estimate.basedOn.donatedOn), t.common.donationType[estimate.basedOn.donationType])}{' '}
              {estimate.basedOn.verified ? e.basedOnVerified : e.basedOnSelfReported}
            </p>
          </div>
        </div>
      ) : (
        <div className="acct-eligibility-body">
          <span className="acct-ring acct-ring-done" aria-hidden="true">
            <span>
              <CircleCheck size={40} />
            </span>
          </span>
          <div className="stack-sm">
            <p style={{ fontWeight: 800 }}>{e.passedTitle}</p>
            <p>{e.passedBody(date(estimate.nextDate))}</p>
            <p className="small muted">
              {e.basedOn(date(estimate.basedOn.donatedOn), t.common.donationType[estimate.basedOn.donationType])}{' '}
              {estimate.basedOn.verified ? e.basedOnVerified : e.basedOnSelfReported}
            </p>
          </div>
        </div>
      )}
      <p className="acct-note">
        <Stethoscope size={16} aria-hidden="true" />
        <span>{e.shortDisclaimer}</span>
      </p>
      <details className="disclosure acct-more">
        <summary>
          <span className="cluster-sm">
            <Info size={16} aria-hidden="true" />
            {e.learnMore}
          </span>
        </summary>
        <p>{e.disclaimer}</p>
        <p>
          <Link href="/help#eligibility">{e.learnMore}</Link>
        </p>
      </details>
    </section>
  );
}
