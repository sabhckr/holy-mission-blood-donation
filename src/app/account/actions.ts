'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getI18n } from '@/i18n/server';
import { clearSessionCookie, getActor, getSession } from '@/server/auth/current';
import { errorKeyMessage, failure, invalid, keepValues, success, type FormState } from '@/server/actions';
import { CONTACT_METHODS, DONATION_TYPES, PHONE_VISIBILITIES, VISIBILITIES } from '@/server/domain/constants';
import type { Actor } from '@/server/policy';
import { getRequestMeta } from '@/server/security/request-meta';
import { changePassword, revokeOtherSessions, revokeSessionById, updateAccountBasics } from '@/server/services/accounts';
import { leaveCommunity } from '@/server/services/communities';
import { cancelContactRequest, respondToContactRequest } from '@/server/services/contact';
import { addOwnDonation, correctDonation, submitDonationForReview, voidDonation } from '@/server/services/donations';
import {
  createDonorProfile,
  requestProfileVerification,
  setAvailability,
  setDonorListingPaused,
  updateConsents,
  updateDonorProfile,
} from '@/server/services/donors';
import { markNotificationsRead } from '@/server/services/notifications';
import { cancelDeletionRequest, deactivateAccount, reactivateAccount, requestAccountDeletion } from '@/server/services/privacy';
import { f, formDataToObject, parseInput } from '@/server/validation';

/** Every account action needs a signed-in user; deactivated users may only reactivate. */
async function withActor(run: (actor: Actor) => Promise<FormState>, allowDeactivated = false): Promise<FormState> {
  const actor = await getActor();
  if (!actor) return { status: 'error', message: await errorKeyMessage('unauthenticated'), ts: Date.now() };
  if (actor.status !== 'active' && !allowDeactivated) return { status: 'error', message: await errorKeyMessage('forbidden'), ts: Date.now() };
  return run(actor);
}

function refresh() {
  revalidatePath('/', 'layout');
}

const uuid = z.string().uuid();

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function reactivateAction(_prev: FormState): Promise<FormState> {
  return withActor(async (actor) => {
    try {
      await reactivateAccount(actor, await getRequestMeta());
      refresh();
      return success((await getI18n()).t.account.dashboard.reactivated);
    } catch (error) {
      return failure(error);
    }
  }, true);
}

export async function setAvailabilityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return withActor(async (actor) => {
    const status = formData.get('status');
    if (status !== 'available' && status !== 'unavailable') return invalid({ status: 'invalid' });
    try {
      await setAvailability(actor, status, null, await getRequestMeta());
      refresh();
      const { t } = await getI18n();
      return success(status === 'available' ? t.account.dashboard.availabilitySavedAvailable : t.account.dashboard.availabilitySavedUnavailable);
    } catch (error) {
      return failure(error);
    }
  });
}

export async function setListingPausedAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return withActor(async (actor) => {
    const paused = formData.get('paused') === 'true';
    try {
      await setDonorListingPaused(actor, paused, await getRequestMeta());
      refresh();
      const { t } = await getI18n();
      return success(paused ? t.account.dashboard.paused : t.account.dashboard.resumed);
    } catch (error) {
      return failure(error);
    }
  });
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

const profileShape = {
  fullName: f.requiredText(80, 2),
  dateOfBirth: f.isoDate,
  bloodGroup: f.bloodGroup,
  divisionId: f.locationId,
  districtId: f.locationId,
  upazilaId: f.optionalLocationId,
  locality: f.optionalText(80),
  contactPhone: f.phone,
  preferredContactMethod: z.enum(CONTACT_METHODS, { error: 'required' }),
};

const consentShape = {
  listedInSearch: f.checkbox,
  nameVisibility: z.enum(VISIBILITIES),
  phoneVisibility: z.enum(PHONE_VISIBILITIES),
  localityVisibility: z.enum(VISIBILITIES),
  donationHistoryVisibility: z.enum(VISIBILITIES),
  communityVisibility: z.enum(VISIBILITIES),
  allowCoordinatorContact: f.checkbox,
  allowContactRequests: f.checkbox,
};

