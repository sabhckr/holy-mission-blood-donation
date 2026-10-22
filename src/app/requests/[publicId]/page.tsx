import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { getI18n } from '@/i18n/server';
import { getActor } from '@/server/auth/current';
import { db } from '@/server/db/client';
import { donorProfiles } from '@/server/db/schema';
import { REPORT_REASONS } from '@/server/domain/constants';
import { getLocationIndex, labelFrom } from '@/server/services/location-index';
import { getRequestForViewer } from '@/server/services/requests';
import { ReportForm } from '@/components/ReportForm';
import { ManagePanel } from '@/components/request/ManagePanel';
import { RequestSummary } from '@/components/request/RequestSummary';
import { OfferHelpForm, WithdrawForm } from '@/components/request/RequestForms';
import { Alert, Badge, BloodGroupBadge, Disclaimer, PageHeader } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.request.title, robots: { index: false, follow: false } };
}

export default async function RequestDetailPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const i18n = await getI18n();
  const { t, locale } = i18n;
  const actor = await getActor();
  const view = await getRequestForViewer(publicId, actor);
  if (!view) notFound();
  const index = await getLocationIndex();
  const r = view.request;
  const place = labelFrom(index, locale, r.upazilaId, r.districtId, r.divisionId);
  const open = r.status === 'open' || r.status === 'in_progress';
  const signedIn = !!actor && actor.status === 'active';
  const me =
    signedIn && actor.donorId && !view.access.isRequester
      ? ((
          await db
            .select({ bloodGroup: donorProfiles.bloodGroup, registrationStatus: donorProfiles.registrationStatus, status: donorProfiles.status })
            .from(donorProfiles)
            .where(and(eq(donorProfiles.id, actor.donorId), eq(donorProfiles.userId, actor.userId)))
        )[0] ?? null)
      : null;
  const myGroup = me?.bloodGroup ?? null;
  // Only approved donors with an active listing can offer to help (the service enforces this too).
  const offerBlocked = me ? (me.registrationStatus !== 'approved' ? 'approval' : me.status !== 'active' ? 'listing' : null) : null;
  const myResponse = view.myResponse && view.myResponse.status !== 'withdrawn' ? view.myResponse : null;

  return (
    <>
      <PageHeader title={t.request.detailTitle(r.bloodGroup)} crumbs={[{ href: '/requests', label: t.request.boardTitle }]}>
        <BloodGroupBadge group={r.bloodGroup} label={t.common.bloodGroup} />
      </PageHeader>
      <div className="container section grid grid-2">
        <div className="stack">
          <RequestSummary view={view} place={place} i18n={i18n} />
          <Disclaimer t={t} compact />
        </div>

        <div className="stack">
          {!open && <Alert tone="info">{t.request.closedNote}</Alert>}

          {open && !view.access.canManage && (
            <section className="card stack" aria-labelledby="help-heading">
              <h2 id="help-heading">{t.request.canHelpTitle}</h2>
              {!signedIn ? (
                <>
                  <p>{t.request.signInToHelp}</p>
                  <Link className="btn btn-primary" href={`/signin?next=${encodeURIComponent(`/requests/${r.publicId}`)}`}>
                    {t.common.nav.signIn}
                  </Link>
                </>
              ) : !actor.donorId ? (
                <>
                  <p>{t.request.needDonorProfile}</p>
                  <Link className="btn btn-primary" href="/account/profile">
                    {t.request.createProfile}
                  </Link>
                </>
              ) : offerBlocked && !myResponse ? (
                <>
                  <p>{offerBlocked === 'approval' ? t.request.needApproval : t.request.needActiveListing}</p>
                  <Link className="btn" href="/account">
                    {t.common.nav.account}
                  </Link>
                </>
              ) : myResponse ? (
                <div className="stack-sm">
                  <p style={{ margin: 0 }}>
                    {t.request.yourResponse}: <Badge tone={myResponse.status === 'confirmed' ? 'success' : 'warning'}>{t.request.responseStatus[myResponse.status]}</Badge>
                  </p>
                  <WithdrawForm publicId={r.publicId} labels={{ submit: t.request.withdrawButton, submitting: t.common.actions.saving }} />
                </div>
              ) : (
                <>
                  <p>{t.request.canHelpBody}</p>
                  {myGroup && myGroup !== r.bloodGroup && <Alert tone="info">{t.request.groupMismatch(myGroup, r.bloodGroup)}</Alert>}
                  <OfferHelpForm
                    publicId={r.publicId}
                    labels={{ message: t.request.offerMessage, hint: t.request.offerMessageHint, submit: t.request.offerButton, submitting: t.common.actions.submitting, optional: t.common.states.optional }}
                  />
                </>
              )}
            </section>
          )}

          {view.access.isRequester && open && <Alert tone="info">{t.request.ownRequestNote}</Alert>}

          {view.access.canManage && <ManagePanel view={view} i18n={i18n} />}

          <ReportForm
            targetType="request"
            targetId={r.publicId}
            reasons={REPORT_REASONS.map((reason) => ({ value: reason, label: t.common.report.reasons[reason] }))}
            labels={{
              title: t.common.report.title,
              reason: t.common.report.reason,
              details: t.common.report.details,
              detailsHint: t.common.report.detailsHint,
              submit: t.common.report.submit,
              submitting: t.common.actions.submitting,
              choose: t.common.report.reason,
            }}
          />
        </div>
      </div>
    </>
  );
}
