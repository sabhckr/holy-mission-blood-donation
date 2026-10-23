import Link from 'next/link';
import { ArrowRight, BadgeCheck, Droplet, MapPin, ShieldCheck, UserRound } from 'lucide-react';
import type { DonorView } from '@/server/domain/donor-view';
import type { I18n } from '@/i18n/server';
import { AvailabilityBadge, BloodGroupBadge } from './ui';

/**
 * One search result: group, name (with a check when verified), place, availability with who said
 * it and when (staff updates are labelled as such), a short donation line and one button.
 */
export function DonorCard({ donor, place, i18n, href }: { donor: DonorView; place: string; i18n: I18n; href?: string }) {
  const { t, n, date, instantDate } = i18n;
  const a = t.common.availability;
  const link = href ?? `/donors/${donor.publicId}`;
  const updated = donor.availabilityConfirmedAt ? instantDate(donor.availabilityConfirmedAt) : null;
  const SourceIcon = donor.availabilitySource === 'staff' ? ShieldCheck : UserRound;
  return (
    <article className="card donor-card">
      <div className="donor-card-head">
        <BloodGroupBadge group={donor.bloodGroup} label={t.common.bloodGroup} />
        <div className="donor-card-id">
          <h3 className="card-title">
            <Link href={link}>{donor.name}</Link>
            {donor.verificationStatus === 'verified' && (
              <span className="verified-mark">
                <BadgeCheck size={18} aria-hidden="true" />
                <span className="visually-hidden">{t.common.verification.verified}</span>
              </span>
            )}
          </h3>
          <p className="donor-card-place">
            <MapPin size={15} aria-hidden="true" />
            <span>{[donor.locality, place].filter(Boolean).join(', ')}</span>
          </p>
        </div>
      </div>

      <div className="donor-card-status">
        <AvailabilityBadge state={donor.availability} t={t} />
        {(donor.availabilitySource || updated) && (
          <p className="pub-meta">
            <SourceIcon size={14} aria-hidden="true" />
            <span>{[donor.availabilitySource ? (donor.availabilitySource === 'staff' ? a.sourceStaff : a.sourceDonor) : null, updated].filter(Boolean).join(' · ')}</span>
          </p>
        )}
      </div>

      <p className="pub-meta donor-card-stats">
        <Droplet size={14} aria-hidden="true" />
        <span>
          {donor.stats ? (
            <>
              {t.search.donations(n(donor.stats.verifiedCount), n(donor.stats.reportedCount))}
              {donor.stats.lastDonation && (
                <>
                  {' · '}
                  {t.search.lastDonation}: {date(donor.stats.lastDonation, 'short')}
                </>
              )}
            </>
          ) : (
            t.search.hiddenStats
          )}
        </span>
      </p>

      <Link className="btn btn-soft btn-block donor-card-cta" href={link}>
        {t.search.detailsAndContact}
        <span className="visually-hidden">: {donor.name}</span>
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </article>
  );
}
