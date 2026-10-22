'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getI18n } from '@/i18n/server';
import { getActor } from '@/server/auth/current';
import { errorKeyMessage, failure, invalid, keepValues, success, type FormState } from '@/server/actions';
import { parseCommunityForm } from '@/server/community-form';
import { DONATION_TYPES, MEMBERSHIP_ROLES } from '@/server/domain/constants';
import { formatBdPhone } from '@/server/domain/phone';
import { todayInBangladesh, compareDates } from '@/server/domain/dates';
import { enforceRateLimit } from '@/server/security/rate-limit';
import { getRequestMeta } from '@/server/security/request-meta';
import {
  changeMemberRole,
  getCommunityContext,
  removeMember,
  revealDonorPhoneForCommunity,
  reviewMembership,
  updateCommunityProfile,
} from '@/server/services/communities';
import { recordDonationForMember, reviewDonation } from '@/server/services/donations';
import { reviewProfileVerification } from '@/server/services/donors';
import { f, formDataToObject, parseInput } from '@/server/validation';

async function errorState(key: string): Promise<FormState> {
  return { status: 'error', message: await errorKeyMessage(key), ts: Date.now() };
}

/** Every management action starts here: signed-in actor + the community's slug for revalidation. */
async function begin(formData: FormData) {
  const actor = await getActor();
  const communityId = String(formData.get('communityId') ?? '');
  if (!actor) return { error: await errorState('unauthenticated') } as const;
  if (!z.string().uuid().safeParse(communityId).success) return { error: await errorState('invalid_state') } as const;
  const ctx = await getCommunityContext(actor, { id: communityId });
  if (!ctx) return { error: await errorState('not_found') } as const;
  return { actor, communityId, slug: ctx.community.slug, meta: await getRequestMeta() } as const;
}

export async function updateCommunityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const start = await begin(formData);
  if ('error' in start) return start.error!;
  const parsed = parseCommunityForm(formData);
  if (!parsed.ok) return invalid(parsed.fieldErrors, keepValues(parsed.raw));
  try {
    await updateCommunityProfile(start.actor, start.communityId, parsed.data, start.meta);
    revalidatePath(`/manage/${start.slug}`, 'layout');
    revalidatePath(`/communities/${start.slug}`);
    const { t } = await getI18n();
    return { ...(await success(t.community.savedMsg)), values: keepValues(parsed.raw) };
  } catch (error) {
    return failure(error, keepValues(parsed.raw));
  }
}

const idSchema = z.string().uuid();

export async function reviewMembershipAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const start = await begin(formData);
  if ('error' in start) return start.error!;
  const membershipId = idSchema.safeParse(formData.get('membershipId'));
  const decision = formData.get('decision');
  if (!membershipId.success || (decision !== 'active' && decision !== 'rejected')) return errorState('invalid_state');
  try {
    await reviewMembership(start.actor, membershipId.data, decision, start.meta);
    revalidatePath(`/manage/${start.slug}`, 'layout');
    const { t } = await getI18n();
    return success(decision === 'active' ? t.community.approvedMsg : t.community.rejectedMsg);
  } catch (error) {
    return failure(error);
  }
}

export async function changeRoleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const start = await begin(formData);
  if ('error' in start) return start.error!;
  const membershipId = idSchema.safeParse(formData.get('membershipId'));
  const role = z.enum(MEMBERSHIP_ROLES).safeParse(formData.get('role'));
  if (!membershipId.success || !role.success) return errorState('invalid_state');
  try {
    await changeMemberRole(start.actor, membershipId.data, role.data, start.meta);
    revalidatePath(`/manage/${start.slug}/members`);
    const { t } = await getI18n();
    return success(t.community.roleChangedMsg);
  } catch (error) {
    return failure(error);
  }
}

export async function removeMemberAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const start = await begin(formData);
  if ('error' in start) return start.error!;
  const membershipId = idSchema.safeParse(formData.get('membershipId'));
  if (!membershipId.success) return errorState('invalid_state');
  try {
    await removeMember(start.actor, membershipId.data, start.meta);
    revalidatePath(`/manage/${start.slug}`, 'layout');
    const { t } = await getI18n();
    return success(t.community.removedMsg);
  } catch (error) {
    return failure(error);
  }
}

const reviewSchema = z.object({
  targetId: z.string().uuid(),
  decision: z.enum(['verified', 'rejected']),
  note: f.safeNote(300),
});

export async function reviewDonationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const start = await begin(formData);
  if ('error' in start) return start.error!;
  const raw = formDataToObject(formData);
  const parsed = parseInput(reviewSchema, raw);
  if (!parsed.ok) return invalid(parsed.fieldErrors, keepValues(raw));
  try {
    await reviewDonation(start.actor, parsed.data.targetId, parsed.data.decision, parsed.data.note, start.meta);
    revalidatePath(`/manage/${start.slug}`, 'layout');
    const { t } = await getI18n();
    return success(parsed.data.decision === 'verified' ? t.community.verifiedMsg : t.community.rejectedRecordMsg);
  } catch (error) {
    return failure(error, keepValues(raw));
  }
}

export async function reviewProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const start = await begin(formData);
  if ('error' in start) return start.error!;
  const raw = formDataToObject(formData);
  const parsed = parseInput(reviewSchema, raw);
  if (!parsed.ok) return invalid(parsed.fieldErrors, keepValues(raw));
  try {
    await reviewProfileVerification(start.actor, parsed.data.targetId, parsed.data.decision, parsed.data.note, start.meta);
    revalidatePath(`/manage/${start.slug}`, 'layout');
    const { t } = await getI18n();
    return success(parsed.data.decision === 'verified' ? t.community.profileVerifiedMsg : t.community.profileRejectedMsg);
  } catch (error) {
    return failure(error, keepValues(raw));
  }
}

const recordSchema = z.object({
  donorId: z.string({ error: 'required' }).uuid({ error: 'required' }),
  donatedOn: f.isoDate.refine((v) => compareDates(v, todayInBangladesh()) <= 0, { error: 'futureDate' }),
  donationType: z.enum(DONATION_TYPES, { error: 'required' }),
  place: f.optionalText(120),
  note: f.safeNote(300),
});

export async function recordDonationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const start = await begin(formData);
  if ('error' in start) return start.error!;
  const raw = formDataToObject(formData);
  const parsed = parseInput(recordSchema, raw);
  if (!parsed.ok) return invalid(parsed.fieldErrors, keepValues(raw));
  const { donorId, ...input } = parsed.data;
  try {
    await recordDonationForMember(start.actor, start.communityId, donorId, input, start.meta);
    revalidatePath(`/manage/${start.slug}`, 'layout');
    const { t } = await getI18n();
    return success(t.community.recordedMsg);
  } catch (error) {
    return failure(error, keepValues(raw));
  }
}

export async function revealCommunityPhoneAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const start = await begin(formData);
  if ('error' in start) return start.error!;
  const publicId = z.string().regex(/^[a-z0-9]{6,20}$/).safeParse(formData.get('publicId'));
  if (!publicId.success) return errorState('invalid_state');
  try {
    await enforceRateLimit('phoneReveal', start.actor.userId);
    const result = await revealDonorPhoneForCommunity(start.actor, start.communityId, publicId.data, start.meta);
    return success(undefined, { phone: formatBdPhone(result.phone), tel: result.phone, method: result.method });
  } catch (error) {
    return failure(error);
  }
}
