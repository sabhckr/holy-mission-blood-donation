import Link from 'next/link';
import { Building2, HeartHandshake, MapPin, Search, Siren, UserRound, Users } from 'lucide-react';
import { and, eq, sql } from 'drizzle-orm';
import { getI18n } from '@/i18n/server';
import { db } from '@/server/db/client';
import { communities, donorConsents, donorProfiles, users } from '@/server/db/schema';
import { BLOOD_GROUPS } from '@/server/domain/constants';
import { listCommunities } from '@/server/services/communities';
import { availableNowCondition, publiclyListedConditions } from '@/server/services/donors';
import { compactLocations, getLocationIndex, labelFrom } from '@/server/services/location-index';
import { listPublicRequests } from '@/server/services/requests';
import { Badge, BloodGroupBadge, Disclaimer, Stat } from '@/components/ui';
import { SearchForm } from '@/components/SearchForm';
import { locationLabels } from '@/components/consent-labels';
import { operatingAreaSummary } from '@/components/site/operating-area';

/** Live figures, using the same "publicly listed" rule as donor search (approved, consenting, active). */
async function homeNumbers() {
  const [donors] = await db
    .select({
      listed: sql<number>`count(*)::int`,
      available: sql<number>`count(*) filter (where ${availableNowCondition()})::int`,
    })
    .from(donorProfiles)
    .innerJoin(donorConsents, eq(donorConsents.donorId, donorProfiles.id))
    .innerJoin(users, eq(users.id, donorProfiles.userId))
    .where(and(...publiclyListedConditions()));
  const [comm] = await db.select({ n: sql<number>`count(*)::int` }).from(communities).where(eq(communities.status, 'approved'));
  return { listed: donors.listed, available: donors.available, communities: comm.n };
}

