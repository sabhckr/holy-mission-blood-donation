import type { Metadata } from 'next';
import { getI18n } from '@/i18n/server';
import { requireActor } from '@/server/auth/current';
import { compactLocations } from '@/server/services/location-index';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { CommunityFormFields } from '@/components/community/CommunityFormFields';
import { operatingAreaSummary } from '@/components/site/operating-area';
import { PageHeader } from '@/components/ui';
import { registerCommunityAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.community.newTitle };
}

export default async function NewCommunityPage() {
  await requireActor('/communities/new');
  const { t, locale } = await getI18n();
  const c = t.community;
  const [locations, area] = await Promise.all([compactLocations(locale), operatingAreaSummary(locale, t)]);
  return (
    <>
      <PageHeader title={c.newTitle} intro={c.newIntro} crumbs={[{ href: '/communities', label: t.common.nav.communities }]} />
      <div className="container container-narrow section stack">
        <section className="card card-accent stack-sm" aria-labelledby="before-apply">
          <h2 id="before-apply" style={{ fontSize: '1.1rem' }}>
            {c.newBeforeTitle}
          </h2>
          <ul className="stack-sm" style={{ paddingLeft: '1.2rem', margin: 0 }}>
            <li>{c.newPointAnyDistrict}</li>
            <li>{c.newPointReview}</li>
            <li>{c.newPointIndependent}</li>
            <li>{c.registrationNotVerification}</li>
          </ul>
          <h3 style={{ fontSize: '1rem', margin: 0 }}>{t.common.operatingArea.title}</h3>
          <p className="small" style={{ margin: 0 }}>
            {area.sentence}
          </p>
        </section>
        <ActionForm action={registerCommunityAction} aria-label={c.newTitle}>
          <CommunityFormFields t={t} locations={locations} />
          <SubmitButton label={c.submit} pendingLabel={c.submitting} className="btn btn-primary btn-lg btn-block" />
        </ActionForm>
      </div>
    </>
  );
}
