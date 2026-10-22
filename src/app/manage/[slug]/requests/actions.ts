'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getActor } from '@/server/auth/current';
import { errorKeyMessage, failure, invalid, keepValues, success, type FormState } from '@/server/actions';
import { getRequestMeta } from '@/server/security/request-meta';
import { assignRequest, escalateRequest } from '@/server/services/requests';
import { f, formDataToObject, parseInput } from '@/server/validation';
import { getI18n } from '@/i18n/server';

const publicId = z.string().regex(/^[a-z0-9]{6,20}$/);

function refresh(id: string) {
  revalidatePath(`/requests/${id}`);
  revalidatePath('/manage/[slug]/requests', 'page');
  revalidatePath('/manage/[slug]/requests/[publicId]', 'page');
}

async function signedIn() {
  const actor = await getActor();
  return actor && actor.status === 'active' ? actor : null;
}

const takeSchema = z.object({ publicId, communityId: f.uuid });

/** The community takes responsibility for an unassigned request in its area (or one escalated to it). */
export async function takeRequestAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await signedIn();
  if (!actor) return { status: 'error', message: await errorKeyMessage('unauthenticated'), ts: Date.now() };
  const parsed = parseInput(takeSchema, formDataToObject(formData));
  if (!parsed.ok) return invalid(parsed.fieldErrors);
  try {
    await assignRequest(actor, parsed.data.publicId, parsed.data.communityId, null, await getRequestMeta());
    refresh(parsed.data.publicId);
    const { t } = await getI18n();
    return success(t.request.taken);
  } catch (error) {
    return failure(error);
  }
}

const assignSchema = z.object({ publicId, communityId: f.uuid, coordinatorUserId: f.uuid });

export async function assignCoordinatorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await signedIn();
  if (!actor) return { status: 'error', message: await errorKeyMessage('unauthenticated'), ts: Date.now() };
  const raw = formDataToObject(formData);
  const parsed = parseInput(assignSchema, raw);
  if (!parsed.ok) return invalid(parsed.fieldErrors, keepValues(raw));
  try {
    await assignRequest(actor, parsed.data.publicId, parsed.data.communityId, parsed.data.coordinatorUserId, await getRequestMeta());
    refresh(parsed.data.publicId);
    const { t } = await getI18n();
    return success(t.request.assignSaved);
  } catch (error) {
    return failure(error, keepValues(raw));
  }
}

const escalateSchema = z.object({ publicId, toCommunityId: f.uuid, note: f.safeNote(300) });

export async function escalateAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await signedIn();
  if (!actor) return { status: 'error', message: await errorKeyMessage('unauthenticated'), ts: Date.now() };
  const raw = formDataToObject(formData);
  const parsed = parseInput(escalateSchema, raw);
  if (!parsed.ok) return invalid(parsed.fieldErrors, keepValues(raw));
  try {
    await escalateRequest(actor, parsed.data.publicId, parsed.data.toCommunityId, parsed.data.note, await getRequestMeta());
    refresh(parsed.data.publicId);
    const { t } = await getI18n();
    return success(t.request.escalated);
  } catch (error) {
    return failure(error, keepValues(raw));
  }
}
