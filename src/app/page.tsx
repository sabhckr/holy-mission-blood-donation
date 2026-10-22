import Link from 'next/link';
import { HeartHandshake, Search, Siren, Users } from 'lucide-react';
import { and, eq, sql } from 'drizzle-orm';
import { getI18n } from '@/i18n/server';
import { db } from '@/server/db/client';
import { communities, donorConsents, donorProfiles, users } from '@/server/db/schema';
import { BLOOD_GROUPS } from '@/server/domain/constants';
import { listCommunities } from '@/server/services/communities';
import { compactLocations, getLocationIndex, labelFrom } from '@/server/services/location-index';
import { listPublicRequests } from '@/server/services/requests';
import { BloodGroupBadge, Disclaimer, Stat } from '@/components/ui';
import { SearchForm } from '@/components/SearchForm';
import { locationLabels } from '@/components/consent-labels';

async function homeNumbers() {
  const [donors] = await db
    .select({
      listed: sql<number>`count(*)::int`,
      available: sql<number>`count(*) filter (where ${donorProfiles.availabilityStatus} = 'available' and ${donorProfiles.availabilityExpiresAt} > now())::int`,
    })
    .from(donorProfiles)
    .innerJoin(donorConsents, eq(donorConsents.donorId, donorProfiles.id))
    .innerJoin(users, eq(users.id, donorProfiles.userId))
    .where(and(eq(donorConsents.listedInSearch, true), eq(donorProfiles.status, 'active'), eq(users.status, 'active')));
  const [comm] = await db.select({ n: sql<number>`count(*)::int` }).from(communities).where(eq(communities.status, 'approved'));
  return { listed: donors.listed, available: donors.available, communities: comm.n };
}

export default async function HomePage() {
  const i18n = await getI18n();
  const { t, n, locale } = i18n;
  const [numbers, comms, requests, locs, index] = await Promise.all([
    homeNumbers(),
    listCommunities({ page: 1 }),
    listPublicRequests({ page: 1 }),
    compactLocations(locale),
    getLocationIndex(),
  ]);
  const anyNumbers = numbers.listed + numbers.communities > 0;
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">{t.home.heroEyebrow}</span>
            <p className="slogan" lang="bn">
              {t.common.slogan}
            </p>
            {locale === 'en' && <p className="slogan-meaning">{t.common.sloganMeaning}</p>}
            <p className="small muted">{t.common.sloganDialectNote}</p>
            <h1 className="visually-hidden">{t.common.brand}</h1>
            <p>{t.home.heroLead}</p>
            <div className="cluster">
              <Link className="btn btn-primary btn-lg" href="/register">
                <HeartHandshake size={20} aria-hidden="true" />
                {t.home.ctaRegister}
              </Link>
              <Link className="btn btn-lg" href="/requests/new">
                <Siren size={20} aria-hidden="true" />
                {t.home.ctaRequest}
              </Link>
            </div>
          </div>
          <div className="card" style={{ boxShadow: 'var(--shadow)' }}>
            <h2 className="cluster-sm">
              <Search size={22} aria-hidden="true" />
              {t.home.quickSearchTitle}
            </h2>
            <p className="hint">{t.home.quickSearchHint}</p>
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

      <section className="section">
        <div className="container stack">
          <h2>{t.home.numbersTitle}</h2>
          {anyNumbers ? (
            <div className="grid grid-3">
              <Stat value={n(numbers.listed)} label={t.home.numbersDonors} />
              <Stat value={n(numbers.available)} label={t.home.numbersAvailable} />
              <Stat value={n(numbers.communities)} label={t.home.numbersCommunities} />
            </div>
          ) : (
            <p>{t.home.numbersEmpty}</p>
          )}
          <p className="small muted">{t.home.numbersNote}</p>
        </div>
      </section>

      <section className="section" style={{ background: 'var(--surface)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="container stack">
          <h2>{t.home.howTitle}</h2>
          <ol className="steps">
            <li>
              <h3>{t.home.how1Title}</h3>
              <p>{t.home.how1Body}</p>
            </li>
            <li>
              <h3>{t.home.how2Title}</h3>
              <p>{t.home.how2Body}</p>
            </li>
            <li>
              <h3>{t.home.how3Title}</h3>
              <p>{t.home.how3Body}</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="container grid grid-2">
          <div className="card card-accent stack" id="emergency">
            <h2 className="cluster-sm">
              <Siren size={22} aria-hidden="true" />
              {t.home.emergencyTitle}
            </h2>
            <ol className="stack-sm" style={{ paddingLeft: '1.2rem', margin: 0 }}>
              <li>{t.home.emergency1}</li>
              <li>{t.home.emergency2}</li>
              <li>{t.home.emergency3}</li>
              <li>{t.home.emergency4}</li>
            </ol>
            <Link href="/help">{t.home.emergencyMore}</Link>
          </div>
          <div className="stack">
            <h2>{t.home.requestsTitle}</h2>
            {requests.items.length === 0 ? (
              <p className="muted">{t.home.requestsEmpty}</p>
            ) : (
              <ul className="list-plain stack-sm">
                {requests.items.slice(0, 4).map((r) => (
                  <li key={r.publicId}>
                    <Link className="card card-tight card-link cluster" href={`/requests/${r.publicId}`} style={{ flexWrap: 'nowrap' }}>
                      <BloodGroupBadge group={r.bloodGroup} small label={t.common.bloodGroup} />
                      <span>
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

      <section className="section">
        <div className="container stack">
          <div className="cluster between">
            <h2 className="cluster-sm" style={{ marginBottom: 0 }}>
              <Users size={22} aria-hidden="true" />
              {t.home.communitiesTitle}
            </h2>
            <Link href="/communities/new">{t.home.communitiesRegister}</Link>
          </div>
          <p>{t.home.communitiesIntro}</p>
          {comms.items.length === 0 ? (
            <p className="muted">{t.home.communitiesEmpty}</p>
          ) : (
            <div className="grid grid-3">
              {comms.items.slice(0, 6).map((c) => (
                <Link key={c.id} className="card card-tight card-link" href={`/communities/${c.slug}`}>
                  <h3 className="card-title">{locale === 'en' && c.nameEn ? c.nameEn : c.name}</h3>
                  <p className="small muted" style={{ margin: 0 }}>
                    {labelFrom(index, locale, c.districtId)} · {t.home.members(n(c.memberCount))}
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
