import type { Metadata } from 'next';
import { getI18n } from '@/i18n/server';
import { PRIVACY_POLICY_VERSION } from '@/server/domain/constants';
import { LegalPage } from '@/components/LegalPage';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.legal.privacyTitle };
}

export default async function PrivacyPage() {
  const { t, date } = await getI18n();
  return <LegalPage title={t.legal.privacyTitle} intro={t.legal.privacyIntro} updated={t.legal.updated(date(PRIVACY_POLICY_VERSION))} sections={t.legal.privacySections} tocLabel={t.legal.tocLabel} />;
}
