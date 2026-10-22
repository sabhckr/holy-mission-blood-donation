'use client';

import { MessageCircle, Phone } from 'lucide-react';
import type { FormState } from '@/server/actions';
import { ActionForm, SubmitButton, useFormContext } from '../form/ActionForm';

interface Labels {
  show: string;
  showing: string;
  call: string;
  sms: string;
}

function Revealed({ labels }: { labels: Labels }) {
  const { state } = useFormContext();
  if (state.status !== 'success' || !state.data?.tel) return null;
  const tel = String(state.data.tel);
  return (
    <div className="stack-sm" aria-live="polite">
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
      </div>
    </div>
  );
}

function Button({ labels }: { labels: Labels }) {
  const { state } = useFormContext();
  if (state.status === 'success') return null;
  return <SubmitButton label={labels.show} pendingLabel={labels.showing} className="btn btn-dark btn-sm" />;
}

/** Coordinator-only reveal of a consenting donor's number (the action checks area, consent and logs it). */
export function RevealDonorPhone({
  action,
  communityId,
  publicId,
  labels,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  communityId: string;
  publicId: string;
  labels: Labels;
}) {
  return (
    <ActionForm action={action} className="stack-sm">
      <input type="hidden" name="communityId" value={communityId} />
      <input type="hidden" name="publicId" value={publicId} />
      <Button labels={labels} />
      <Revealed labels={labels} />
    </ActionForm>
  );
}
