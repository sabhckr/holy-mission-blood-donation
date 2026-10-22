import Link from 'next/link';
import { MapPin } from 'lucide-react';
import type { DonorView } from '@/server/domain/donor-view';
import type { I18n } from '@/i18n/server';
import { AvailabilityInfo, BloodGroupBadge, VerificationBadge } from './ui';

export function DonorCard({ donor, place, i18n, href }: { donor: DonorView; place: string; i18n: I18n; href?: string }) {
  const { t, n, date, instantDate } = i18n;
  return (
    <article className="card card-tight donor-card">
      <div className="donor-card-row">
        <BloodGroupBadge group={donor.bloodGroup} label={t.common.bloodGroup} />
        <div className="stack-sm donor-card-body">
          <h3 className="card-title">
            <Link href={href ?? `/donors/${donor.publicId}`}>{donor.name}</Link>
          </h3>
          <p className="small muted donor-card-place">
            <MapPin size={14} aria-hidden="true" /> {[donor.locality, place].filter(Boolean).join(', ')}
          </p>
          <div className="cluster-sm">
            <VerificationBadge status={donor.verificationStatus} t={t} />
          </div>
          <AvailabilityInfo
            state={donor.availability}
            source={donor.availabilitySource}
            updated={donor.availabilityConfirmedAt ? instantDate(donor.availabilityConfirmedAt) : null}
            t={t}
            note
          />
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
