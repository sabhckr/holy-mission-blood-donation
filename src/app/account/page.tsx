import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Ban,
  Bell,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  CircleX,
  ClipboardCheck,
  Droplet,
  Droplets,
  EyeOff,
  HeartPulse,
  Hourglass,
  Inbox,
  LockKeyhole,
  Search,
  ShieldCheck,
  Siren,
  UserCog,
  UserRound,
} from 'lucide-react';
import { getI18n, type I18n } from '@/i18n/server';
import { requireActor } from '@/server/auth/current';
import { pendingIncomingCount } from '@/server/services/contact';
import { getOwnDonorOverview } from '@/server/services/donors';
import { getServiceArea } from '@/server/services/service-area';
import { getLocationIndex, labelFrom } from '@/server/services/location-index';
import { unreadCount } from '@/server/services/notifications';
import { myDeletionRequest } from '@/server/services/privacy';
import { myRequests, myResponses } from '@/server/services/requests';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { EligibilityCard } from '@/components/account/EligibilityCard';
import { Avatar, IconTile, PageHead, type IconTone } from '@/components/account/bits';
import { Alert, AvailabilityBadge, Badge, BloodGroupBadge } from '@/components/ui';
import { STATUS_TONE } from '@/components/request/RequestCard';
import { reactivateAction, setAvailabilityAction, setListingPausedAction } from './actions';

type Overview = NonNullable<Awaited<ReturnType<typeof getOwnDonorOverview>>>;
type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const REGISTRATION = {
  pending: { tone: 'warning', icon: Hourglass },
  approved: { tone: 'success', icon: BadgeCheck },
  rejected: { tone: 'danger', icon: CircleX },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.dashboard.title, robots: { index: false } };
}

/** Where the donor stands in search: one badge, one line, and the action that fits. */
function listingState(o: Overview, t: I18n['t']): { tone: Tone; icon: typeof Search; badge: string; hint: string } {
  const d = t.account.dashboard;
  const { donor } = o;
  if (donor.status === 'restricted' || donor.status === 'removed') return { tone: 'danger', icon: Ban, badge: t.common.listingStatus[donor.status], hint: d.listingStaffBody };
  if (donor.status === 'paused') return { tone: 'neutral', icon: EyeOff, badge: d.listingBadge.paused, hint: d.listingPaused };
  if (!o.consents.listedInSearch) return { tone: 'neutral', icon: EyeOff, badge: d.listingBadge.hidden, hint: d.listingNotListed };
  if (donor.registrationStatus !== 'approved') return { tone: 'warning', icon: Search, badge: d.listingBadge.hidden, hint: d.listingNotApproved };
  if (o.availability === 'available') return { tone: 'success', icon: Search, badge: d.listingBadge.visible, hint: d.listingVisible };
  return { tone: 'warning', icon: Search, badge: d.listingBadge.hidden, hint: d.listingNeedsAvailable };
}

