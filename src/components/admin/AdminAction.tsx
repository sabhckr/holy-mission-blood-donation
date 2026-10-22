import type { ReactNode } from 'react';
import type { FormState } from '@/server/actions';
import { ActionForm, SubmitButton } from '../form/ActionForm';
import { CheckboxField, TextArea, TextField } from '../form/fields';

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/** Small admin form: hidden ids, optional note/password/confirmation and one button. */
export function AdminAction({
  action,
  hidden,
  submit,
  pending,
  tone = 'default',
  note,
  password,
  confirm,
  children,
}: {
  action: Action;
  hidden: Record<string, string>;
  submit: string;
  pending: string;
  tone?: 'default' | 'primary' | 'danger';
  note?: { name: string; label: string; hint?: string; required?: boolean };
  password?: { label: string; hint?: string };
  confirm?: string;
  children?: ReactNode;
}) {
  const cls = tone === 'primary' ? 'btn btn-primary btn-sm' : tone === 'danger' ? 'btn btn-danger btn-sm' : 'btn btn-sm';
  return (
    <ActionForm action={action} className="stack-sm">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {note && <TextArea name={note.name} label={note.label} hint={note.hint} maxLength={300} rows={2} required={note.required} />}
      {password && <TextField name="password" type="password" label={password.label} hint={password.hint} autoComplete="current-password" required maxLength={128} />}
      {confirm && <CheckboxField name="confirm" label={confirm} required />}
      {children}
      <div className="form-actions">
        <SubmitButton label={submit} pendingLabel={pending} className={cls} />
      </div>
    </ActionForm>
  );
}
