import Link from 'next/link';
import { MessageCircle, Phone } from 'lucide-react';
import type { I18n } from '@/i18n/server';
import { formatBdPhone } from '@/server/domain/phone';
import { Alert, Badge } from '../ui';
import { STATUS_TONE, URGENCY_TONE } from './RequestCard';
import type { RequestView } from './ManagePanel';

/** Request facts plus requester contact (only when the viewer is allowed to see it). */
export function RequestSummary({ view, place, i18n }: { view: RequestView; place: string; i18n: I18n }) {
  const { t, n, dateTime } = i18n;
  const r = view.request;
  const phone = r.requesterPhone && r.requesterPhone.startsWith('+88') ? r.requesterPhone : null;
  return (
    <div className="card stack">
      <div className="cluster-sm">
        <Badge tone={URGENCY_TONE[r.urgency]}>{t.common.urgency[r.urgency]}</Badge>
        <Badge tone={STATUS_TONE[r.status]}>{t.common.requestStatus[r.status]}</Badge>
      </div>
      <dl className="dl">
        <dt>{t.common.bloodGroup}</dt>
        <dd>{r.bloodGroup}</dd>
        <dt>{t.request.units}</dt>
        <dd>{t.request.unitsCount(n(r.units))}</dd>
        <dt>{t.request.hospital}</dt>
        <dd>{r.hospitalName}</dd>
        <dt>{t.request.area}</dt>
        <dd>{place}</dd>
        <dt>{t.request.neededAt}</dt>
        <dd>{dateTime(r.neededAt)}</dd>
        <dt>{t.request.postedAt}</dt>
        <dd>{dateTime(r.createdAt)}</dd>
        <dt>{t.request.assignedTo}</dt>
        <dd>{view.assignedCommunity ? <Link href={`/communities/${view.assignedCommunity.slug}`}>{view.assignedCommunity.name}</Link> : <span className="muted">{t.request.notAssigned}</span>}</dd>
      </dl>
      <div className="stack-sm">
        {view.counts.confirmed > 0 && <p style={{ margin: 0, fontWeight: 600 }}>{t.request.confirmedCount(n(view.counts.confirmed))}</p>}
        {view.counts.offered > 0 && <p style={{ margin: 0 }}>{t.request.offeredCount(n(view.counts.offered))}</p>}
        {view.counts.offered + view.counts.confirmed === 0 && <p className="muted" style={{ margin: 0 }}>{t.request.noResponsesYet}</p>}
      </div>
      {r.note && (
        <div>
          <p className="small muted" style={{ margin: 0 }}>
            {t.request.requesterNote}
          </p>
          <p style={{ margin: 0 }}>{r.note}</p>
        </div>
      )}
      <hr style={{ margin: 0 }} />
      <h2 style={{ fontSize: '1.1rem', margin: 0 }}>{t.request.requesterContact}</h2>
      {phone ? (
        <div className="stack-sm">
          {r.requesterName && <p style={{ margin: 0 }}>{r.requesterName}</p>}
          <p className="phone-reveal" style={{ margin: 0 }}>
            {formatBdPhone(phone)}
          </p>
          <p className="small muted" style={{ margin: 0 }}>
            {t.common.contactMethod[r.contactPreference]}
          </p>
          <div className="cluster-sm">
            <a className="btn btn-primary btn-sm" href={`tel:${phone}`}>
              <Phone size={16} aria-hidden="true" />
              {t.common.actions.call}
            </a>
            <a className="btn btn-sm" href={`sms:${phone}`}>
              <MessageCircle size={16} aria-hidden="true" />
              {t.common.actions.sendSms}
            </a>
            {r.contactPreference === 'whatsapp' && (
              <a className="btn btn-sm" href={`https://wa.me/${phone.replace('+', '')}`} rel="noopener noreferrer" target="_blank">
                {t.common.actions.whatsapp}
              </a>
            )}
          </div>
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          {r.contactPreference === 'coordinator_only' ? t.request.coordinatorOnlyNote : t.request.requesterContactHidden}
        </p>
      )}
      {(r.urgency === 'critical' || r.urgency === 'urgent') && (r.status === 'open' || r.status === 'in_progress') && <Alert tone="warning">{t.request.urgentAdvice}</Alert>}
    </div>
  );
}
