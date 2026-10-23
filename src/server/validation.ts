import { z } from 'zod';
import { BLOOD_GROUPS } from './domain/constants';
import { isIsoDate } from './domain/dates';
import { normalizeBdPhone, toAsciiDigits } from './domain/phone';

export type FieldErrors = Record<string, string>;

/** Message keys that exist in the `validation` dictionary. Anything else becomes 'invalid'. */
const KNOWN_KEYS = new Set([
  'required', 'invalid', 'tooShort', 'tooLong', 'invalidPhone', 'invalidEmail', 'invalidDate', 'futureDate', 'pastDate',
  'tooYoung', 'tooOld', 'beforeBirth', 'passwordTooShort', 'passwordTooLong', 'passwordMismatch', 'passwordWeak',
  'invalidLocation', 'invalidBloodGroup', 'mustAccept', 'outOfRange', 'invalidUrl', 'invalidNumber', 'phoneTaken',
  'emailTaken', 'duplicateDonation', 'nameTaken', 'wrongPassword', 'noPhoneInText', 'outsideServiceArea', 'pastTime', 'tooFarAhead',
]);

export type ParseResult<T> = { ok: true; data: T } | { ok: false; fieldErrors: FieldErrors };

export function parseInput<S extends z.ZodType>(schema: S, input: unknown): ParseResult<z.output<S>> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const fieldErrors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path.length ? issue.path.map(String).join('.') : '_form';
    if (fieldErrors[field]) continue;
    fieldErrors[field] = KNOWN_KEYS.has(issue.message) ? issue.message : 'invalid';
  }
  return { ok: false, fieldErrors };
}

/** FormData -> plain object. Repeated names (checkbox groups) become arrays. */
export function formDataToObject(formData: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [key, raw] of formData.entries()) {
    if (key.startsWith('$ACTION')) continue;
    const value = typeof raw === 'string' ? raw : '';
    const existing = out[key];
    if (existing === undefined) out[key] = value;
    else out[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
  }
  return out;
}

const PHONE_IN_TEXT = /(?:\+?88)?0?1[3-9](?:[\s-]?\d){8}/;
export function containsPhoneNumber(text: string): boolean {
  return PHONE_IN_TEXT.test(toAsciiDigits(text));
}

const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', '87654321', 'password', 'password1', 'password123', 'qwerty123', 'abcd1234',
  '11111111', '00000000', 'iloveyou', 'bangladesh', 'bangladesh1', 'blood123', 'abc12345', '12341234', 'admin123',
]);

export function isWeakPassword(password: string, phone?: string | null): boolean {
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return true;
  if (/^(.)\1+$/.test(password)) return true;
  if (phone && lower.includes(phone.replace(/^\+88/, '').slice(-8))) return true;
  return false;
}

export const f = {
  requiredText: (max: number, min = 1) =>
    z
      .string({ error: 'required' })
      .trim()
      .min(1, { error: 'required' })
      .min(min, { error: 'tooShort' })
      .max(max, { error: 'tooLong' })
      .transform((v) => v.normalize('NFC')),
  optionalText: (max: number) =>
    z
      .string()
      .trim()
      .max(max, { error: 'tooLong' })
      .optional()
      .transform((v) => (v ? v.normalize('NFC') : null)),
  /** Free text that must not contain phone numbers (notes, report details). */
  safeNote: (max: number) =>
    z
      .string()
      .trim()
      .max(max, { error: 'tooLong' })
      .refine((v) => !containsPhoneNumber(v), { error: 'noPhoneInText' })
      .optional()
      .transform((v) => (v ? v.normalize('NFC') : null)),
  phone: z
    .string({ error: 'required' })
    .trim()
    .min(1, { error: 'required' })
    .transform((value, ctx) => {
      const normalized = normalizeBdPhone(value);
      if (!normalized) {
        ctx.addIssue({ code: 'custom', message: 'invalidPhone' });
        return z.NEVER;
      }
      return normalized;
    }),
  optionalEmail: z
    .string()
    .trim()
    .max(200, { error: 'tooLong' })
    .optional()
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { error: 'invalidEmail' }),
  optionalUrl: z
    .string()
    .trim()
    .max(300, { error: 'tooLong' })
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^https:\/\/[^\s]+$/i.test(v), { error: 'invalidUrl' }),
  password: z.string({ error: 'required' }).min(8, { error: 'passwordTooShort' }).max(128, { error: 'passwordTooLong' }),
  isoDate: z.string({ error: 'required' }).trim().min(1, { error: 'required' }).refine(isIsoDate, { error: 'invalidDate' }),
  optionalIsoDate: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || isIsoDate(v), { error: 'invalidDate' }),
  time: z.string({ error: 'required' }).trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: 'invalid' }),
  bloodGroup: z.enum(BLOOD_GROUPS, { error: 'invalidBloodGroup' }),
  locationId: z.coerce.number({ error: 'invalidLocation' }).int({ error: 'invalidLocation' }).positive({ error: 'invalidLocation' }),
  optionalLocationId: z
    .union([z.literal(''), z.coerce.number().int().positive()], { error: 'invalidLocation' })
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  checkbox: z.preprocess((v) => v === 'on' || v === 'true' || v === true || v === '1', z.boolean()),
  mustAccept: z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.literal(true, { error: 'mustAccept' })),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  uuid: z.string().uuid({ error: 'invalid' }),
};
