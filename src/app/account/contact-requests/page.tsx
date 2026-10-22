import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageCircle, Phone } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { requireActor } from '@/server/auth/current';
import { formatBdPhone } from '@/server/domain/phone';
import { incomingContactRequests, outgoingContactRequests } from '@/server/services/contact';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { Alert, Badge, BloodGroupBadge, EmptyState } from '@/components/ui';
import { cancelContactAction, respondContactAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.contact.title, robots: { index: false } };
}

type Status = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';
const TONE: Record<Status, 'warning' | 'success' | 'neutral' | 'danger'> = {
  pending: 'warning',
  accepted: 'success',
  declined: 'neutral',
  cancelled: 'neutral',
  expired: 'neutral',
};

function PhoneLinks({ phone, label, callLabel, smsLabel }: { phone: string; label: string; callLabel: string; smsLabel: string }) {
  return (
    <div className="card card-tight stack-sm">
      <p className="small muted" style={{ margin: 0 }}>
        {label}
      </p>
      <p className="phone-reveal" style={{ margin: 0 }}>
        {formatBdPhone(phone)}
      </p>
      <div className="cluster-sm">
        <a className="btn btn-primary btn-sm" href={`tel:${phone}`}>
          <Phone size={16} aria-hidden="true" />
          {callLabel}
        </a>
        <a className="btn btn-sm" href={`sms:${phone}`}>
          <MessageCircle size={16} aria-hidden="true" />
          {smsLabel}
        </a>
      </div>
    </div>
  );
}

export default async function ContactRequestsPage() {
  const { t, dateTime } = await getI18n();
  const c = t.account.contact;
  const actor = await requireActor('/account/contact-requests');
  const [incoming, outgoing] = await Promise.all([incomingContactRequests(actor), outgoingContactRequests(actor)]);

  return (
    <>
      <h1>{c.title}</h1>
      <p>{c.intro}</p>

      <section className="stack" aria-labelledby="incoming-title">
        <h2 id="incoming-title" style={{ fontSize: '1.15rem' }}>
          {c.incomingTitle}
        </h2>
        {!actor.donorId ? (
          <p className="muted">{c.noDonorIncoming}</p>
        ) : incoming.length === 0 ? (
          <EmptyState title={c.incomingEmpty} />
        ) : (
          <ul className="list-plain stack">
            {incoming.map((r) => (
              <li key={r.id} className="card card-tight stack-sm">
                <div className="cluster between">
                  <strong>{c.from(r.requesterName)}</strong>
                  <Badge tone={TONE[r.status]}>{c.status[r.status]}</Badge>
                </div>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{r.message}</p>
                <p className="small muted" style={{ margin: 0 }}>
                  {c.sentOn(dateTime(r.createdAt))}
                  {r.status === 'pending' && <> · {c.expiresOn(dateTime(r.expiresAt))}</>}
                </p>
                {r.requestPublicId && (
                  <Link className="small" href={`/requests/${r.requestPublicId}`}>
                    {c.aboutRequest}
                  </Link>
                )}
                {r.status === 'pending' && (
                  <>
                    <p className="small" style={{ margin: 0 }}>
                      {c.acceptNote}
                    </p>
                    <div className="cluster-sm">
                      <ActionForm action={respondContactAction} className="stack-sm">
                        <input type="hidden" name="contactRequestId" value={r.id} />
                        <input type="hidden" name="decision" value="accepted" />
                        <SubmitButton label={c.accept} pendingLabel={t.common.actions.saving} className="btn btn-primary btn-sm" />
                      </ActionForm>
                      <ActionForm action={respondContactAction} className="stack-sm">
                        <input type="hidden" name="contactRequestId" value={r.id} />
                        <input type="hidden" name="decision" value="declined" />
                        <SubmitButton label={c.decline} pendingLabel={t.common.actions.saving} className="btn btn-sm" />
                      </ActionForm>
                    </div>
                  </>
                )}
                {r.status === 'accepted' && r.requesterPhone && (
                  <PhoneLinks phone={r.requesterPhone} label={c.requesterPhone} callLabel={t.common.actions.call} smsLabel={t.common.actions.sendSms} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stack" aria-labelledby="outgoing-title">
        <h2 id="outgoing-title" style={{ fontSize: '1.15rem' }}>
          {c.outgoingTitle}
        </h2>
        {outgoing.length === 0 ? (
          <EmptyState title={c.outgoingEmpty}>
            <Link href="/donors">{t.common.nav.findDonors}</Link>
          </EmptyState>
        ) : (
          <ul className="list-plain stack">
            {outgoing.map((r) => (
              <li key={r.id} className="card card-tight stack-sm">
                <div className="cluster between" style={{ flexWrap: 'nowrap' }}>
                  <span className="cluster-sm">
                    <BloodGroupBadge group={r.bloodGroup} small label={t.common.bloodGroup} />
                    <Link href={`/donors/${r.donorPublicId}`}>{c.to(r.donorName)}</Link>
                  </span>
                  <Badge tone={TONE[r.status]}>{c.status[r.status]}</Badge>
                </div>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{r.message}</p>
                <p className="small muted" style={{ margin: 0 }}>
                  {c.sentOn(dateTime(r.createdAt))}
                  {r.status === 'pending' && <> · {c.expiresOn(dateTime(r.expiresAt))}</>}
                </p>
                {r.status === 'pending' && (
                  <ActionForm action={cancelContactAction} className="stack-sm">
                    <input type="hidden" name="contactRequestId" value={r.id} />
                    <SubmitButton label={c.cancel} pendingLabel={t.common.actions.saving} className="btn btn-sm" />
                  </ActionForm>
                )}
                {r.status === 'accepted' && r.donorPhone && (
                  <>
                    <PhoneLinks phone={r.donorPhone} label={c.donorPhone} callLabel={t.common.actions.call} smsLabel={t.common.actions.sendSms} />
                    <Alert tone="info">{c.notConfirmed}</Alert>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
