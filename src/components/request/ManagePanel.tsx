import Link from 'next/link';
import type { I18n } from '@/i18n/server';
import type { RequestStatus } from '@/server/domain/constants';
import type { getRequestForViewer } from '@/server/services/requests';
import { Alert, Badge, BloodGroupBadge } from '../ui';
import { ResponseDecisionForm, StatusForm } from './RequestForms';

export type RequestView = NonNullable<Awaited<ReturnType<typeof getRequestForViewer>>>;

const NEXT_STATUS: Record<RequestStatus, RequestStatus[]> = {
  open: ['in_progress', 'fulfilled', 'cancelled'],
  in_progress: ['open', 'fulfilled', 'cancelled'],
  fulfilled: [],
  cancelled: [],
  expired: [],
};

const RESPONSE_TONE = { offered: 'warning', confirmed: 'success', declined: 'neutral', withdrawn: 'neutral' } as const;

/**
 * Status changes, donor responses and history for people who manage a request:
 * the requester (signed in or with the private link), responsible coordinators and admins.
 */
export function ManagePanel({ view, i18n, token }: { view: RequestView; i18n: I18n; token?: string | null }) {
  const { t, dateTime } = i18n;
  const { request, access } = view;
  const requesterOnly = access.isRequester && !access.isAdmin && access.coordinatorOf.length === 0;
  const allowed = NEXT_STATUS[request.status].filter((s) => !requesterOnly || s === 'fulfilled' || s === 'cancelled');
  const open = request.status === 'open' || request.status === 'in_progress';
  const decisionLabels = { confirm: t.request.confirmResponse, decline: t.request.declineResponse, saving: t.common.actions.saving };
  return (
    <section className="stack" aria-labelledby="manage-heading">
      <div className="card stack">
        <h2 id="manage-heading">{t.request.manageTitle}</h2>
        <p className="muted">{t.request.manageIntro}</p>
        {allowed.length > 0 ? (
          <StatusForm
            publicId={request.publicId}
            token={token}
            options={allowed.map((s) => ({ value: s, label: t.common.requestStatus[s] }))}
            labels={{
              status: t.request.newStatus,
              reason: t.request.statusReason,
              optional: t.common.states.optional,
              submit: t.request.changeStatus,
              submitting: t.common.actions.saving,
              choose: t.request.newStatus,
            }}
          />
        ) : (
          <Alert tone="info">{t.request.noStatusChange}</Alert>
        )}
      </div>

      <div className="card stack">
        <h2>{t.request.responsesTitle}</h2>
        <p className="small muted">{t.request.confirmHint}</p>
        {view.responses.length === 0 ? (
          <p className="muted">{t.request.noResponsesYet}</p>
        ) : (
          <ul className="list-plain list-divided">
            {view.responses.map((r) => (
              <li key={r.id} className="stack-sm">
                <div className="cluster">
                  <BloodGroupBadge group={r.bloodGroup} small label={t.common.bloodGroup} />
                  <span>
                    <Link href={`/donors/${r.donorPublicId}`}>{r.donorName}</Link>
                    <br />
                    <span className="small muted">{dateTime(r.createdAt)}</span>
                  </span>
                  <Badge tone={RESPONSE_TONE[r.status]}>{t.request.responseStatus[r.status]}</Badge>
                </div>
                {r.message && <p className="small" style={{ margin: 0 }}>{r.message}</p>}
                {open && r.status !== 'withdrawn' && (
                  <ResponseDecisionForm
                    publicId={request.publicId}
                    responseId={r.id}
                    token={token}
                    labels={decisionLabels}
                    allowConfirm={r.status !== 'confirmed'}
                    allowDecline={r.status !== 'declined'}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {view.history.length > 0 && (
        <div className="card stack">
          <h2>{t.request.historyTitle}</h2>
          <ol className="list-plain list-divided">
            {view.history.map(({ event, actorName }) => (
              <li key={event.id} className="small">
                <strong>{t.request.historyAction[event.action as keyof typeof t.request.historyAction] ?? event.action}</strong>
                {event.action === 'status' && <> — {t.common.requestStatus[event.toStatus]}</>}
                {event.action !== 'response' && event.note && <> — {event.note}</>}
                <br />
                <span className="muted">
                  {dateTime(event.createdAt)} · {actorName ?? (event.action === 'created' ? t.request.requesterActor : t.request.systemActor)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
