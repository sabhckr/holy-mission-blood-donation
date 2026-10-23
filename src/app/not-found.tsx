import Link from 'next/link';
import { Home, Search, SearchX } from 'lucide-react';
import { getI18n } from '@/i18n/server';

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="auth-page">
      <div className="container auth-column">
        <div className="card auth-card status-card">
          <span className="auth-icon">
            <SearchX size={28} aria-hidden="true" />
          </span>
          <h1>{t.common.notFound.title}</h1>
          <p className="auth-intro">{t.common.notFound.body}</p>
          <Link className="btn btn-primary btn-lg btn-block" href="/">
            <Home size={20} aria-hidden="true" />
            {t.common.actions.goHome}
          </Link>
          <Link className="btn btn-block" href="/donors">
            <Search size={18} aria-hidden="true" />
            {t.common.nav.findDonors}
          </Link>
        </div>
      </div>
    </div>
  );
}