export default async function HomePage() {
  const i18n = await getI18n();
  const { t, n, locale } = i18n;
  const [numbers, comms, requests, locs, index, area] = await Promise.all([
    homeNumbers(),
    listCommunities({ page: 1 }),
    listPublicRequests({ page: 1 }),
    compactLocations(locale),
    getLocationIndex(),
    operatingAreaSummary(locale, t),
  ]);
  const anyNumbers = numbers.listed + numbers.communities > 0;
  const h = t.home;
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="slogan" lang="bn">
              {t.common.slogan}
            </p>
            {locale === 'en' && <p className="slogan-meaning">{t.common.sloganMeaning}</p>}
            <p className="small muted">{t.common.sloganDialectNote}</p>
            <h1 className="visually-hidden">{t.common.brand}</h1>
            <h2 className="hero-title">{h.heroTitle}</h2>
            <p className="hero-lead">{h.heroLead}</p>
            <nav className="hero-actions" aria-label={h.actionsLabel}>
              <Link className="btn btn-primary btn-lg" href="/donors">
                <Search size={20} aria-hidden="true" />
                {h.ctaFind}
              </Link>
              <Link className="btn btn-dark btn-lg" href="/register">
                <HeartHandshake size={20} aria-hidden="true" />
                {h.ctaRegister}
              </Link>
              <Link className="btn btn-lg" href="/requests/new">
                <Siren size={20} aria-hidden="true" />
                {h.ctaRequest}
              </Link>
              <Link className="btn btn-lg" href="/communities/new">
                <Building2 size={20} aria-hidden="true" />
                {h.ctaCommunity}
              </Link>
            </nav>
          </div>
          <div className="card hero-search">
            <h2 className="cluster-sm">
              <Search size={22} aria-hidden="true" />
              {h.quickSearchTitle}
            </h2>
            <p className="hint">{h.quickSearchHint}</p>
            <SearchForm
              compact
              locations={locs}
              bloodGroups={[...BLOOD_GROUPS]}
              labels={{
                bloodGroup: t.common.bloodGroup,
                anyGroup: t.common.anyBloodGroup,
                search: t.common.actions.search,
                location: locationLabels(t),
              }}
            />
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="operating-area">
        <div className="container stack">
          <div className="operating-area card card-accent stack-sm">
            <h2 id="operating-area" className="cluster-sm">
              <MapPin size={22} aria-hidden="true" />
              {t.common.operatingArea.title}
            </h2>
            <p className="lead-text">{area.sentence}</p>
            {area.notes.map((note) => (
              <p key={note} className="small muted">
                {note}
              </p>
            ))}
          </div>
          <h3 className="visually-hidden">{h.whoTitle}</h3>
          <ul className="list-plain grid grid-3 who-list">
            <li className="card card-tight stack-sm">
              <h4 className="cluster-sm">
                <MapPin size={18} aria-hidden="true" />
                {h.whoOwnTitle}
              </h4>
              <p>{h.whoOwnBody}</p>
            </li>
            <li className="card card-tight stack-sm">
              <h4 className="cluster-sm">
                <Building2 size={18} aria-hidden="true" />
                {h.whoOrgsTitle}
              </h4>
              <p>{h.whoOrgsBody}</p>
              <Link href="/communities/new">{h.ctaCommunity}</Link>
            </li>
            <li className="card card-tight stack-sm">
              <h4 className="cluster-sm">
                <UserRound size={18} aria-hidden="true" />
                {h.whoDonorsTitle}
              </h4>
              <p>{h.whoDonorsBody}</p>
              <Link href="/register">{h.ctaRegister}</Link>
            </li>
          </ul>
        </div>
      </section>

      <section className="section section-band" aria-labelledby="numbers">
        <div className="container stack">
          <h2 id="numbers">{h.numbersTitle}</h2>
          {anyNumbers ? (
            <div className="grid grid-3">
              <Stat value={n(numbers.listed)} label={h.numbersDonors} />
              <Stat value={n(numbers.available)} label={h.numbersAvailable} />
              <Stat value={n(numbers.communities)} label={h.numbersCommunities} />
            </div>
          ) : (
            <p>{h.numbersEmpty}</p>
          )}
          <p className="small muted">{h.numbersNote}</p>
        </div>
      </section>

      <section className="section" aria-labelledby="how">
        <div className="container stack">
          <h2 id="how">{h.howTitle}</h2>
          <ol className="steps">
            <li>
              <h3>{h.how1Title}</h3>
              <p>{h.how1Body}</p>
            </li>
            <li>
              <h3>{h.how2Title}</h3>
              <p>{h.how2Body}</p>
            </li>
            <li>
              <h3>{h.how3Title}</h3>
              <p>{h.how3Body}</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="section section-band">
        <div className="container grid grid-2">
          <div className="card card-accent stack" id="emergency">
            <h2 className="cluster-sm">
              <Siren size={22} aria-hidden="true" />
              {h.emergencyTitle}
            </h2>
            <ol className="stack-sm" style={{ paddingLeft: '1.2rem', margin: 0 }}>
              <li>{h.emergency1}</li>
              <li>{h.emergency2}</li>
              <li>{h.emergency3}</li>
              <li>{h.emergency4}</li>
            </ol>
            <Link href="/help">{h.emergencyMore}</Link>
          </div>
          <div className="stack">
            <h2>{h.requestsTitle}</h2>
            {requests.items.length === 0 ? (
              <p className="muted">{h.requestsEmpty}</p>
            ) : (
              <ul className="list-plain stack-sm">
                {requests.items.slice(0, 4).map((r) => (
                  <li key={r.publicId}>
                    <Link className="card card-tight card-link cluster" href={`/requests/${r.publicId}`} style={{ flexWrap: 'nowrap' }}>
                      <BloodGroupBadge group={r.bloodGroup} small label={t.common.bloodGroup} />
                      <span style={{ minWidth: 0 }}>
                        <strong>{r.hospitalName}</strong>
                        <br />
                        <span className="small muted">
                          {labelFrom(index, locale, r.upazilaId, r.districtId)} · {t.common.urgency[r.urgency]}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link className="btn" href="/requests">
              {t.common.actions.viewAll}
            </Link>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="communities">
        <div className="container stack">
          <div className="cluster between">
            <h2 id="communities" className="cluster-sm" style={{ marginBottom: 0 }}>
              <Users size={22} aria-hidden="true" />
              {h.communitiesTitle}
            </h2>
            <Link href="/communities/new">{h.communitiesRegister}</Link>
          </div>
          <p>{h.communitiesIntro}</p>
          {comms.items.length === 0 ? (
            <p className="muted">{h.communitiesEmpty}</p>
          ) : (
            <div className="grid grid-3">
              {comms.items.slice(0, 6).map((c) => (
                <Link key={c.id} className="card card-tight card-link stack-sm" href={`/communities/${c.slug}`}>
                  <h3 className="card-title">{locale === 'en' && c.nameEn ? c.nameEn : c.name}</h3>
                  <Badge tone={c.affiliation === 'holy_mission' ? 'success' : 'neutral'}>{t.common.affiliation[c.affiliation]}</Badge>
                  <p className="small muted" style={{ margin: 0 }}>
                    {labelFrom(index, locale, c.districtId)} · {h.members(n(c.memberCount))}
                  </p>
                </Link>
              ))}
            </div>
          )}
          <Link className="btn" href="/communities">
            {t.common.actions.viewAll}
          </Link>
        </div>
      </section>

      <section className="container">
        <Disclaimer t={t} />
      </section>
    </>
  );
}
