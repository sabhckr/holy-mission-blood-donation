import Link from 'next/link';
import { Building2, CalendarPlus, Clock, Droplet, Hospital, MapPin, MessageCircle, MessageSquareText, Phone, UserRound, Users } from 'lucide-react';
import type { I18n } from '@/i18n/server';
import { formatBdPhone } from '@/server/domain/phone';
import { Alert, Badge } from '../ui';
import { STATUS_TONE, UrgencyPill } from './RequestCard';
import type { RequestView } from './ManagePanel';

/**
 * Status card (urgency, status, the facts, who responded) and, as a second card, the requester's
 * contact — the number only when the viewer is allowed to see it.
 */
export function RequestSummary({ view, place, i18n }: { view: RequestView; place: string; i18n: I18n }) {
  const { t, n, dateTime } = i18n;
  const r = view.request;
  const phone = r.requesterPhone && r.requesterPhone.startsWith('+88') ? r.requesterPhone : null;
  const open = r.status === 'open' || r.status === 'in_progress';
  const facts = [
    [Droplet, t.request.units, t.request.unitsCount(n(r.units))],
    [Hospital, t.request.hospital, r.hospitalName],
    [MapPin, t.request.area, place],
    [Clock, t.request.neededAt, dateTime(r.neededAt)],
    [CalendarPlus, t.request.postedAt, dateTime(r.createdAt)],
  ] as const;
  return (
    <>
      <section className="card request-status stack" aria-labelledby="request-summary-title">
        <h2 id="request-summary-title" className="visually-hidden">
          {t.request.summaryTitle}
        </h2>
        <div className="cluster-sm request-status-badges">
          <UrgencyPill urgency={r.urgency} t={t} />
          <Badge tone={STATUS_TONE[r.status]}>{t.common.requestStatus[r.status]}</Badge>
        </div>
        <ul className="info-list info-grid">
          {facts.map(([Icon, label, value]) => (
            <li key={label}>
              <Icon size={18} aria-hidden="true" />
              <div>
                <span className="info-label">{label}</span>
                <span className="info-value">{value}</span>
              </div>
            </li>
          ))}
          <li>
            <Building2 size={18} aria-hidden="true" />
            <div>
              <span className="info-label">{t.request.assignedTo}</span>
              <span className="info-value">
                {view.assignedCommunity ? <Link href={`/communities/${view.assignedCommunity.slug}`}>{view.assignedCommunity.name}</Link> : <span className="muted">{t.request.notAssigned}</span>}
              </span>
            </div>
          </li>
        </ul>
        <div className="response-box">
          <h3 className="pub-subhead">
            <Users size={18} aria-hidden="true" />
            {t.request.responsesSummary}
          </h3>
          {view.counts.confirmed > 0 && <p className="response-confirmed">{t.request.confirmedCount(n(view.counts.confirmed))}</p>}
          {view.counts.offered > 0 && <p>{t.request.offeredCount(n(view.counts.offered))}</p>}
          {view.counts.offered + view.counts.confirmed === 0 && <p className="muted">{t.request.noResponsesYet}</p>}
        </div>
        {r.note && (
          <div className="pub-meta request-note">
            <MessageSquareText size={16} aria-hidden="true" />
            <div>
              <span className="info-label">{t.request.requesterNote}</span>
              <p>{r.note}</p>
            </div>
          </div>
        )}
        {(r.urgency === 'critical' || r.urgency === 'urgent') && open && <Alert tone="warning">{t.request.urgentAdvice}</Alert>}
      </section>

      <section className="card stack" aria-labelledby="requester-contact-title">
        <h2 id="requester-contact-title" className="pub-panel-title">
          <Phone size={20} aria-hidden="true" />
          {t.request.requesterContact}
        </h2>
        {phone ? (
          <div className="revealed-number">
            {r.requesterName && (
              <p className="pub-meta">
                <UserRound size={16} aria-hidden="true" />
                <span>{r.requesterName}</span>
              </p>
            )}
            <p className="phone-reveal" style={{ margin: 0 }}>
              {formatBdPhone(phone)}
            </p>
            <p className="small muted" style={{ margin: 0 }}>
              {t.common.contactMethod[r.contactPreference]}
            </p>
            <div className="revealed-actions">
              <a className="btn btn-primary btn-lg" href={`tel:${phone}`}>
                <Phone size={18} aria-hidden="true" />
                {t.common.actions.call}
              </a>
              <a className="btn" href={`sms:${phone}`}>
                <MessageCircle size={18} aria-hidden="true" />
                {t.common.actions.sendSms}
              </a>
              {r.contactPreference === 'whatsapp' && (
                <a className="btn" href={`https://wa.me/${phone.replace('+', '')}`} rel="noopener noreferrer" target="_blank">
                  {t.common.actions.whatsapp}
                </a>
              )}
            </div>
          </div>
        ) : (
          <p className="muted" style={{ marginBottom: 0 }}>
            {r.contactPreference === 'coordinator_only' ? t.request.coordinatorOnlyNote : t.request.requesterContactHidden}
          </p>
        )}
      </section>
    </>
  );
}