const profileSchema = z.object(profileShape);
const createProfileSchema = z.object({ ...profileShape, ...consentShape, availableNow: f.checkbox });
const consentSchema = z.object(consentShape);

function pickProfile(d: z.output<typeof profileSchema>) {
  return {
    fullName: d.fullName,
    dateOfBirth: d.dateOfBirth,
    bloodGroup: d.bloodGroup,
    divisionId: d.divisionId,
    districtId: d.districtId,
    upazilaId: d.upazilaId,
    locality: d.locality,
    contactPhone: d.contactPhone,
    preferredContactMethod: d.preferredContactMethod,
  };
}

function pickConsents(d: z.output<typeof consentSchema>) {
  return {
    listedInSearch: d.listedInSearch,
    nameVisibility: d.nameVisibility,
    phoneVisibility: d.phoneVisibility,
    localityVisibility: d.localityVisibility,
    donationHistoryVisibility: d.donationHistoryVisibility,
    communityVisibility: d.communityVisibility,
    allowCoordinatorContact: d.allowCoordinatorContact,
    allowContactRequests: d.allowContactRequests,
  };
}

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return withActor(async (actor) => {
    const raw = formDataToObject(formData);
    const parsed = parseInput(profileSchema, raw);
    if (!parsed.ok) return invalid(parsed.fieldErrors, keepValues(raw));
    try {
      const result = await updateDonorProfile(actor, pickProfile(parsed.data), await getRequestMeta());
      refresh();
      const p = (await getI18n()).t.account.profile;
      // A rejected registration goes back to review when the donor saves corrections.
      if (result.resubmitted) return success(result.verificationReset ? `${p.savedResubmitted} ${p.verificationResetExtra}` : p.savedResubmitted);
      return success(result.verificationReset ? p.savedVerificationReset : p.saved);
    } catch (error) {
      return failure(error, keepValues(raw));
    }
  });
}

export async function createDonorProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const result = await withActor(async (actor) => {
    const raw = formDataToObject(formData);
    const parsed = parseInput(createProfileSchema, raw);
    if (!parsed.ok) return invalid(parsed.fieldErrors, keepValues(raw));
    try {
      await createDonorProfile(actor, pickProfile(parsed.data), pickConsents(parsed.data), parsed.data.availableNow, await getRequestMeta());
      refresh();
      return { status: 'success', ts: Date.now() } satisfies FormState;
    } catch (error) {
      return failure(error, keepValues(raw));
    }
  });
  if (result.status === 'success') redirect('/account?welcome=1');
  return result;
}

const basicsSchema = z.object({ displayName: f.requiredText(80, 2), email: f.optionalEmail });

export async function updateAccountBasicsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return withActor(async (actor) => {
    const raw = formDataToObject(formData);
    const parsed = parseInput(basicsSchema, raw);
    if (!parsed.ok) return invalid(parsed.fieldErrors, keepValues(raw));
    try {
      await updateAccountBasics(actor, { displayName: parsed.data.displayName, email: parsed.data.email }, await getRequestMeta());
      refresh();
      return success((await getI18n()).t.account.profile.accountSaved);
    } catch (error) {
      return failure(error, keepValues(raw));
    }
  });
}

export async function requestVerificationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return withActor(async (actor) => {
    const parsed = uuid.safeParse(formData.get('communityId'));
    if (!parsed.success) return invalid({ communityId: 'required' });
    try {
      await requestProfileVerification(actor, parsed.data, await getRequestMeta());
      refresh();
      return success((await getI18n()).t.account.profile.verificationRequested);
    } catch (error) {
      return failure(error);
    }
  });
}

// ---------------------------------------------------------------------------
// Privacy
// ---------------------------------------------------------------------------

export async function updateConsentsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return withActor(async (actor) => {
    const raw = formDataToObject(formData);
    const parsed = parseInput(consentSchema, raw);
    if (!parsed.ok) return invalid(parsed.fieldErrors, keepValues(raw));
    try {
      await updateConsents(actor, pickConsents(parsed.data), await getRequestMeta());
      refresh();
      return success((await getI18n()).t.account.privacy.saved);
    } catch (error) {
      return failure(error, keepValues(raw));
    }
  });
}

