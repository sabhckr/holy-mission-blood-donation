import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { requireActor } from '@/server/auth/current';
import { getOwnDonorOverview } from '@/server/services/donors';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { ConsentFields } from '@/components/DonorFormParts';
import { consentLabels } from '@/components/consent-labels';
import { Alert } from '@/components/ui';
import { setListingPausedAction, updateConsentsAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.privacy.title, robots: { index: false } };
}

export default async function PrivacySettingsPage() {
  const { t, instantDate } = await getI18n();
  const p = t.account.privacy;
  const actor = await requireActor('/account/privacy');
  const overview = await getOwnDonorOverview(actor);

  return (
    <>
      <h1>{p.title}</h1>
      <p>{p.intro}</p>

      <section className="card stack" aria-labelledby="levels-title">
        <h2 id="levels-title" className="cluster-sm" style={{ fontSize: '1.15rem' }}>
          <ShieldCheck size={20} aria-hidden="true" />
          {p.levelsTitle}
        </h2>
        <ul className="stack-sm" style={{ paddingLeft: '1.2rem', margin: 0 }}>
          <li>{p.levelPublic}</li>
          <li>{p.levelSignedIn}</li>
          <li>{p.levelCoordinators}</li>
          <li>{p.levelPrivate}</li>
        </ul>
        <p className="small muted" style={{ margin: 0 }}>
          {p.neverShown}
        </p>
      </section>

      {!overview ? (
        <Alert tone="info">
          <p>{p.noDonor}</p>
          <Link href="/account/profile">{t.account.dashboard.createDonorCta}</Link>
        </Alert>
      ) : (
        <>
          <section className="stack" aria-labelledby="choices-title">
            <h2 id="choices-title" style={{ fontSize: '1.15rem' }}>
              {p.formTitle}
            </h2>
            <ActionForm action={updateConsentsAction} aria-label={p.formTitle}>
              <fieldset className="form-section">
                <legend className="visually-hidden">{p.formTitle}</legend>
                <ConsentFields
                  labels={consentLabels(t)}
                  defaults={{
                    listedInSearch: overview.consents.listedInSearch,
                    nameVisibility: overview.consents.nameVisibility,
                    phoneVisibility: overview.consents.phoneVisibility,
                    localityVisibility: overview.consents.localityVisibility,
                    donationHistoryVisibility: overview.consents.donationHistoryVisibility,
                    communityVisibility: overview.consents.communityVisibility,
                    allowCoordinatorContact: overview.consents.allowCoordinatorContact,
                    allowContactRequests: overview.consents.allowContactRequests,
                  }}
                />
                <p className="small muted" style={{ margin: 0 }}>
                  {p.lastUpdated(instantDate(overview.consents.consentedAt))}
                </p>
              </fieldset>
              <SubmitButton label={t.common.actions.save} pendingLabel={t.common.actions.saving} />
            </ActionForm>
          </section>

          {overview.donor.status !== 'restricted' && (
            <section className="card stack" aria-labelledby="pause-title">
              <h2 id="pause-title" style={{ fontSize: '1.15rem' }}>
                {p.pauseTitle}
              </h2>
              <p style={{ margin: 0 }}>{overview.donor.status === 'paused' ? t.account.dashboard.listingPaused : p.pauseBody}</p>
              <ActionForm action={setListingPausedAction} className="stack-sm">
                <input type="hidden" name="paused" value={overview.donor.status === 'paused' ? 'false' : 'true'} />
                <SubmitButton
                  label={overview.donor.status === 'paused' ? t.account.dashboard.resumeButton : t.account.dashboard.pauseButton}
                  pendingLabel={t.common.actions.saving}
                  className="btn"
                />
              </ActionForm>
            </section>
          )}
        </>
      )}

      <section className="card stack" aria-labelledby="deletion-title">
        <h2 id="deletion-title" style={{ fontSize: '1.15rem' }}>
          {p.deletionTitle}
        </h2>
        <p style={{ margin: 0 }}>{p.deletionBody}</p>
        <Link href="/account/security#deletion">{p.deletionLink}</Link>
      </section>
    </>
  );
}
