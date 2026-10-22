import Link from 'next/link';
import { MapPin } from 'lucide-react';
import type { DonorView } from '@/server/domain/donor-view';
import type { I18n } from '@/i18n/server';
import { AvailabilityBadge, BloodGroupBadge, VerificationBadge } from './ui';

export function DonorCard({ donor, place, i18n, href }: { donor: DonorView; place: string; i18n: I18n; href?: string }) {
  const { t, n, date } = i18n;
  return (
    <article className="card card-tight">
      <div className="cluster" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <BloodGroupBadge group={donor.bloodGroup} label={t.common.bloodGroup} />
        <div className="stack-sm" style={{ minWidth: 0, flex: 1 }}>
          <h3 className="card-title">
            <Link href={href ?? `/donors/${donor.publicId}`}>{donor.name}</Link>
          </h3>
          <p className="small muted" style={{ margin: 0 }}>
            <MapPin size={14} aria-hidden="true" /> {[donor.locality, place].filter(Boolean).join(', ')}
          </p>
          <div className="cluster-sm">
            <AvailabilityBadge state={donor.availability} t={t} />
            <VerificationBadge status={donor.verificationStatus} t={t} />
          </div>
          {donor.stats ? (
            <p className="small" style={{ margin: 0 }}>
              {t.search.donations(n(donor.stats.verifiedCount), n(donor.stats.reportedCount))}
              {donor.stats.lastDonation && (
                <>
                  {' · '}
                  {t.search.lastDonation}: {date(donor.stats.lastDonation, 'short')}
                </>
              )}
            </p>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>
              {t.search.hiddenStats}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
