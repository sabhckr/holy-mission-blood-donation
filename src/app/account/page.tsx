import type { Metadata } from 'next';
import Link from 'next/link';
import { Bell, HeartPulse, Inbox, Users } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { requireActor } from '@/server/auth/current';
import { myCommunities } from '@/server/services/communities';
import { pendingIncomingCount } from '@/server/services/contact';
import { getOwnDonorOverview } from '@/server/services/donors';
import { getLocationIndex, labelFrom } from '@/server/services/location-index';
import { listNotifications, renderNotification } from '@/server/services/notifications';
import { myDeletionRequest } from '@/server/services/privacy';
import { myRequests, myResponses } from '@/server/services/requests';
import { getSettings } from '@/server/services/settings';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { EligibilityCard } from '@/components/account/EligibilityCard';
import { Alert, AvailabilityBadge, Badge, BloodGroupBadge, Stat } from '@/components/ui';
import type { Messages } from '@/i18n/messages';
import type { donorProfiles } from '@/server/db/schema';
import { reactivateAction, setAvailabilityAction, setListingPausedAction } from './actions';

type DonorRow = typeof donorProfiles.$inferSelect;
type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const REGISTRATION_TONE: Record<DonorRow['registrationStatus'], Tone> = { pending: 'warning', approved: 'success', rejected: 'danger' };
const LISTING_TONE: Record<DonorRow['status'], Tone> = { active: 'success', paused: 'neutral', restricted: 'danger', removed: 'danger' };

/**
 * Registration review status (pending / approved / rejected). Kept apart from the listing status,
 * availability and profile verification, which are separate things.
 */
function RegistrationBanner({ donor, t }: { donor: Pick<DonorRow, 'registrationStatus' | 'registrationNote'>; t: Messages }) {
  const d = t.account.dashboard;
  if (donor.registrationStatus === 'pending') {
    return (
      <Alert tone="info" title={d.registrationPendingTitle}>
        <p>{d.registrationPendingBody}</p>
        <p style={{ marginBottom: 'var(--space-1)' }}>{d.registrationPendingMeanwhile}</p>
        <ul className="stack-sm" style={{ paddingLeft: '1.2rem', margin: 0 }}>
          <li>
            <Link href="/account/profile">{d.registrationPendingStepProfile}</Link>
          </li>
          <li>
            <Link href="/account/privacy">{d.registrationPendingStepPrivacy}</Link>
          </li>
          <li>
            <Link href="/account/donations">{d.registrationPendingStepHistory}</Link>
          </li>
          <li>
            <a href="#availability-title">{d.registrationPendingStepAvailability}</a>
          </li>
        </ul>
      </Alert>
    );
  }
  if (donor.registrationStatus === 'rejected') {
    return (
      <Alert tone="warning" title={d.registrationRejectedTitle}>
        <p>{donor.registrationNote ? d.registrationReason(donor.registrationNote) : d.registrationNoReason}</p>
        <p>{d.registrationRejectedBody}</p>
        <Link className="btn btn-primary btn-sm" href="/account/profile">
          {d.registrationRejectedCta}
        </Link>
      </Alert>
    );
  }
  return (
    <Alert tone="success" title={d.registrationApprovedTitle}>
      <p style={{ margin: 0 }}>{d.registrationApprovedBody}</p>
    </Alert>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.dashboard.title, robots: { index: false } };
}

