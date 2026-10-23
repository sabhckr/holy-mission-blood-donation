import type { ReactNode } from 'react';
import { getI18n } from '@/i18n/server';
import type { FormState } from '@/server/actions';
import { ActionForm, SubmitButton } from '../form/ActionForm';
import { clientValidationMessages } from '../form/client-messages';
import { CheckboxField, TextArea, TextField } from '../form/fields';

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * Small admin form: hidden ids, optional note/password/confirmation and one button.
 * Missing reasons and unticked confirmations are flagged in the browser before sending (with
 * JavaScript); the server action still checks everything it requires.
 */
export async function AdminAction({
  action,
  hidden,
  submit,
  pending,
  tone = 'default',
  size = 'sm',
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
  /** `md` is the normal button size, for the main action of a card. */
  size?: 'sm' | 'md';
  note?: { name: string; label: string; hint?: string; required?: boolean };
  password?: { label: string; hint?: string };
  confirm?: string;
  children?: ReactNode;
}) {
  const { t } = await getI18n();
  const cls = ['btn', tone === 'primary' ? 'btn-primary' : tone === 'danger' ? 'btn-danger' : null, size === 'sm' ? 'btn-sm' : null].filter(Boolean).join(' ');
  return (
    <ActionForm action={action} className="stack-sm" clientMessages={clientValidationMessages(t)}>
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
