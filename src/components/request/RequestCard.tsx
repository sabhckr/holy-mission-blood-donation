import Link from 'next/link';
import { ArrowRight, CalendarDays, Clock, Droplet, MapPin, Siren } from 'lucide-react';
import type { I18n } from '@/i18n/server';
import type { Messages } from '@/i18n/messages';
import type { RequestStatus, Urgency } from '@/server/domain/constants';
import { Badge, BloodGroupBadge } from '../ui';

export interface RequestCardItem {
  publicId: string;
  bloodGroup: string;
  units: number;
  hospitalName: string;
  neededAt: Date;
  urgency: Urgency;
  status: RequestStatus;
}

export const URGENCY_TONE: Record<Urgency, 'danger' | 'warning' | 'neutral'> = { critical: 'danger', urgent: 'warning', normal: 'neutral' };
export const STATUS_TONE: Record<RequestStatus, 'success' | 'warning' | 'neutral' | 'info' | 'danger'> = {
  open: 'info',
  in_progress: 'warning',
  fulfilled: 'success',
  cancelled: 'neutral',
  expired: 'neutral',
};

const URGENCY_ICON = { critical: Siren, urgent: Clock, normal: CalendarDays } as const;

/** Urgency as colour + icon + word. */
export function UrgencyPill({ urgency, t }: { urgency: Urgency; t: Messages }) {
  const Icon = URGENCY_ICON[urgency];
  return (
    <span className={`urgency urgency-${urgency}`}>
      <Icon size={14} aria-hidden="true" />
      {t.common.urgency[urgency]}
    </span>
  );
}

export function RequestCard({ item, place, i18n, href }: { item: RequestCardItem; place: string; i18n: I18n; href?: string }) {
  const { t, n, dateTime } = i18n;
  const link = href ?? `/requests/${item.publicId}`;
  return (
    <article className="card request-item">
      <div className="donor-card-head">
        <BloodGroupBadge group={item.bloodGroup} label={t.common.bloodGroup} />
        <div className="donor-card-id">
          <h3 className="card-title">
            <Link href={link}>{item.hospitalName}</Link>
          </h3>
          <p className="donor-card-place">
            <MapPin size={15} aria-hidden="true" />
            <span>{place}</span>
          </p>
        </div>
      </div>
      <div className="cluster-sm">
        <UrgencyPill urgency={item.urgency} t={t} />
        {item.status !== 'open' && <Badge tone={STATUS_TONE[item.status]}>{t.common.requestStatus[item.status]}</Badge>}
        <Badge>
          <Droplet size={13} aria-hidden="true" />
          {t.request.unitsCount(n(item.units))}
        </Badge>
      </div>
      <p className="pub-meta request-when">
        <Clock size={15} aria-hidden="true" />
        <span>
          {t.request.neededAt}: <strong>{dateTime(item.neededAt)}</strong>
        </span>
      </p>
      <Link className="btn btn-soft btn-block donor-card-cta" href={link}>
        {t.request.viewDetails}
        <span className="visually-hidden">: {t.request.detailTitle(item.bloodGroup)}</span>
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </article>
  );
}