/** One card that says what to do next, depending on the donor's state. */
function NextStep({ o, i18n }: { o: Overview; i18n: I18n }) {
  const { t } = i18n;
  const d = t.account.dashboard;
  const { donor } = o;
  if (donor.status === 'restricted' || donor.status === 'removed') {
    return (
      <section className="card acct-next acct-next-danger" aria-labelledby="next-title">
        <div className="acct-next-head">
          <IconTile icon={Ban} tone="danger" />
          <div>
            <span className="acct-next-kicker">{d.nextKicker}</span>
            <h2 id="next-title">{donor.status === 'removed' ? d.listingRemovedTitle : d.listingRestrictedTitle}</h2>
          </div>
        </div>
        <p className="acct-reason">{donor.restrictedReason ? d.registrationReason(donor.restrictedReason) : d.registrationNoReason}</p>
        <p style={{ margin: 0 }}>{d.listingStaffContact}</p>
        <div>
          <Link className="btn btn-soft" href="/contact">
            {d.contactUs}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
    );
  }
  if (donor.registrationStatus === 'rejected') {
    return (
      <section className="card acct-next acct-next-warning" aria-labelledby="next-title">
        <div className="acct-next-head">
          <IconTile icon={CircleAlert} tone="warning" />
          <div>
            <span className="acct-next-kicker">{d.nextKicker}</span>
            <h2 id="next-title">{d.registrationRejectedTitle}</h2>
          </div>
        </div>
        <p className="acct-reason">{donor.registrationNote ? d.registrationReason(donor.registrationNote) : d.registrationNoReason}</p>
        <p style={{ margin: 0 }}>{d.registrationRejectedBody}</p>
        <div>
          <Link className="btn btn-dark" href="/account/profile">
            {d.registrationRejectedCta}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
    );
  }
  if (donor.registrationStatus === 'pending') {
    const steps = [
      { href: '/account/profile', icon: UserRound, label: d.registrationPendingStepProfile },
      { href: '/account/privacy', icon: ShieldCheck, label: d.registrationPendingStepPrivacy },
      { href: '/account/donations', icon: Droplet, label: d.registrationPendingStepHistory },
      { href: '#availability-title', icon: HeartPulse, label: d.registrationPendingStepAvailability },
    ];
    return (
      <section className="card card-accent acct-next" aria-labelledby="next-title">
        <div className="acct-next-head">
          <IconTile icon={Hourglass} />
          <div>
            <span className="acct-next-kicker">{d.nextKicker}</span>
            <h2 id="next-title">{d.registrationPendingTitle}</h2>
            <p>{d.registrationPendingBody}</p>
          </div>
        </div>
        <p style={{ margin: 0, fontWeight: 700 }}>{d.registrationPendingMeanwhile}</p>
        <ul className="acct-checklist">
          {steps.map((s) => (
            <li key={s.href}>
              <Link href={s.href}>
                <IconTile icon={s.icon} small />
                <span>{s.label}</span>
                <ChevronRight size={18} aria-hidden="true" className="acct-arrow" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  if (!o.consents.listedInSearch && donor.status === 'active') {
    return (
      <section className="card card-accent acct-next" aria-labelledby="next-title">
        <div className="acct-next-head">
          <IconTile icon={EyeOff} />
          <div>
            <span className="acct-next-kicker">{d.nextKicker}</span>
            <h2 id="next-title">{d.nextNotListedTitle}</h2>
            <p>{d.listingNotListed}</p>
          </div>
        </div>
        <div>
          <Link className="btn btn-soft" href="/account/privacy">
            {d.changePrivacy}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
    );
  }
  // Approved and listed: the availability card above already holds the only action.
  return null;
}

export default async function AccountDashboard({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const i18n = await getI18n();
  const { t, n, date, instantDate, locale } = i18n;
  const d = t.account.dashboard;
  const actor = await requireActor('/account', { allowDeactivated: true });
  const { welcome } = await searchParams;

  if (actor.status === 'deactivated') {
    return (
      <>
        <PageHead title={d.title} />
        <Alert tone="warning" title={d.deactivatedTitle}>
          <p>{d.deactivatedBody}</p>
          <ActionForm action={reactivateAction} className="stack-sm">
            <SubmitButton label={d.reactivate} pendingLabel={t.common.actions.saving} />
          </ActionForm>
        </Alert>
      </>
    );
  }

  const [overview, pendingContacts, unread, requests, offers, deletion, index] = await Promise.all([
    getOwnDonorOverview(actor),
    pendingIncomingCount(actor),
    unreadCount(actor.userId),
    myRequests(actor),
    myResponses(actor),
    myDeletionRequest(actor),
    getLocationIndex(),
  ]);
  const outsideArea = !!overview && overview.donor.districtId !== (await getServiceArea()).districtId;
  const staffHidden = !!overview && (overview.donor.status === 'restricted' || overview.donor.status === 'removed');
  const reg = overview ? REGISTRATION[overview.donor.registrationStatus] : null;
  const listing = overview ? listingState(overview, t) : null;

  const links = [
    { href: '/account/profile', icon: UserRound, label: t.account.nav.profile, hint: d.linkHints.profile },
    { href: '/account/privacy', icon: ShieldCheck, label: t.account.nav.privacy, hint: d.linkHints.privacy },
    { href: '/account/donations', icon: Droplet, label: t.account.nav.donations, hint: d.linkHints.donations },
    {
      href: '/account/contact-requests',
      icon: Inbox,
      label: t.account.nav.contactRequests,
      hint: d.linkHints.contactRequests,
      badge: pendingContacts > 0 ? d.waitingCount(n(pendingContacts)) : null,
    },
    { href: '/account/notifications', icon: Bell, label: t.account.nav.notifications, hint: d.linkHints.notifications, badge: unread > 0 ? t.notifications.unread(n(unread)) : null },
    { href: '/account/communities', icon: Building2, label: t.account.nav.communities, hint: d.linkHints.communities },
    { href: '/account/security', icon: LockKeyhole, label: t.account.nav.security, hint: d.linkHints.security },
    { href: '/requests/new', icon: Siren, label: d.newRequest, hint: d.linkHints.newRequest },
  ];

  return (
    <>
      <div className="acct-hello">
        <Avatar name={actor.displayName} />
        <div>
          <h1>{d.hello(actor.displayName)}</h1>
          <p>{overview ? d.intro : d.introNoDonor}</p>
        </div>
        {overview && <BloodGroupBadge group={overview.donor.bloodGroup} label={t.common.bloodGroup} />}
      </div>

      {welcome === '1' && (
        <Alert tone="success" title={d.welcomeTitle}>
          <p>{d.welcomeBody}</p>
        </Alert>
      )}
      {outsideArea && (
        <Alert tone="warning" title={d.outsideTitle}>
          <p>{d.outsideBody}</p>
          <Link href="/account/profile">{d.outsideAction}</Link>
        </Alert>
      )}
      {deletion && (
        <Alert tone="warning" title={d.deletionPendingTitle}>
          <p>{d.deletionPendingBody}</p>
          <Link href="/account/security#deletion">{t.account.nav.security}</Link>
        </Alert>
      )}

      {!overview || !reg || !listing ? (
        <section className="card card-accent acct-next" aria-labelledby="no-donor-title">
          <div className="acct-next-head">
            <IconTile icon={HeartPulse} />
            <div>
              <h2 id="no-donor-title">{d.noDonorTitle}</h2>
              <p>{d.noDonorBody}</p>
            </div>
          </div>
          <div>
            <Link className="btn btn-primary btn-lg" href="/account/profile">
              {d.createDonorCta}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section aria-labelledby="status-title">
            <h2 id="status-title" className="visually-hidden">
              {d.statusTitle}
            </h2>
            <div className="acct-status-grid">
              <section className="card acct-status acct-status-reg" aria-labelledby="registration-title">
                <div className="acct-status-head">
                  <IconTile icon={ClipboardCheck} tone={reg.tone} />
                  <h3 id="registration-title">
                    {d.registrationLabel}
                  </h3>
                </div>
                <Badge tone={reg.tone}>
                  <reg.icon size={15} aria-hidden="true" />
                  {t.common.registrationStatus[overview.donor.registrationStatus]}
                </Badge>
                <p className="acct-status-hint">{d.registrationHint[overview.donor.registrationStatus]}</p>
              </section>

              <section className="card acct-status acct-status-list" aria-labelledby="listing-title">
                <div className="acct-status-head">
                  <IconTile icon={Search} tone={listing.tone === 'neutral' ? 'neutral' : listing.tone} />
                  <h3 id="listing-title">
                    {d.listingTitle}
                  </h3>
                </div>
                <Badge tone={listing.tone}>
                  <listing.icon size={15} aria-hidden="true" />
                  {listing.badge}
                </Badge>
                <p className="acct-status-hint">{listing.hint}</p>
                {!staffHidden && (
                  <div className="acct-status-foot">
                    {overview.donor.status === 'paused' ? (
                      <ActionForm action={setListingPausedAction} className="stack-sm">
                        <input type="hidden" name="paused" value="false" />
                        <SubmitButton label={d.resumeButton} pendingLabel={t.common.actions.saving} className="btn btn-soft btn-sm" />
                      </ActionForm>
                    ) : (
                      <>
                        {!overview.consents.listedInSearch && (
                          <Link className="btn btn-soft btn-sm" href="/account/privacy">
                            {d.changePrivacy}
                          </Link>
                        )}
                        <Link className="btn btn-sm" href={`/donors/${overview.donor.publicId}`}>
                          {d.viewMyProfile}
                        </Link>
                        <ActionForm action={setListingPausedAction} className="stack-sm">
                          <input type="hidden" name="paused" value="true" />
                          <SubmitButton label={d.pauseButton} pendingLabel={t.common.actions.saving} className="btn btn-sm btn-ghost" />
                        </ActionForm>
                      </>
                    )}
                  </div>
                )}
              </section>

              <section className="card acct-status acct-status-main" aria-labelledby="availability-title">
                <div className="acct-status-head">
                  <IconTile icon={HeartPulse} />
                  <h3 id="availability-title">
                    {d.availabilityTitle}
                  </h3>
                </div>
                <AvailabilityBadge state={overview.availability} t={t} />
                {staffHidden ? (
                  <p className="acct-status-hint">{d.availabilityLocked}</p>
                ) : (
                  <>
                    {overview.donor.availabilityConfirmedAt ? (
                      overview.donor.availabilitySource === 'staff' ? (
                        <p className="acct-staff-note">
                          <UserCog size={16} aria-hidden="true" />
                          <span>
                            {d.availabilitySourceStaff}
                            <br />
                            {t.common.availability.lastUpdated(instantDate(overview.donor.availabilityConfirmedAt))}
                          </span>
                        </p>
                      ) : (
                        <p className="acct-status-hint small">
                          {d.availabilitySourceDonor} · {t.common.availability.lastUpdated(instantDate(overview.donor.availabilityConfirmedAt))}
                        </p>
                      )
                    ) : (
                      <p className="acct-status-hint small">{d.availabilityNever}</p>
                    )}
                    {overview.availability === 'available' && overview.donor.availabilityExpiresAt && (
                      <p className="acct-status-hint small">{d.availabilityValidUntil(instantDate(overview.donor.availabilityExpiresAt))}</p>
                    )}
                    {overview.availability === 'unknown' && overview.donor.availabilityConfirmedAt && <Alert tone="warning">{d.availabilityExpired}</Alert>}
                    <ActionForm action={setAvailabilityAction} className="acct-choice" aria-label={d.availabilityButtonsLabel}>
                      <SubmitButton name="status" value="available" label={d.availableButton} pendingLabel={t.common.actions.saving} className="btn btn-primary btn-lg" />
                      <SubmitButton name="status" value="unavailable" label={d.unavailableButton} pendingLabel={t.common.actions.saving} className="btn btn-lg" />
                    </ActionForm>
                    <details className="disclosure acct-more">
                      <summary>{d.availabilityMore}</summary>
                      <p>{d.availabilityExplain(n(overview.settings.availabilityExpiryDays))}</p>
                      <p>{d.availabilitySearchNote}</p>
                    </details>
                  </>
                )}
              </section>
            </div>
          </section>

          <NextStep o={overview} i18n={i18n} />

          <div className="grid grid-2" style={{ alignItems: 'start' }}>
            <EligibilityCard estimate={overview.estimate} i18n={i18n} intervals={overview.settings.eligibilityIntervals} />
            <section className="card" aria-labelledby="stats-title">
              <div className="acct-card-head">
                <IconTile icon={Droplets} />
                <h2 id="stats-title">{d.statsTitle}</h2>
              </div>
              <ul className="acct-numbers">
                <li>
                  <IconTile icon={BadgeCheck} tone="info" small />
                  <span>
                    <strong>{n(overview.stats.verifiedCount)}</strong>
                    <span className="small">{d.statsVerified}</span>
                  </span>
                </li>
                <li>
                  <IconTile icon={Droplet} tone="neutral" small />
                  <span>
                    <strong>{n(overview.stats.reportedCount)}</strong>
                    <span className="small">{d.statsReported}</span>
                  </span>
                </li>
                <li>
                  <IconTile icon={CalendarDays} tone="neutral" small />
                  <span>
                    <strong>{overview.stats.lastDonation ? date(overview.stats.lastDonation, 'short') : t.common.states.none}</strong>
                    <span className="small">{d.statsLast}</span>
                  </span>
                </li>
              </ul>
              <Link className="section-link" href="/account/donations">
                {t.account.nav.donations}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </section>
          </div>
        </>
      )}

      <section aria-labelledby="links-title">
        <h2 id="links-title" className="acct-h2">
          {d.linksTitle}
        </h2>
        <ul className="acct-links">
          {links.map((l) => (
            <li key={l.href}>
              <Link className="acct-link" href={l.href}>
                <IconTile icon={l.icon} tone={l.href === '/requests/new' ? 'brand' : ('neutral' as IconTone)} />
                <span className="acct-link-title">{l.label}</span>
                <span className="acct-link-hint">{l.hint}</span>
                {l.badge && <span className="badge badge-warning">{l.badge}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {(requests.length > 0 || offers.length > 0) && (
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          {requests.length > 0 && (
            <section className="card" aria-labelledby="requests-title">
              <div className="acct-card-head">
                <IconTile icon={Siren} />
                <h2 id="requests-title">{d.requestsTitle}</h2>
              </div>
              <ul className="acct-rows">
                {requests.slice(0, 10).map((r) => (
                  <li key={r.id}>
                    <Link className="acct-row" href={`/requests/${r.publicId}`}>
                      <BloodGroupBadge group={r.bloodGroup} small label={t.common.bloodGroup} />
                      <span className="acct-row-body">
                        <span className="acct-row-title">{r.hospitalName}</span>
                        <span className="acct-row-sub">{labelFrom(index, locale, r.upazilaId, r.districtId)}</span>
                      </span>
                      <Badge tone={STATUS_TONE[r.status]}>{t.common.requestStatus[r.status]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {offers.length > 0 && (
            <section className="card" aria-labelledby="offers-title">
              <div className="acct-card-head">
                <IconTile icon={HeartPulse} />
                <h2 id="offers-title">{d.offersTitle}</h2>
              </div>
              <ul className="acct-rows">
                {offers.slice(0, 10).map((o) => (
                  <li key={o.response.id}>
                    <Link className="acct-row" href={`/requests/${o.request.publicId}`}>
                      <BloodGroupBadge group={o.request.bloodGroup} small label={t.common.bloodGroup} />
                      <span className="acct-row-body">
                        <span className="acct-row-title">{o.request.hospitalName}</span>
                        <span className="acct-row-sub">{d.offerStatus[o.response.status]}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
