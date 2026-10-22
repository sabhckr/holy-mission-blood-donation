'use client';

import { ActionForm, SubmitButton, useFormContext } from '../form/ActionForm';
import { SelectField, TextArea, type Option } from '../form/fields';
import { assignCoordinatorAction, escalateAction, takeRequestAction } from '@/app/manage/[slug]/requests/actions';

export function TakeRequestForm({ publicId, communityId, labels }: { publicId: string; communityId: string; labels: { submit: string; submitting: string } }) {
  return (
    <ActionForm action={takeRequestAction} className="stack-sm">
      <input type="hidden" name="publicId" value={publicId} />
      <input type="hidden" name="communityId" value={communityId} />
      <SubmitButton label={labels.submit} pendingLabel={labels.submitting} />
    </ActionForm>
  );
}

export function AssignCoordinatorForm({
  publicId,
  communityId,
  options,
  current,
  labels,
}: {
  publicId: string;
  communityId: string;
  options: Option[];
  current: string | null;
  labels: { field: string; submit: string; submitting: string; choose: string };
}) {
  return (
    <ActionForm action={assignCoordinatorAction}>
      <input type="hidden" name="publicId" value={publicId} />
      <input type="hidden" name="communityId" value={communityId} />
      <SelectField name="coordinatorUserId" label={labels.field} options={options} defaultValue={current} placeholder={labels.choose} required />
      <div className="form-actions">
        <SubmitButton label={labels.submit} pendingLabel={labels.submitting} className="btn btn-dark" />
      </div>
    </ActionForm>
  );
}

function FieldError({ name }: { name: string }) {
  const { state } = useFormContext();
  const error = state.fieldErrors?.[name];
  return error ? <p className="error-text">{error}</p> : null;
}

export function EscalateForm({
  publicId,
  nearby,
  others,
  labels,
}: {
  publicId: string;
  nearby: Option[];
  others: Option[];
  labels: { field: string; nearby: string; others: string; choose: string; note: string; optional: string; submit: string; submitting: string };
}) {
  return (
    <ActionForm action={escalateAction}>
      <input type="hidden" name="publicId" value={publicId} />
      <div className="field">
        <label className="label" htmlFor="escalate-to">
          {labels.field}
        </label>
        <select id="escalate-to" name="toCommunityId" className="select" required defaultValue="">
          <option value="">{labels.choose}</option>
          {nearby.length > 0 && (
            <optgroup label={labels.nearby}>
              {nearby.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          )}
          {others.length > 0 && (
            <optgroup label={labels.others}>
              {others.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <FieldError name="toCommunityId" />
      </div>
      <TextArea name="note" label={labels.note} optionalLabel={labels.optional} maxLength={300} rows={2} />
      <div className="form-actions">
        <SubmitButton label={labels.submit} pendingLabel={labels.submitting} className="btn btn-dark" />
      </div>
    </ActionForm>
  );
}
