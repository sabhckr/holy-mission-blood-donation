import Link from 'next/link';
import { Building2, Download, HeartHandshake, MapPin, Search, ShieldCheck, Siren, Smartphone } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { BLOOD_GROUPS } from '@/server/domain/constants';
import { getServiceArea } from '@/server/services/service-area';
import { isInApp } from '@/components/site/android-app';

/** Home: where we work, the slogan, donor search, the three main actions and the Android app. */
export default async function HomePage() {
  const { t, locale } = await getI18n();
  const [area, inApp] = await Promise.all([getServiceArea(), isInApp()]);
  const h = t.home;
  const [titleFirst, ...titleRest] = h.heroTitle.split(', ');
  const quick = [
    { href: '/requests/new', icon: Siren, title: h.quickRequestTitle, body: h.quickRequestBody },
    { href: '/register', icon: HeartHandshake, title: h.quickDonorTitle, body: h.quickDonorBody },
    { href: '/communities/new', icon: Building2, title: h.quickOrgTitle, body: h.quickOrgBody },
  ];
  return (
    <div className="container home">
      <p className="area-note">
        <MapPin size={19} aria-hidden="true" />
        <span>{t.common.operatingArea.notice}</span>
      </p>

      <section className="home-hero" aria-labelledby="home-title">
        <p className="eyebrow">
          <span aria-hidden="true">♥</span>
          <span lang="bn">{t.common.slogan}</span>
        </p>
        {locale === 'en' && <p className="slogan-meaning">{t.common.sloganMeaning}</p>}
        <h1 id="home-title">
          {titleFirst}
          {titleRest.length > 0 && (
            <>
              ,<br />
              {titleRest.join(', ')}
            </>
          )}
        </h1>
        <p className="lead">{h.heroLead}</p>
        <div className="home-actions">
          <Link className="btn btn-primary" href="#find">
            <Search size={18} aria-hidden="true" />
            {h.ctaFind}
          </Link>
          <Link className="btn" href="/register">
            {h.ctaRegister}
          </Link>
        </div>
      </section>

      <section id="find" aria-labelledby="find-title">
        <div className="section-head">
          <div>
            <h2 id="find-title">{h.searchTitle}</h2>
            <p className="section-note">{h.searchNote}</p>
          </div>
        </div>
        <div className="search-card">
          <form className="filters" action="/donors" method="get" role="search" aria-labelledby="find-title">
            <div className="field">
              <label className="label" htmlFor="home-group">
                {t.common.bloodGroup}
              </label>
              <select id="home-group" name="group" className="select" defaultValue="">
                <option value="">{h.anyGroup}</option>
                {BLOOD_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="home-upazila">
                {h.upazilaLabel(locale === 'bn' ? area.nameBn : area.nameEn)}
              </label>
              <select id="home-upazila" name="upazila" className="select" defaultValue="">
                <option value="">{h.anyUpazila}</option>
                {area.upazilas.map((u) => (
                  <option key={u.id} value={u.id}>
                    {locale === 'bn' ? u.nameBn : u.nameEn}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" type="submit">
              {h.searchButton}
            </button>
          </form>
        </div>
      </section>

      <nav className="quick-actions" aria-label={h.quickLabel}>
        {quick.map((q) => (
          <Link key={q.href} className="quick" href={q.href}>
            <span className="quick-icon">
              <q.icon size={21} aria-hidden="true" />
            </span>
            <strong>{q.title}</strong>
            <span>{q.body}</span>
          </Link>
        ))}
      </nav>

      {!inApp && (
        <Link className="app-banner" href="/app">
          <span className="quick-icon">
            <Smartphone size={21} aria-hidden="true" />
          </span>
          <span className="app-banner-text">
            <strong>{t.app.homeTitle}</strong>
            <span>{t.app.homeBody}</span>
          </span>
          <span className="btn btn-primary btn-sm">
            <Download size={16} aria-hidden="true" />
            {t.app.homeButton}
          </span>
        </Link>
      )}

      <div className="trust">
        <ShieldCheck size={25} aria-hidden="true" />
        <div>
          <strong>{h.trustTitle}</strong>
          <p>{h.trustText}</p>
        </div>
      </div>
      <p className="notice">{h.notice}</p>
    </div>
  );
}
