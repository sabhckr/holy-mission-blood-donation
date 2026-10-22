import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { EmptyState } from '@/components/ui';

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="container section">
      <EmptyState icon={<SearchX size={40} aria-hidden="true" />} title={t.common.notFound.title}>
        <p>{t.common.notFound.body}</p>
        <div className="cluster" style={{ justifyContent: 'center' }}>
          <Link className="btn btn-primary" href="/">
            {t.common.actions.goHome}
          </Link>
          <Link className="btn" href="/donors">
            {t.common.nav.findDonors}
          </Link>
        </div>
      </EmptyState>
    </div>
  );
}