// ---------------------------------------------------------------------------
// Donations
// ---------------------------------------------------------------------------

const donationShape = {
  donatedOn: f.isoDate,
  donationType: z.enum(DONATION_TYPES, { error: 'required' }),
  place: f.optionalText(120),
  note: f.safeNote(300),
};

const addDonationSchema = z.object({ ...donationShape, reviewCommunityId: z.union([z.literal(''), z.string().uuid()]).optional() });
const correctDonationSchema = z.object({ ...donationShape, donationId: z.string().uuid() });

export async function addDonationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return withActor(async (actor) => {
    const raw = formDataToObject(formData);
    const parsed = parseInput(addDonationSchema, raw);
    if (!parsed.ok) return invalid(parsed.fieldErrors, keepValues(raw));
    const d = parsed.data;
    try {
      await addOwnDonation(actor, { donatedOn: d.donatedOn, donationType: d.donationType, place: d.place, note: d.note }, d.reviewCommunityId || null, await getRequestMeta());
      refresh();
      return success((await getI18n()).t.account.donations.added);
    } catch (error) {
      return failure(error, keepValues(raw));
    }
  });
}

export async function submitDonationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return withActor(async (actor) => {
    const donationId = uuid.safeParse(formData.get('donationId'));
    const communityId = uuid.safeParse(formData.get('communityId'));
    if (!donationId.success || !communityId.success) return invalid({ communityId: 'required' });
    try {
      await submitDonationForReview(actor, donationId.data, communityId.data, await getRequestMeta());
      refresh();
      return success((await getI18n()).t.account.donations.submitted);
    } catch (error) {
      return failure(error);
    }
  });
}

export async function correctDonationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return withActor(async (actor) => {
    const raw = formDataToObject(formData);
    const parsed = parseInput(correctDonationSchema, raw);
    if (!parsed.ok) return invalid(parsed.fieldErrors, keepValues(raw));
    const d = parsed.data;
    try {
      await correctDonation(actor, d.donationId, { donatedOn: d.donatedOn, donationType: d.donationType, place: d.place, note: d.note }, await getRequestMeta());
      refresh();
      return success((await getI18n()).t.account.donations.corrected);
    } catch (error) {
      return failure(error, keepValues(raw));
    }
  });
}

const voidSchema = z.object({ donationId: z.string().uuid(), reason: f.requiredText(200, 3) });

export async function voidDonationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return withActor(async (actor) => {
    const raw = formDataToObject(formData);
    const parsed = parseInput(voidSchema, raw);
    if (!parsed.ok) return invalid(parsed.fieldErrors, keepValues(raw));
    try {
      await voidDonation(actor, parsed.data.donationId, parsed.data.reason, await getRequestMeta());
      refresh();
      return success((await getI18n()).t.account.donations.voided);
    } catch (error) {
      return failure(error, keepValues(raw));
    }
  });
}

// ---------------------------------------------------------------------------
// Contact requests
// ---------------------------------------------------------------------------

export async function respondContactAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return withActor(async (actor) => {
    const id = uuid.safeParse(formData.get('contactRequestId'));
    const decision = formData.get('decision');
    if (!id.success || (decision !== 'accepted' && decision !== 'declined')) return invalid({ decision: 'invalid' });
    try {
      await respondToContactRequest(actor, id.data, decision, await getRequestMeta());
      refresh();
      const { t } = await getI18n();
      return success(decision === 'accepted' ? t.account.contact.accepted : t.account.contact.declined);
    } catch (error) {
      return failure(error);
    }
  });
}

export async function cancelContactAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return withActor(async (actor) => {
    const id = uuid.safeParse(formData.get('contactRequestId'));
    if (!id.success) return invalid({ contactRequestId: 'invalid' });
    try {
      await cancelContactRequest(actor, id.data);
      refresh();
      return success((await getI18n()).t.account.contact.cancelled);
    } catch (error) {
      return failure(error);
    }
  });
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function markNotificationsReadAction(_prev: FormState): Promise<FormState> {
  return withActor(async (actor) => {
    try {
      await markNotificationsRead(actor.userId);
      refresh();
      return success((await getI18n()).t.account.notifications.marked);
    } catch (error) {
      return failure(error);
    }
  }, true);
}

