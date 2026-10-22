import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Users } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { requireActor } from '@/server/auth/current';
import { isAdmin } from '@/server/policy';
import { communitiesServingArea, getCommunityContext, serviceAreaLocationIds } from '@/server/services/communities';
import { getLocationIndex, labelFrom } from '@/server/services/location-index';
import { approvedCommunityOptions, communityCoordinatorOptions, getRequestRow } from '@/server/services/request-queries';
import { effectiveStatus, getRequestForViewer } from '@/server/services/requests';
import { AssignCoordinatorForm, EscalateForm, TakeRequestForm } from '@/components/request/CoordinatorForms';
import { ManagePanel } from '@/components/request/ManagePanel';
import { RequestSummary } from '@/components/request/RequestSummary';
import { STATUS_TONE, URGENCY_TONE } from '@/components/request/RequestCard';
import { Alert, Badge, BloodGroupBadge, NoAccess } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.request.manageTitle, robots: { index: false, follow: false } };
}

export default async function CoordinatorRequestPage({ params }: { params: Promise<{ slug: string; publicId: string }> }) {
  const { slug, publicId } = await params;
  const i18n = await getI18n();
  const { t, n, locale, dateTime } = i18n;
  const actor = await requireActor(`/manage/${slug}/requests/${publicId}`);
  const ctx = await getCommunityContext(actor, { slug });
  if (!ctx) notFound();
  if (!ctx.caps.has('coordinate_requests')) return <NoAccess t={t} />;
  const row = await getRequestRow(publicId);
  if (!row) notFound();
  const { request, escalatedTo } = row;
  const communityId = ctx.community.id;
  const area = await serviceAreaLocationIds(communityId);
  const inArea = [request.divisionId, request.districtId, request.upazilaId].some((id) => id !== null && area.includes(id));
  const assignedHere = request.assignedCommunityId === communityId;
  const escalatedHere = escalatedTo.includes(communityId);
  // Only requests this community is responsible for, was asked to help with, or could take in its area.
  if (!assignedHere && !escalatedHere && !(inArea && !request.assignedCommunityId) && !isAdmin(actor)) notFound();

  const status = effectiveStatus(request);
  const open = status === 'open' || status === 'in_progress';
  const index = await getLocationIndex();
  const place = labelFrom(index, locale, request.upazilaId, request.districtId, request.divisionId);
  const view = await getRequestForViewer(publicId, actor);
  const canTake = open && !request.assignedCommunityId;
  const base = `/manage/${slug}/requests`;
  const donorSearch = `/manage/${slug}/donors?${new URLSearchParams({ group: request.bloodGroup, district: String(request.districtId) }).toString()}`;
  const communityName = (c: { name: string; nameEn: string | null }) => (locale === 'en' && c.nameEn ? c.nameEn : c.name);

  let coordinatorOptions: { value: string; label: string }[] = [];
  let nearby: { value: string; label: string }[] = [];
  let others: { value: string; label: string }[] = [];
  if (view?.access.canManage && open) {
    const excluded = new Set([communityId, request.assignedCommunityId, ...escalatedTo].filter(Boolean) as string[]);
    const [coordinators, serving, all] = await Promise.all([
      assignedHere ? communityCoordinatorOptions(communityId) : Promise.resolve([]),
      communitiesServingArea({ divisionId: request.divisionId, districtId: request.districtId, upazilaId: request.upazilaId }, communityId),
      approvedCommunityOptions(),
    ]);
    coordinatorOptions = coordinators.map((c) => ({ value: c.userId, label: `${c.displayName} (${t.common.roles[c.role]})` }));
    nearby = serving.filter((c) => !excluded.has(c.id)).map((c) => ({ value: c.id, label: `${communityName(c)} — ${labelFrom(index, locale, c.districtId)}` }));
    const nearbyIds = new Set(nearby.map((o) => o.value));
    others = all.filter((c) => !excluded.has(c.id) && !nearbyIds.has(c.id)).map((c) => ({ value: c.id, label: `${communityName(c)} — ${labelFrom(index, locale, c.districtId)}` }));
  }

  return (
    <div className="stack">
      <p className="small">
        <Link href={base}>{t.request.backToQueue}</Link>
      </p>
      <div className="cluster">
        <BloodGroupBadge group={request.bloodGroup} label={t.common.bloodGroup} />
        <h2 style={{ margin: 0 }}>{t.request.detailTitle(request.bloodGroup)}</h2>
      </div>

      {canTake && (
        <section className="card card-accent stack-sm" aria-labelledby="take-heading">
          <h2 id="take-heading">{t.request.takeTitle}</h2>
          <p>{t.request.takeBody}</p>
          <TakeRequestForm publicId={publicId} communityId={communityId} labels={{ submit: t.request.takeButton, submitting: t.common.actions.saving }} />
        </section>
      )}

      {view?.access.canManage ? (
        <div className="grid grid-2">
          <div className="stack">
            <RequestSummary view={view} place={place} i18n={i18n} />
            <Link className="btn" href={donorSearch}>
              <Users size={18} aria-hidden="true" />
              {t.request.findDonors}
            </Link>

            {assignedHere && open && coordinatorOptions.length > 0 && (
              <section className="card stack">
                <h2>{t.request.assignTitle}</h2>
                <AssignCoordinatorForm
                  publicId={publicId}
                  communityId={communityId}
                  options={coordinatorOptions}
                  current={view.request.assignedCoordinatorId}
                  labels={{ field: t.request.assignCoordinator, submit: t.request.assignButton, submitting: t.common.actions.saving, choose: t.request.assignCoordinator }}
                />
              </section>
            )}

            <section className="card stack">
              <h2>{t.request.escalateTitle}</h2>
              {open && (
                <>
                  <p className="muted">{t.request.escalateBody}</p>
                  {nearby.length + others.length > 0 ? (
                    <EscalateForm
                      publicId={publicId}
                      nearby={nearby}
                      others={others}
                      labels={{
                        field: t.request.escalateTo,
                        nearby: t.request.nearbyGroup,
                        others: t.request.otherGroup,
                        choose: t.request.chooseCommunity,
                        note: t.request.escalateNote,
                        optional: t.common.states.optional,
                        submit: t.request.escalateButton,
                        submitting: t.common.actions.submitting,
                      }}
                    />
                  ) : (
                    <p className="muted">{t.request.noOtherCommunities}</p>
                  )}
                </>
              )}
              <h3>{t.request.escalationsTitle}</h3>
              {view.escalations.length === 0 ? (
                <p className="muted">{t.request.noEscalations}</p>
              ) : (
                <ul className="list-plain list-divided">
                  {view.escalations.map((e) => (
                    <li key={e.id}>
                      <Link href={`/communities/${e.toSlug}`}>{e.toName}</Link>
                      <br />
                      <span className="small muted">{dateTime(e.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <ManagePanel view={view} i18n={i18n} />
        </div>
      ) : (
        <div className="card stack">
          <div className="cluster-sm">
            <Badge tone={URGENCY_TONE[request.urgency]}>{t.common.urgency[request.urgency]}</Badge>
            <Badge tone={STATUS_TONE[status]}>{t.common.requestStatus[status]}</Badge>
          </div>
          <dl className="dl">
            <dt>{t.request.units}</dt>
            <dd>{t.request.unitsCount(n(request.units))}</dd>
            <dt>{t.request.hospital}</dt>
            <dd>{request.hospitalName}</dd>
            <dt>{t.request.area}</dt>
            <dd>{place}</dd>
            <dt>{t.request.neededAt}</dt>
            <dd>{dateTime(request.neededAt)}</dd>
          </dl>
          <Alert tone="info">{t.request.limitedView}</Alert>
          <Link className="btn" href={donorSearch}>
            <Users size={18} aria-hidden="true" />
            {t.request.findDonors}
          </Link>
        </div>
      )}
    </div>
  );
}
