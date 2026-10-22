'use client';

import { MessageCircle, Phone } from 'lucide-react';
import { ActionForm, SubmitButton, useFormContext } from './form/ActionForm';
import { TextArea } from './form/fields';
import { contactRequestAction, revealPhoneAction } from '@/app/_actions/shared';

function RevealedNumber({ labels }: { labels: { number: string; call: string; sms: string; whatsapp: string } }) {
  const { state } = useFormContext();
  if (state.status !== 'success' || !state.data?.tel) return null;
  const tel = String(state.data.tel);
  return (
    <div className="card card-tight stack-sm" aria-live="polite">
      <p className="muted small" style={{ margin: 0 }}>
        {labels.number}
      </p>
      <p className="phone-reveal" style={{ margin: 0 }}>
        {String(state.data.phone)}
      </p>
      <div className="cluster-sm">
        <a className="btn btn-primary btn-sm" href={`tel:${tel}`}>
          <Phone size={16} aria-hidden="true" />
          {labels.call}
        </a>
        <a className="btn btn-sm" href={`sms:${tel}`}>
          <MessageCircle size={16} aria-hidden="true" />
          {labels.sms}
        </a>
        <a className="btn btn-sm" href={`https://wa.me/${tel.replace('+', '')}`} rel="noopener noreferrer" target="_blank">
          {labels.whatsapp}
        </a>
      </div>
    </div>
  );
}

export function RevealPhone({ publicId, labels }: { publicId: string; labels: { show: string; showing: string; explain: string; number: string; call: string; sms: string; whatsapp: string } }) {
  return (
    <ActionForm action={revealPhoneAction} className="stack-sm">
      <input type="hidden" name="publicId" value={publicId} />
      <p className="hint">{labels.explain}</p>
      <SubmitButton label={labels.show} pendingLabel={labels.showing} className="btn btn-dark" />
      <RevealedNumber labels={labels} />
    </ActionForm>
  );
}

export function ContactRequestForm({
  publicId,
  requestPublicId,
  labels,
}: {
  publicId: string;
  requestPublicId?: string;
  labels: { message: string; hint: string; send: string; sending: string; explain: string };
}) {
  return (
    <ActionForm action={contactRequestAction}>
      <p className="hint">{labels.explain}</p>
      <input type="hidden" name="publicId" value={publicId} />
      {requestPublicId && <input type="hidden" name="requestPublicId" value={requestPublicId} />}
      <TextArea name="message" label={labels.message} hint={labels.hint} maxLength={300} required />
      <div className="form-actions">
        <SubmitButton label={labels.send} pendingLabel={labels.sending} className="btn btn-primary" />
      </div>
    </ActionForm>
  );
}
