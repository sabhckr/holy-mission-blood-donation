import type { Metadata } from 'next';
import Link from 'next/link';
import { CircleCheck, CircleX, Clock, Hourglass, Inbox, Info, MessageCircle, Phone, Send, TimerOff } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { requireActor } from '@/server/auth/current';
import { formatBdPhone } from '@/server/domain/phone';
import { incomingContactRequests, outgoingContactRequests } from '@/server/services/contact';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { Avatar, PageHead } from '@/components/account/bits';
import { Badge, BloodGroupBadge, EmptyState } from '@/components/ui';
import { cancelContactAction, respondContactAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.contact.title, robots: { index: false } };
}

type Status = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';
const STATUS: Record<Status, { tone: 'warning' | 'success' | 'neutral'; icon: typeof Clock }> = {
  pending: { tone: 'warning', icon: Hourglass },
  accepted: { tone: 'success', icon: CircleCheck },
  declined: { tone: 'neutral', icon: CircleX },
  cancelled: { tone: 'neutral', icon: CircleX },
  expired: { tone: 'neutral', icon: TimerOff },
};

function StatusBadge({ status, label }: { status: Status; label: string }) {
  const s = STATUS[status];
  return (
    <Badge tone={s.tone}>
      <s.icon size={14} aria-hidden="true" />
      {label}
    </Badge>
  );
}

function PhoneLinks({ phone, label, callLabel, smsLabel }: { phone: string; label: string; callLabel: string; smsLabel: string }) {
  return (
    <div className="acct-phone">
      <p className="small">{label}</p>
      <p className="phone-reveal">{formatBdPhone(phone)}</p>
      <div className="acct-actions">
        <a className="btn btn-primary" href={`tel:${phone}`}>
          <Phone size={18} aria-hidden="true" />
          {callLabel}
        </a>
        <a className="btn" href={`sms:${phone}`}>
          <MessageCircle size={18} aria-hidden="true" />
          {smsLabel}
        </a>
      </div>
    </div>
  );
}

export default async function ContactRequestsPage() {
  const { t, n, dateTime } = await getI18n();
  const c = t.account.contact;
  const actor = await requireActor('/account/contact-requests');
  const [incoming, outgoing] = await Promise.all([incomingContactRequests(actor), outgoingContactRequests(actor)]);
  const waiting = incoming.filter((r) => r.status === 'pending').length;

  return (
    <>
      <PageHead title={c.title} intro={c.intro} />

      <section aria-labelledby="incoming-title">
        <h2 id="incoming-title" className="acct-h2">
          <Inbox size={20} aria-hidden="true" className="icon-brand" />
          {c.incomingTitle}
          {waiting > 0 && <Badge tone="warning">{t.account.dashboard.waitingCount(n(waiting))}</Badge>}
        </h2>
        {!actor.donorId ? (
          <p className="acct-note">
            <Info size={16} aria-hidden="true" />
            <span>{c.noDonorIncoming}</span>
          </p>
        ) : incoming.length === 0 ? (
          <EmptyState icon={<Inbox size={36} aria-hidden="true" />} title={c.incomingEmpty} />
        ) : (
          <ul className="acct-list">
            {incoming.map((r) => (
              <li key={r.id} className={`card card-tight acct-item${r.status === 'pending' ? ' acct-item-unread' : ''}`}>
                <div className="acct-item-head">
                  <Avatar name={r.requesterName} />
                  <div>
                    <p className="acct-item-title">{c.from(r.requesterName)}</p>
                    <div className="acct-item-badges">
                      <StatusBadge status={r.status} label={c.status[r.status]} />
                    </div>
                  </div>
                </div>
                <p className="acct-quote">{r.message}</p>
                <p className="acct-meta">
                  <span>
                    <Send size={14} aria-hidden="true" />
                    {c.sentOn(dateTime(r.createdAt))}
                  </span>
                  {r.status === 'pending' && (
                    <span>
                      <Clock size={14} aria-hidden="true" />
                      {c.expiresOn(dateTime(r.expiresAt))}
                    </span>
                  )}
                </p>
                {r.requestPublicId && (
                  <Link className="section-link small" href={`/requests/${r.requestPublicId}`}>
                    {c.aboutRequest}
                  </Link>
                )}
                {r.status === 'pending' && (
                  <>
                    <p className="acct-note">
                      <Info size={16} aria-hidden="true" />
                      <span>{c.acceptNote}</span>
                    </p>
                    <ActionForm action={respondContactAction} className="acct-choice">
                      <input type="hidden" name="contactRequestId" value={r.id} />
                      <SubmitButton name="decision" value="accepted" label={c.accept} pendingLabel={t.common.actions.saving} className="btn btn-primary" />
                      <SubmitButton name="decision" value="declined" label={c.decline} pendingLabel={t.common.actions.saving} className="btn" />
                    </ActionForm>
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

      <section aria-labelledby="outgoing-title">
        <h2 id="outgoing-title" className="acct-h2">
          <Send size={20} aria-hidden="true" className="icon-brand" />
          {c.outgoingTitle}
        </h2>
        {outgoing.length === 0 ? (
          <EmptyState icon={<Send size={36} aria-hidden="true" />} title={c.outgoingEmpty}>
            <Link className="btn btn-soft" href="/donors">
              {t.common.nav.findDonors}
            </Link>
          </EmptyState>
        ) : (
          <ul className="acct-list">
            {outgoing.map((r) => (
              <li key={r.id} className="card card-tight acct-item">
                <div className="acct-item-head">
                  <BloodGroupBadge group={r.bloodGroup} small label={t.common.bloodGroup} />
                  <div>
                    <p className="acct-item-title">
                      <Link href={`/donors/${r.donorPublicId}`}>{c.to(r.donorName)}</Link>
                    </p>
                    <div className="acct-item-badges">
                      <StatusBadge status={r.status} label={c.status[r.status]} />
                    </div>
                  </div>
                </div>
                <p className="acct-quote">{r.message}</p>
                <p className="acct-meta">
                  <span>
                    <Send size={14} aria-hidden="true" />
                    {c.sentOn(dateTime(r.createdAt))}
                  </span>
                  {r.status === 'pending' && (
                    <span>
                      <Clock size={14} aria-hidden="true" />
                      {c.expiresOn(dateTime(r.expiresAt))}
                    </span>
                  )}
                </p>
                {r.status === 'pending' && (
                  <ActionForm action={cancelContactAction} className="stack-sm">
                    <input type="hidden" name="contactRequestId" value={r.id} />
                    <div>
                      <SubmitButton label={c.cancel} pendingLabel={t.common.actions.saving} className="btn btn-sm" />
                    </div>
                  </ActionForm>
                )}
                {r.status === 'accepted' && r.donorPhone && (
                  <>
                    <PhoneLinks phone={r.donorPhone} label={c.donorPhone} callLabel={t.common.actions.call} smsLabel={t.common.actions.sendSms} />
                    <p className="acct-staff-note">
                      <Info size={16} aria-hidden="true" />
                      <span>{c.notConfirmed}</span>
                    </p>
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
