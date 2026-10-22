import Link from 'next/link';
import { Clock, Hospital, MapPin } from 'lucide-react';
import type { I18n } from '@/i18n/server';
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

export function RequestCard({ item, place, i18n, href }: { item: RequestCardItem; place: string; i18n: I18n; href?: string }) {
  const { t, n, dateTime } = i18n;
  return (
    <article className="card card-tight">
      <div className="cluster" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <BloodGroupBadge group={item.bloodGroup} label={t.common.bloodGroup} />
        <div className="stack-sm" style={{ minWidth: 0, flex: 1 }}>
          <h3 className="card-title">
            <Link href={href ?? `/requests/${item.publicId}`}>{t.request.detailTitle(item.bloodGroup)}</Link>
          </h3>
          <div className="cluster-sm">
            <Badge tone={URGENCY_TONE[item.urgency]}>{t.common.urgency[item.urgency]}</Badge>
            <Badge tone={STATUS_TONE[item.status]}>{t.common.requestStatus[item.status]}</Badge>
            <Badge>{t.request.unitsCount(n(item.units))}</Badge>
          </div>
          <p className="small" style={{ margin: 0 }}>
            <Hospital size={14} aria-hidden="true" /> {item.hospitalName}
          </p>
          <p className="small muted" style={{ margin: 0 }}>
            <MapPin size={14} aria-hidden="true" /> {place}
          </p>
          <p className="small muted" style={{ margin: 0 }}>
            <Clock size={14} aria-hidden="true" /> {t.request.neededAt}: {dateTime(item.neededAt)}
          </p>
        </div>
      </div>
    </article>
  );
}
