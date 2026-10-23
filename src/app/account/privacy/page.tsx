import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check, EyeOff, Globe, LockKeyhole, Trash2 } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { requireActor } from '@/server/auth/current';
import { getOwnDonorOverview } from '@/server/services/donors';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { ConsentFields } from '@/components/DonorFormParts';
import { consentLabels } from '@/components/consent-labels';
import { IconTile, PageHead } from '@/components/account/bits';
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
  const paused = overview?.donor.status === 'paused';

  return (
    <>
      <PageHead title={p.title} intro={p.intro} />

      <section className="card" aria-labelledby="public-title">
        <div className="acct-card-head">
          <IconTile icon={Globe} />
          <h2 id="public-title">{p.publicTitle}</h2>
        </div>
        <p>{p.publicIntro}</p>
        <ul className="advice-list">
          {p.publicItems.map((item) => (
            <li key={item}>
              <Check size={18} aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="acct-note" style={{ marginTop: 'var(--space-3)' }}>
          <EyeOff size={16} aria-hidden="true" />
          <span>{p.publicLeave}</span>
        </p>
        <p className="acct-note" style={{ marginTop: 'var(--space-3)' }}>
          <LockKeyhole size={16} aria-hidden="true" />
          <span>{p.neverShown}</span>
        </p>
      </section>

      {!overview ? (
        <Alert tone="info">
          <p>{p.noDonor}</p>
          <Link href="/account/profile">{t.account.dashboard.createDonorCta}</Link>
        </Alert>
      ) : (
        <>
          <ActionForm action={updateConsentsAction} aria-label={p.formTitle} className="form">
            <fieldset className="form-section">
              <legend id="choices-title">{p.formTitle}</legend>
              <ConsentFields
                labels={{ ...consentLabels(t), publicNotice: undefined }}
                defaults={{
                  listedInSearch: overview.consents.listedInSearch,
                  allowCoordinatorContact: overview.consents.allowCoordinatorContact,
                  allowContactRequests: overview.consents.allowContactRequests,
                }}
              />
              <div className="acct-form-actions">
                <SubmitButton label={t.common.actions.save} pendingLabel={t.common.actions.saving} className="btn btn-primary btn-lg" />
                <span className="small muted">{p.lastUpdated(instantDate(overview.consents.consentedAt))}</span>
              </div>
            </fieldset>
          </ActionForm>

          {(overview.donor.status === 'active' || paused) && (
            <section className="card" aria-labelledby="pause-title">
              <div className="acct-card-head">
                <IconTile icon={EyeOff} tone="neutral" />
                <div>
                  <h2 id="pause-title">{p.pauseTitle}</h2>
                  <p>{paused ? t.account.dashboard.listingPaused : p.pauseBody}</p>
                </div>
              </div>
              <ActionForm action={setListingPausedAction} className="stack-sm">
                <input type="hidden" name="paused" value={paused ? 'false' : 'true'} />
                <SubmitButton
                  label={paused ? t.account.dashboard.resumeButton : t.account.dashboard.pauseButton}
                  pendingLabel={t.common.actions.saving}
                  className={paused ? 'btn btn-soft' : 'btn'}
                />
              </ActionForm>
            </section>
          )}
        </>
      )}

      <section className="card" aria-labelledby="deletion-title">
        <div className="acct-card-head" style={{ marginBottom: 0 }}>
          <IconTile icon={Trash2} tone="neutral" />
          <div style={{ flex: 1 }}>
            <h2 id="deletion-title">{p.deletionTitle}</h2>
            <p>{p.deletionBody}</p>
          </div>
        </div>
        <p style={{ margin: 'var(--space-3) 0 0' }}>
          <Link className="section-link" href="/account/security#deletion">
            {p.deletionLink}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </p>
      </section>
    </>
  );
}
