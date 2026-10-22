'use server';

import { z } from 'zod';
import { getActor } from '@/server/auth/current';
import { errorKeyMessage, failure, invalid, keepValues, success, type FormState } from '@/server/actions';
import { REPORT_REASONS, REPORT_TARGETS } from '@/server/domain/constants';
import { formatBdPhone } from '@/server/domain/phone';
import { enforceRateLimit } from '@/server/security/rate-limit';
import { getRequestMeta } from '@/server/security/request-meta';
import { revealDonorPhone } from '@/server/services/donors';
import { sendContactRequest } from '@/server/services/contact';
import { createReport } from '@/server/services/reports';
import { f, formDataToObject, parseInput } from '@/server/validation';
import { getI18n } from '@/i18n/server';

/** Reveal a donor's number on their public profile (signed-in, consent-checked, rate limited, logged). */
export async function revealPhoneAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await getActor();
  if (!actor) return { status: 'error', message: await errorKeyMessage('unauthenticated'), ts: Date.now() };
  try {
    const meta = await getRequestMeta();
    await enforceRateLimit('phoneReveal', actor.userId);
    const result = await revealDonorPhone(actor, String(formData.get('publicId') ?? ''), meta);
    return success(undefined, { phone: formatBdPhone(result.phone), tel: result.phone, method: result.method });
  } catch (error) {
    return failure(error);
  }
}

const contactSchema = z.object({
  publicId: z.string().regex(/^[a-z0-9]{6,20}$/),
  message: f.requiredText(300, 10),
  requestPublicId: z.string().regex(/^[a-z0-9]{6,20}$/).optional().or(z.literal('')),
});

export async function contactRequestAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await getActor();
  if (!actor) return { status: 'error', message: await errorKeyMessage('unauthenticated'), ts: Date.now() };
  const raw = formDataToObject(formData);
  const parsed = parseInput(contactSchema, raw);
  if (!parsed.ok) return invalid(parsed.fieldErrors, keepValues(raw));
  try {
    const meta = await getRequestMeta();
    await enforceRateLimit('contactRequest', actor.userId);
    await sendContactRequest(actor, parsed.data.publicId, parsed.data.message, parsed.data.requestPublicId || null, meta);
    const { t } = await getI18n();
    return success(t.donor.requestSent);
  } catch (error) {
    return failure(error, keepValues(raw));
  }
}

const reportSchema = z.object({
  targetType: z.enum(REPORT_TARGETS),
  targetId: z.string().min(6).max(40),
  reason: z.enum(REPORT_REASONS, { error: 'required' }),
  details: f.safeNote(500),
});

export async function reportAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formDataToObject(formData);
  const parsed = parseInput(reportSchema, raw);
  if (!parsed.ok) return invalid(parsed.fieldErrors, keepValues(raw));
  try {
    const actor = await getActor();
    const meta = await getRequestMeta();
    await enforceRateLimit('report', actor?.userId ?? meta.ipHash);
    await createReport(actor, parsed.data, meta);
    const { t } = await getI18n();
    return success(t.common.report.success);
  } catch (error) {
    return failure(error, keepValues(raw));
  }
}
