import type { Metadata } from 'next';
import { CircleCheck, ListChecks } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { requireActor } from '@/server/auth/current';
import { compactLocations } from '@/server/services/location-index';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { CommunityFormFields } from '@/components/community/CommunityFormFields';
import { IconTile } from '@/components/account/bits';
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
  const locations = await compactLocations(locale);
  const points = [c.newPointAnyDistrict, c.newPointReview, c.newPointIndependent, c.registrationNotVerification];
  return (
    <>
      <PageHeader title={c.newTitle} intro={c.newIntro} crumbs={[{ href: '/communities', label: t.common.nav.communities }]} crumbsLabel={t.common.nav.breadcrumbs} />
      <div className="section">
        <div className="container container-narrow stack">
          <section className="card org-before stack-sm" aria-labelledby="before-apply">
            <div className="acct-card-head" style={{ marginBottom: 'var(--space-1)' }}>
              <IconTile icon={ListChecks} />
              <h2 id="before-apply">{c.newBeforeTitle}</h2>
            </div>
            <ul>
              {points.map((point) => (
                <li key={point}>
                  <CircleCheck size={17} aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </section>
          <ActionForm action={registerCommunityAction} aria-label={c.newTitle} className="form acct-numbered">
            <CommunityFormFields t={t} locations={locations} />
            <SubmitButton label={c.submit} pendingLabel={c.submitting} className="btn btn-primary btn-lg btn-block" />
          </ActionForm>
        </div>
      </div>
    </>
  );
}