export default async function AccountDashboard({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const i18n = await getI18n();
  const { t, n, date, instantDate, dateTime, locale } = i18n;
  const d = t.account.dashboard;
  const actor = await requireActor('/account', { allowDeactivated: true });
  const { welcome } = await searchParams;

  if (actor.status === 'deactivated') {
    return (
      <>
        <h1>{d.title}</h1>
        <Alert tone="warning" title={d.deactivatedTitle}>
          <p>{d.deactivatedBody}</p>
          <ActionForm action={reactivateAction} className="stack-sm">
            <SubmitButton label={d.reactivate} pendingLabel={t.common.actions.saving} />
          </ActionForm>
        </Alert>
      </>
    );
  }

  const [overview, pendingContacts, notes, comms, requests, offers, deletion, settings, index] = await Promise.all([
    getOwnDonorOverview(actor),
    pendingIncomingCount(actor),
    listNotifications(actor.userId, 5),
    myCommunities(actor),
    myRequests(actor),
    myResponses(actor),
    myDeletionRequest(actor),
    getSettings(),
    getLocationIndex(),
  ]);
  // Deactivated or removed by staff: the donor cannot change availability or the listing.
  const staffHidden = !!overview && (overview.donor.status === 'restricted' || overview.donor.status === 'removed');

  return (
    <>
      <div className="cluster between">
        <h1 style={{ marginBottom: 0 }}>{d.hello(actor.displayName)}</h1>
        {overview && <BloodGroupBadge group={overview.donor.bloodGroup} label={t.common.bloodGroup} />}
      </div>

      {welcome === '1' && (
        <Alert tone="success" title={d.welcomeTitle}>
          <p>{d.welcomeBody}</p>
        </Alert>
      )}
      {deletion && (
        <Alert tone="warning" title={d.deletionPendingTitle}>
          <p>{d.deletionPendingBody}</p>
          <Link href="/account/security">{t.account.nav.security}</Link>
        </Alert>
      )}

      {!overview ? (
        <section className="card card-accent stack">
          <h2 style={{ fontSize: '1.15rem' }}>{d.noDonorTitle}</h2>
          <p>{d.noDonorBody}</p>
          <Link className="btn btn-primary" href="/account/profile">
            {d.createDonorCta}
          </Link>
        </section>
      ) : (
        <>
          <RegistrationBanner donor={overview.donor} t={t} />

          {staffHidden && (
            <Alert tone="warning" title={overview.donor.status === 'removed' ? d.listingRemovedTitle : d.listingRestrictedTitle}>
              <p>{d.listingStaffBody}</p>
              <p>{overview.donor.restrictedReason ? d.registrationReason(overview.donor.restrictedReason) : d.registrationNoReason}</p>
              <p style={{ margin: 0 }}>
                {d.listingStaffContact} <Link href="/contact">{d.contactUs}</Link>
              </p>
            </Alert>
          )}

          <div className="grid grid-2">
            <section className="card stack" aria-labelledby="availability-title">
              <h2 id="availability-title" className="cluster-sm" style={{ fontSize: '1.15rem' }}>
                <HeartPulse size={20} aria-hidden="true" />
                {d.availabilityTitle}
              </h2>
              <div>
                <AvailabilityBadge state={overview.availability} t={t} />
              </div>
              {staffHidden ? (
                <p style={{ margin: 0 }}>{d.availabilityLocked}</p>
              ) : (
                <>
                  {overview.donor.availabilityConfirmedAt ? (
                    overview.donor.availabilitySource === 'staff' ? (
                      <Alert tone="info">
                        <p style={{ margin: 0 }}>{d.availabilitySourceStaff}</p>
                        <p className="small" style={{ margin: 0 }}>
                          {t.common.availability.lastUpdated(instantDate(overview.donor.availabilityConfirmedAt))}
                        </p>
                      </Alert>
                    ) : (
                      <p className="small" style={{ margin: 0 }}>
                        {d.availabilitySourceDonor} · {t.common.availability.lastUpdated(instantDate(overview.donor.availabilityConfirmedAt))}
                      </p>
                    )
                  ) : (
                    <p className="small" style={{ margin: 0 }}>
                      {d.availabilityNever}
                    </p>
                  )}
                  {overview.availability === 'available' && overview.donor.availabilityExpiresAt && (
                    <p className="small" style={{ margin: 0 }}>
                      {d.availabilityValidUntil(instantDate(overview.donor.availabilityExpiresAt))}
                    </p>
                  )}
                  {overview.availability === 'unknown' && overview.donor.availabilityConfirmedAt && <Alert tone="warning">{d.availabilityExpired}</Alert>}
                  <div className="cluster-sm" role="group" aria-label={d.availabilityButtonsLabel}>
                    <ActionForm action={setAvailabilityAction} className="stack-sm">
                      <input type="hidden" name="status" value="available" />
                      <SubmitButton label={d.availableButton} pendingLabel={t.common.actions.saving} className="btn btn-primary" />
                    </ActionForm>
                    <ActionForm action={setAvailabilityAction} className="stack-sm">
                      <input type="hidden" name="status" value="unavailable" />
                      <SubmitButton label={d.unavailableButton} pendingLabel={t.common.actions.saving} className="btn" />
                    </ActionForm>
                  </div>
                  <p className="small muted" style={{ margin: 0 }}>
                    {d.availabilityExplain(n(settings.availabilityExpiryDays))} {d.availabilitySearchNote}
                  </p>
                </>
              )}
            </section>
            <EligibilityCard estimate={overview.estimate} i18n={i18n} />
          </div>

          <section className="card stack" aria-labelledby="listing-title">
            <h2 id="listing-title" style={{ fontSize: '1.15rem' }}>
              {d.listingTitle}
            </h2>
            <dl className="dl">
              <dt>{d.registrationLabel}</dt>
              <dd>
                <Badge tone={REGISTRATION_TONE[overview.donor.registrationStatus]}>{t.common.registrationStatus[overview.donor.registrationStatus]}</Badge>
              </dd>
              <dt>{d.listingStatusLabel}</dt>
              <dd>
                <Badge tone={LISTING_TONE[overview.donor.status]}>{t.common.listingStatus[overview.donor.status]}</Badge>
              </dd>
            </dl>
            {staffHidden ? (
              <p style={{ margin: 0 }}>{d.listingStaffBody}</p>
            ) : overview.donor.status === 'paused' ? (
              <>
                <p style={{ margin: 0 }}>{d.listingPaused}</p>
                <ActionForm action={setListingPausedAction} className="stack-sm">
                  <input type="hidden" name="paused" value="false" />
                  <SubmitButton label={d.resumeButton} pendingLabel={t.common.actions.saving} className="btn btn-primary" />
                </ActionForm>
              </>
            ) : (
              <>
                <p style={{ margin: 0 }}>
                  {!overview.consents.listedInSearch
                    ? d.listingNotListed
                    : overview.donor.registrationStatus !== 'approved'
                      ? d.listingNotApproved
                      : overview.availability === 'available'
                        ? d.listingVisible
                        : d.listingNeedsAvailable}
                </p>
                <div className="cluster-sm">
                  <Link className="btn btn-sm" href={`/donors/${overview.donor.publicId}`}>
                    {d.viewMyProfile}
                  </Link>
                  <ActionForm action={setListingPausedAction} className="stack-sm">
                    <input type="hidden" name="paused" value="true" />
                    <SubmitButton label={d.pauseButton} pendingLabel={t.common.actions.saving} className="btn btn-sm" />
                  </ActionForm>
                </div>
              </>
            )}
          </section>

          <section aria-labelledby="stats-title" className="stack">
            <h2 id="stats-title" style={{ fontSize: '1.15rem' }}>
              {d.statsTitle}
            </h2>
            <div className="grid grid-3">
              <Stat value={n(overview.stats.verifiedCount)} label={d.statsVerified} />
              <Stat value={n(overview.stats.reportedCount)} label={d.statsReported} />
              <Stat value={overview.stats.lastDonation ? date(overview.stats.lastDonation, 'short') : t.common.states.none} label={d.statsLast} />
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              {t.account.donations.verifiedHelp} <Link href="/account/donations">{t.account.nav.donations}</Link>
            </p>
          </section>
        </>
      )}

      <div className="grid grid-2">
        <section className="card stack" aria-labelledby="contact-title">
          <h2 id="contact-title" className="cluster-sm" style={{ fontSize: '1.15rem' }}>
            <Inbox size={20} aria-hidden="true" />
            {d.contactTitle}
          </h2>
          <p style={{ margin: 0 }}>{pendingContacts > 0 ? d.contactPending(n(pendingContacts)) : d.contactNone}</p>
          <Link href="/account/contact-requests">{t.common.actions.viewAll}</Link>
        </section>

        <section className="card stack" aria-labelledby="notes-title">
          <h2 id="notes-title" className="cluster-sm" style={{ fontSize: '1.15rem' }}>
            <Bell size={20} aria-hidden="true" />
            {d.notificationsTitle}
          </h2>
          {notes.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              {t.notifications.empty}
            </p>
          ) : (
            <ul className="list-plain list-divided">
              {notes.map((note) => {
                const r = renderNotification(locale, note.kind, note.data);
                return (
                  <li key={note.id}>
                    <p style={{ margin: 0, fontWeight: note.readAt ? 400 : 700 }}>
                      {note.link ? <Link href={note.link}>{r.title}</Link> : r.title}
                    </p>
                    <p className="small muted" style={{ margin: 0 }}>
                      {dateTime(note.createdAt)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/account/notifications">{t.common.actions.viewAll}</Link>
        </section>
      </div>

      <section className="card stack" aria-labelledby="comms-title">
        <h2 id="comms-title" className="cluster-sm" style={{ fontSize: '1.15rem' }}>
          <Users size={20} aria-hidden="true" />
          {d.communitiesTitle}
        </h2>
        {comms.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {d.communitiesNone}
          </p>
        ) : (
          <ul className="list-plain cluster-sm">
            {comms.map((c) => (
              <li key={c.membership.id}>
                <Link href={`/communities/${c.community.slug}`}>{locale === 'en' && c.community.nameEn ? c.community.nameEn : c.community.name}</Link>{' '}
                <Badge tone={c.membership.status === 'active' ? 'success' : 'warning'}>{t.account.communities.membershipStatus[c.membership.status]}</Badge>
              </li>
            ))}
          </ul>
        )}
        <Link href="/account/communities">{t.common.actions.viewAll}</Link>
      </section>

      <div className="grid grid-2">
        <section className="card stack" aria-labelledby="requests-title">
          <h2 id="requests-title" style={{ fontSize: '1.15rem' }}>
            {d.requestsTitle}
          </h2>
          {requests.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              {d.requestsNone}
            </p>
          ) : (
            <ul className="list-plain list-divided">
              {requests.slice(0, 10).map((r) => (
                <li key={r.id} className="cluster" style={{ flexWrap: 'nowrap' }}>
                  <BloodGroupBadge group={r.bloodGroup} small label={t.common.bloodGroup} />
                  <span style={{ minWidth: 0 }}>
                    <Link href={`/requests/${r.publicId}`}>{r.hospitalName}</Link>
                    <br />
                    <span className="small muted">
                      {labelFrom(index, locale, r.upazilaId, r.districtId)} · {t.common.requestStatus[r.status]}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link className="btn btn-sm" href="/requests/new">
            {d.newRequest}
          </Link>
        </section>

        <section className="card stack" aria-labelledby="offers-title">
          <h2 id="offers-title" style={{ fontSize: '1.15rem' }}>
            {d.offersTitle}
          </h2>
          {offers.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              {d.offersNone}
            </p>
          ) : (
            <ul className="list-plain list-divided">
              {offers.slice(0, 10).map((o) => (
                <li key={o.response.id} className="cluster" style={{ flexWrap: 'nowrap' }}>
                  <BloodGroupBadge group={o.request.bloodGroup} small label={t.common.bloodGroup} />
                  <span style={{ minWidth: 0 }}>
                    <Link href={`/requests/${o.request.publicId}`}>{o.request.hospitalName}</Link>
                    <br />
                    <span className="small muted">{d.offerStatus[o.response.status]}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
