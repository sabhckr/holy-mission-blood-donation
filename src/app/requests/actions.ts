'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getActor } from '@/server/auth/current';
import { errorKeyMessage, failure, invalid, keepValues, success, type FormState } from '@/server/actions';
import { REQUEST_CONTACT_PREFERENCES, REQUEST_STATUSES, URGENCIES } from '@/server/domain/constants';
import { bangladeshDateTimeToInstant } from '@/server/domain/dates';
import { enforceRateLimit } from '@/server/security/rate-limit';
import { getRequestMeta } from '@/server/security/request-meta';
import { changeRequestStatus, createBloodRequest, respondToRequest, setResponseStatus, withdrawResponse } from '@/server/services/requests';
import { f, formDataToObject, parseInput } from '@/server/validation';
import { getI18n } from '@/i18n/server';

const publicId = z.string().regex(/^[a-z0-9]{6,20}$/);
const optionalToken = z
  .string()
  .max(100)
  .optional()
  .transform((v) => (v ? v : null));

/** Re-render every page that shows this request. */
function refresh(id: string) {
  revalidatePath(`/requests/${id}`);
  revalidatePath('/requests');
  revalidatePath('/requests/manage/[token]', 'page');
  revalidatePath('/manage/[slug]/requests', 'page');
  revalidatePath('/manage/[slug]/requests/[publicId]', 'page');
}

const createSchema = z.object({
  bloodGroup: f.bloodGroup,
  units: z.coerce.number({ error: 'invalidNumber' }).int({ error: 'invalidNumber' }).min(1, { error: 'outOfRange' }).max(20, { error: 'outOfRange' }),
  divisionId: f.locationId,
  districtId: f.locationId,
  upazilaId: f.optionalLocationId,
  hospitalName: f.requiredText(120, 3),
  neededDate: f.isoDate,
  neededTime: f.time,
  urgency: z.enum(URGENCIES, { error: 'required' }),
  requesterName: f.requiredText(80, 2),
  requesterPhone: f.phone,
  contactPreference: z.enum(REQUEST_CONTACT_PREFERENCES, { error: 'required' }),
  sharePhoneWithResponders: f.checkbox,
  note: f.safeNote(300),
  showOnPublicBoard: f.checkbox,
  communityId: z
    .union([z.literal(''), f.uuid])
    .optional()
    .transform((v) => (v ? v : null)),
  confirmGenuine: f.mustAccept,
});

export async function createRequestAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formDataToObject(formData);
  const parsed = parseInput(createSchema, raw);
  if (!parsed.ok) return invalid(parsed.fieldErrors, keepValues(raw));
  const d = parsed.data;
  try {
    const actor = await getActor();
    const meta = await getRequestMeta();
    await enforceRateLimit('bloodRequest', actor?.userId ?? meta.ipHash);
    const { request, manageToken } = await createBloodRequest(
      actor && actor.status === 'active' ? actor : null,
      {
        bloodGroup: d.bloodGroup,
        units: d.units,
        divisionId: d.divisionId,
        districtId: d.districtId,
        upazilaId: d.upazilaId,
        hospitalName: d.hospitalName,
        neededAt: bangladeshDateTimeToInstant(d.neededDate, d.neededTime),
        urgency: d.urgency,
        requesterName: d.requesterName,
        requesterPhone: d.requesterPhone,
        contactPreference: d.contactPreference,
        // "Coordinator only" means the number is never shown to donors.
        sharePhoneWithResponders: d.contactPreference === 'coordinator_only' ? false : d.sharePhoneWithResponders,
        note: d.note,
        showOnPublicBoard: d.showOnPublicBoard,
        communityId: d.communityId,
      },
      meta,
    );
    revalidatePath('/requests');
    revalidatePath('/');
    const { t } = await getI18n();
    return success(t.request.createdMessage, {
      publicId: request.publicId,
      managePath: `/requests/manage/${manageToken}`,
      bloodGroup: request.bloodGroup,
      districtId: request.districtId,
      signedIn: !!actor,
    });
  } catch (error) {
    return failure(error, keepValues(raw));
  }
}

const respondSchema = z.object({ publicId, message: f.safeNote(300) });

export async function respondAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await getActor();
  if (!actor) return { status: 'error', message: await errorKeyMessage('unauthenticated'), ts: Date.now() };
  const raw = formDataToObject(formData);
  const parsed = parseInput(respondSchema, raw);
  if (!parsed.ok) return invalid(parsed.fieldErrors, keepValues(raw));
  try {
    const meta = await getRequestMeta();
    await enforceRateLimit('generic', actor.userId);
    await respondToRequest(actor, parsed.data.publicId, parsed.data.message, meta);
    refresh(parsed.data.publicId);
    const { t } = await getI18n();
    return success(t.request.offered);
  } catch (error) {
    return failure(error, keepValues(raw));
  }
}

export async function withdrawAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await getActor();
  if (!actor) return { status: 'error', message: await errorKeyMessage('unauthenticated'), ts: Date.now() };
  const parsed = publicId.safeParse(formData.get('publicId'));
  if (!parsed.success) return { status: 'error', message: await errorKeyMessage('not_found'), ts: Date.now() };
  try {
    const meta = await getRequestMeta();
    await withdrawResponse(actor, parsed.data, meta);
    refresh(parsed.data);
    const { t } = await getI18n();
    return success(t.request.withdrawn);
  } catch (error) {
    return failure(error);
  }
}

const statusSchema = z.object({
  publicId,
  status: z.enum(REQUEST_STATUSES, { error: 'required' }),
  reason: f.safeNote(200),
  token: optionalToken,
});

/** Used by requesters (signed in or with the private link), coordinators and admins. The service checks who may do what. */
export async function changeStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formDataToObject(formData);
  const parsed = parseInput(statusSchema, raw);
  if (!parsed.ok) return invalid(parsed.fieldErrors, keepValues(raw));
  const actor = await getActor();
  if (!actor && !parsed.data.token) return { status: 'error', message: await errorKeyMessage('unauthenticated'), ts: Date.now() };
  try {
    const meta = await getRequestMeta();
    await enforceRateLimit('generic', actor?.userId ?? meta.ipHash);
    await changeRequestStatus(actor, parsed.data.publicId, parsed.data.status, parsed.data.reason, parsed.data.token, meta);
    refresh(parsed.data.publicId);
    const { t } = await getI18n();
    return success(t.request.statusSaved);
  } catch (error) {
    return failure(error, keepValues(raw));
  }
}

const responseSchema = z.object({
  publicId,
  responseId: f.uuid,
  decision: z.enum(['confirmed', 'declined']),
  token: optionalToken,
});

export async function responseDecisionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formDataToObject(formData);
  const parsed = parseInput(responseSchema, raw);
  if (!parsed.ok) return invalid(parsed.fieldErrors);
  const actor = await getActor();
  if (!actor && !parsed.data.token) return { status: 'error', message: await errorKeyMessage('unauthenticated'), ts: Date.now() };
  try {
    const meta = await getRequestMeta();
    await setResponseStatus(actor, parsed.data.publicId, parsed.data.responseId, parsed.data.decision, parsed.data.token, meta);
    refresh(parsed.data.publicId);
    const { t } = await getI18n();
    return success(t.request.responseSaved);
  } catch (error) {
    return failure(error);
  }
}
