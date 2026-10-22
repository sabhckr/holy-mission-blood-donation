import { unstable_rethrow } from 'next/navigation';
import { getLocale } from '@/i18n/server';
import { getMessages } from '@/i18n/messages';
import { AppError } from './errors';

/** State returned by every form action and consumed by <ActionForm>. All text is already translated. */
export interface FormState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Submitted values (never passwords), used to refill the form after an error. */
  values?: Record<string, string>;
  /** Extra data for the page, e.g. a revealed phone number or a one-time link. */
  data?: Record<string, string | number | boolean | null>;
  ts?: number;
}

export const initialFormState: FormState = { status: 'idle' };

const SECRET_FIELDS = /password|token/i;

export function keepValues(raw: Record<string, string | string[]>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (SECRET_FIELDS.test(k)) continue;
    out[k] = Array.isArray(v) ? v.join(',') : v;
  }
  return out;
}

async function translate(fieldErrors: Record<string, string>) {
  const t = getMessages(await getLocale());
  const out: Record<string, string> = {};
  for (const [field, key] of Object.entries(fieldErrors)) {
    out[field] = (t.validation as Record<string, string>)[key] ?? t.validation.invalid;
  }
  return out;
}

export async function errorKeyMessage(key: string): Promise<string> {
  const t = getMessages(await getLocale());
  return (t.errors as Record<string, string>)[key] ?? t.errors.unexpected;
}

/** Validation failure before any service call. */
export async function invalid(fieldErrors: Record<string, string>, values?: Record<string, string>): Promise<FormState> {
  return { status: 'error', message: await errorKeyMessage('validation'), fieldErrors: await translate(fieldErrors), values, ts: Date.now() };
}

/** Converts a thrown error into form state. Next.js redirects/notFound are re-thrown. */
export async function failure(error: unknown, values?: Record<string, string>): Promise<FormState> {
  unstable_rethrow(error);
  if (error instanceof AppError) {
    const fieldErrors = await translate(error.fieldErrors);
    const key = Object.keys(error.fieldErrors).length && error.messageKey === 'conflict' ? 'validation' : error.messageKey;
    return { status: 'error', message: await errorKeyMessage(key), fieldErrors, values, ts: Date.now() };
  }
  console.error('[action] unexpected error', error);
  return { status: 'error', message: await errorKeyMessage('unexpected'), values, ts: Date.now() };
}

export async function success(message?: string, data?: FormState['data']): Promise<FormState> {
  return { status: 'success', message, data, ts: Date.now() };
}
