'use client';

import { ActionForm, SubmitButton } from '../form/ActionForm';
import { SelectField, TextArea, type Option } from '../form/fields';
import { changeStatusAction, respondAction, responseDecisionAction, withdrawAction } from '@/app/requests/actions';

export function OfferHelpForm({ publicId, labels }: { publicId: string; labels: { message: string; hint: string; submit: string; submitting: string; optional: string } }) {
  return (
    <ActionForm action={respondAction}>
      <input type="hidden" name="publicId" value={publicId} />
      <TextArea name="message" label={labels.message} hint={labels.hint} optionalLabel={labels.optional} maxLength={300} rows={2} />
      <div className="form-actions">
        <SubmitButton label={labels.submit} pendingLabel={labels.submitting} />
      </div>
    </ActionForm>
  );
}

export function WithdrawForm({ publicId, labels }: { publicId: string; labels: { submit: string; submitting: string } }) {
  return (
    <ActionForm action={withdrawAction} className="stack-sm">
      <input type="hidden" name="publicId" value={publicId} />
      <SubmitButton label={labels.submit} pendingLabel={labels.submitting} className="btn btn-danger btn-sm" />
    </ActionForm>
  );
}

export function StatusForm({
  publicId,
  token,
  options,
  labels,
}: {
  publicId: string;
  token?: string | null;
  options: Option[];
  labels: { status: string; reason: string; optional: string; submit: string; submitting: string; choose: string };
}) {
  return (
    <ActionForm action={changeStatusAction}>
      <input type="hidden" name="publicId" value={publicId} />
      {token && <input type="hidden" name="token" value={token} />}
      <SelectField name="status" label={labels.status} options={options} placeholder={labels.choose} required />
      <TextArea name="reason" label={labels.reason} optionalLabel={labels.optional} maxLength={200} rows={2} />
      <div className="form-actions">
        <SubmitButton label={labels.submit} pendingLabel={labels.submitting} className="btn btn-dark" />
      </div>
    </ActionForm>
  );
}

export function ResponseDecisionForm({
  publicId,
  responseId,
  token,
  labels,
  allowConfirm,
  allowDecline,
}: {
  publicId: string;
  responseId: string;
  token?: string | null;
  labels: { confirm: string; decline: string; saving: string };
  allowConfirm: boolean;
  allowDecline: boolean;
}) {
  return (
    <ActionForm action={responseDecisionAction} className="stack-sm">
      <input type="hidden" name="publicId" value={publicId} />
      <input type="hidden" name="responseId" value={responseId} />
      {token && <input type="hidden" name="token" value={token} />}
      <div className="cluster-sm">
        {allowConfirm && <SubmitButton name="decision" value="confirmed" label={labels.confirm} pendingLabel={labels.saving} className="btn btn-primary btn-sm" />}
        {allowDecline && <SubmitButton name="decision" value="declined" label={labels.decline} pendingLabel={labels.saving} className="btn btn-sm" />}
      </div>
    </ActionForm>
  );
}
