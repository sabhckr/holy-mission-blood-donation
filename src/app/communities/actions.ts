'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getI18n } from '@/i18n/server';
import { getActor } from '@/server/auth/current';
import { errorKeyMessage, failure, invalid, keepValues, success, type FormState } from '@/server/actions';
import { parseCommunityForm } from '@/server/community-form';
import { enforceRateLimit } from '@/server/security/rate-limit';
import { getRequestMeta } from '@/server/security/request-meta';
import { applyToJoin, registerCommunity } from '@/server/services/communities';

async function unauthenticated(): Promise<FormState> {
  return { status: 'error', message: await errorKeyMessage('unauthenticated'), ts: Date.now() };
}

export async function registerCommunityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await getActor();
  if (!actor) return unauthenticated();
  const parsed = parseCommunityForm(formData);
  if (!parsed.ok) return invalid(parsed.fieldErrors, keepValues(parsed.raw));
  let slug: string;
  try {
    const meta = await getRequestMeta();
    await enforceRateLimit('communityRegister', actor.userId);
    const community = await registerCommunity(actor, parsed.data, meta);
    slug = community.slug;
  } catch (error) {
    return failure(error, keepValues(parsed.raw));
  }
  redirect(`/manage/${slug}`);
}

const joinSchema = z.object({ communityId: z.string().uuid(), slug: z.string().max(80) });

export async function joinCommunityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await getActor();
  if (!actor) return unauthenticated();
  const parsed = joinSchema.safeParse({ communityId: formData.get('communityId'), slug: formData.get('slug') });
  if (!parsed.success) return { status: 'error', message: await errorKeyMessage('invalid_state'), ts: Date.now() };
  try {
    await enforceRateLimit('generic', actor.userId);
    await applyToJoin(actor, parsed.data.communityId, await getRequestMeta());
    revalidatePath(`/communities/${parsed.data.slug}`);
    const { t } = await getI18n();
    return success(t.community.joinedMsg);
  } catch (error) {
    return failure(error);
  }
}
