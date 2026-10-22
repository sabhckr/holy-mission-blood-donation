'use client';

import { ActionForm, SubmitButton } from './form/ActionForm';
import { SelectField, TextArea, type Option } from './form/fields';
import { reportAction } from '@/app/_actions/shared';

export function ReportForm({
  targetType,
  targetId,
  labels,
  reasons,
}: {
  targetType: 'donor' | 'community' | 'request' | 'user';
  targetId: string;
  labels: { title: string; reason: string; details: string; detailsHint: string; submit: string; submitting: string; choose: string };
  reasons: Option[];
}) {
  return (
    <details className="disclosure">
      <summary>{labels.title}</summary>
      <ActionForm action={reportAction}>
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <SelectField name="reason" label={labels.reason} options={reasons} placeholder={labels.choose} required />
        <TextArea name="details" label={labels.details} hint={labels.detailsHint} maxLength={500} />
        <div className="form-actions">
          <SubmitButton label={labels.submit} pendingLabel={labels.submitting} className="btn" />
        </div>
      </ActionForm>
    </details>
  );
}
