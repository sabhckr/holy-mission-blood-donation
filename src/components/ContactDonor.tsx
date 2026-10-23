'use client';

import { MessageCircle, Phone } from 'lucide-react';
import { ActionForm, SubmitButton, useFormContext } from './form/ActionForm';
import { TextArea } from './form/fields';
import type { ClientValidationMessages } from './form/client-messages';
import { contactRequestAction, revealPhoneAction } from '@/app/_actions/shared';

function RevealedNumber({ labels }: { labels: { number: string; call: string; sms: string; whatsapp: string } }) {
  const { state } = useFormContext();
  if (state.status !== 'success' || !state.data?.tel) return null;
  const tel = String(state.data.tel);
  return (
    <div className="revealed-number" aria-live="polite">
      <p className="small muted" style={{ margin: 0 }}>
        {labels.number}
      </p>
      <p className="phone-reveal" style={{ margin: 0 }}>
        {String(state.data.phone)}
      </p>
      <div className="revealed-actions">
        <a className="btn btn-primary btn-lg" href={`tel:${tel}`}>
          <Phone size={18} aria-hidden="true" />
          {labels.call}
        </a>
        <a className="btn" href={`sms:${tel}`}>
          <MessageCircle size={18} aria-hidden="true" />
          {labels.sms}
        </a>
        <a className="btn" href={`https://wa.me/${tel.replace('+', '')}`} rel="noopener noreferrer" target="_blank">
          {labels.whatsapp}
        </a>
      </div>
    </div>
  );
}

/** The "show number" button disappears once the number is shown, so "call" is the one main action. */
function RevealButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { state } = useFormContext();
  if (state.status === 'success' && state.data?.tel) return null;
  return <SubmitButton label={label} pendingLabel={pendingLabel} className="btn btn-primary btn-lg btn-block" />;
}

export function RevealPhone({ publicId, labels }: { publicId: string; labels: { show: string; showing: string; explain: string; number: string; call: string; sms: string; whatsapp: string } }) {
  return (
    <ActionForm action={revealPhoneAction} className="stack-sm">
      <input type="hidden" name="publicId" value={publicId} />
      <p className="hint">{labels.explain}</p>
      <RevealButton label={labels.show} pendingLabel={labels.showing} />
      <RevealedNumber labels={labels} />
    </ActionForm>
  );
}

export function ContactRequestForm({
  publicId,
  requestPublicId,
  labels,
  clientMessages,
  buttonClassName = 'btn btn-primary',
}: {
  publicId: string;
  requestPublicId?: string;
  labels: { message: string; hint: string; send: string; sending: string; explain: string };
  clientMessages?: ClientValidationMessages;
  /** Use a quieter button when another action on the page is the main one. */
  buttonClassName?: string;
}) {
  return (
    <ActionForm action={contactRequestAction} clientMessages={clientMessages}>
      <p className="hint">{labels.explain}</p>
      <input type="hidden" name="publicId" value={publicId} />
      {requestPublicId && <input type="hidden" name="requestPublicId" value={requestPublicId} />}
      <TextArea name="message" label={labels.message} hint={labels.hint} maxLength={300} required />
      <div className="form-actions">
        <SubmitButton label={labels.send} pendingLabel={labels.sending} className={buttonClassName} />
      </div>
    </ActionForm>
  );
}