// ---------------------------------------------------------------------------
// Security, deactivation, deletion
// ---------------------------------------------------------------------------

const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, { error: 'required' }).max(128), newPassword: f.password, confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], error: 'passwordMismatch' });

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return withActor(async (actor) => {
    const parsed = parseInput(changePasswordSchema, formDataToObject(formData));
    if (!parsed.ok) return invalid(parsed.fieldErrors);
    try {
      const session = await getSession();
      await changePassword(actor, parsed.data.currentPassword, parsed.data.newPassword, session?.sessionId ?? null, await getRequestMeta());
      refresh();
      return success((await getI18n()).t.account.security.changed);
    } catch (error) {
      return failure(error);
    }
  });
}

export async function revokeSessionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return withActor(async (actor) => {
    const sessionId = String(formData.get('sessionId') ?? '');
    if (!/^[a-f0-9]{64}$/.test(sessionId)) return invalid({ sessionId: 'invalid' });
    try {
      await revokeSessionById(actor, sessionId);
      refresh();
      return success((await getI18n()).t.account.security.revoked);
    } catch (error) {
      return failure(error);
    }
  });
}

export async function revokeOtherSessionsAction(_prev: FormState): Promise<FormState> {
  return withActor(async (actor) => {
    try {
      const session = await getSession();
      if (!session) return { status: 'error', message: await errorKeyMessage('unauthenticated'), ts: Date.now() };
      await revokeOtherSessions(actor, session.sessionId);
      refresh();
      return success((await getI18n()).t.account.security.othersSignedOut);
    } catch (error) {
      return failure(error);
    }
  });
}

const passwordOnly = z.object({ password: z.string().min(1, { error: 'required' }).max(128) });

export async function deactivateAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const result = await withActor(async (actor) => {
    const parsed = parseInput(passwordOnly, formDataToObject(formData));
    if (!parsed.ok) return invalid(parsed.fieldErrors);
    try {
      await deactivateAccount(actor, parsed.data.password, await getRequestMeta());
      await clearSessionCookie();
      return { status: 'success', ts: Date.now() } satisfies FormState;
    } catch (error) {
      return failure(error);
    }
  });
  if (result.status === 'success') {
    refresh();
    redirect('/');
  }
  return result;
}

const deletionSchema = z.object({ password: z.string().min(1, { error: 'required' }).max(128), reason: f.safeNote(300) });

export async function requestDeletionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return withActor(
    async (actor) => {
      const raw = formDataToObject(formData);
      const parsed = parseInput(deletionSchema, raw);
      if (!parsed.ok) return invalid(parsed.fieldErrors, keepValues(raw));
      try {
        await requestAccountDeletion(actor, parsed.data.password, parsed.data.reason, await getRequestMeta());
        refresh();
        return success((await getI18n()).t.account.security.deletionRequested);
      } catch (error) {
        return failure(error, keepValues(raw));
      }
    },
    true,
  );
}

export async function cancelDeletionAction(_prev: FormState): Promise<FormState> {
  return withActor(
    async (actor) => {
      try {
        await cancelDeletionRequest(actor, await getRequestMeta());
        refresh();
        return success((await getI18n()).t.account.security.deletionCancelled);
      } catch (error) {
        return failure(error);
      }
    },
    true,
  );
}

// ---------------------------------------------------------------------------
// Communities
// ---------------------------------------------------------------------------

export async function leaveCommunityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return withActor(async (actor) => {
    const id = uuid.safeParse(formData.get('communityId'));
    if (!id.success) return invalid({ communityId: 'invalid' });
    try {
      await leaveCommunity(actor, id.data, await getRequestMeta());
      refresh();
      return success((await getI18n()).t.account.communities.left);
    } catch (error) {
      return failure(error);
    }
  });
}
