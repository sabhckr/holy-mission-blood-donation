import type { Metadata } from 'next';
import { getI18n } from '@/i18n/server';
import { requireActor } from '@/server/auth/current';
import { compactLocations } from '@/server/services/location-index';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { CommunityFormFields } from '@/components/community/CommunityFormFields';
import { PageHeader } from '@/components/ui';
import { registerCommunityAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.community.newTitle };
}

export default async function NewCommunityPage() {
  await requireActor('/communities/new');
  const { t, locale } = await getI18n();
  const locations = await compactLocations(locale);
  return (
    <>
      <PageHeader title={t.community.newTitle} intro={t.community.newIntro} crumbs={[{ href: '/communities', label: t.common.nav.communities }]} />
      <div className="container container-narrow section">
        <ActionForm action={registerCommunityAction} aria-label={t.community.newTitle}>
          <CommunityFormFields t={t} locations={locations} />
          <SubmitButton label={t.community.submit} pendingLabel={t.community.submitting} className="btn btn-primary btn-lg btn-block" />
        </ActionForm>
      </div>
    </>
  );
}
