import { z } from 'zod';
import { COMMUNITY_KINDS } from './domain/constants';
import { normalizeBdPhone } from './domain/phone';
import type { CommunityInput } from './services/communities';
import { f, formDataToObject, parseInput, type FieldErrors } from './validation';

const optionalPhone = z
  .string()
  .trim()
  .max(30, { error: 'tooLong' })
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const normalized = normalizeBdPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: 'invalidPhone' });
      return z.NEVER;
    }
    return normalized;
  });

const optionalYear = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const year = Number(value.replace(/[০-৯]/g, (ch) => String('০১২৩৪৫৬৭৮৯'.indexOf(ch))));
    if (!Number.isInteger(year)) {
      ctx.addIssue({ code: 'custom', message: 'invalidNumber' });
      return z.NEVER;
    }
    return year;
  });

export const communitySchema = z.object({
  name: f.requiredText(120, 3),
  nameEn: f.optionalText(120),
  kind: z.enum(COMMUNITY_KINDS, { error: 'required' }),
  description: f.safeNote(1000),
  foundedYear: optionalYear,
  divisionId: f.locationId,
  districtId: f.locationId,
  serviceAreaIds: z.preprocess(
    (v) => (v === undefined || v === '' ? [] : Array.isArray(v) ? v : [v]),
    z
      .array(z.coerce.number().int().positive({ error: 'invalidLocation' }), { error: 'required' })
      .min(1, { error: 'required' })
      .max(30, { error: 'tooLong' }),
  ),
  publicPhone: optionalPhone,
  publicEmail: f.optionalEmail,
  facebookUrl: f.optionalUrl,
  showPublicContact: f.checkbox,
  coordinatorContactPreference: z.enum(['in_app', 'phone', 'both'], { error: 'required' }),
  representativeName: f.requiredText(120, 2),
  representativeRole: f.optionalText(80),
  representativePhone: f.phone,
  verificationInfo: f.optionalText(1000),
});

/** Parses the shared community form (registration and settings). Array element errors are reported on the field itself. */
export function parseCommunityForm(formData: FormData): { ok: true; data: CommunityInput; raw: Record<string, string | string[]> } | { ok: false; fieldErrors: FieldErrors; raw: Record<string, string | string[]> } {
  const raw = formDataToObject(formData);
  const parsed = parseInput(communitySchema, raw);
  if (!parsed.ok) {
    const fieldErrors: FieldErrors = {};
    for (const [key, value] of Object.entries(parsed.fieldErrors)) {
      const field = key.replace(/\.\d+$/, '');
      fieldErrors[field] ??= value;
    }
    return { ok: false, fieldErrors, raw };
  }
  return { ok: true, data: { ...parsed.data, serviceAreaIds: [...new Set(parsed.data.serviceAreaIds)] }, raw };
}
