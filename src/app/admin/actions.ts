'use server';

import { appBaseUrl } from '@/server/config';
import { refresh } from 'next/cache';
import { z } from 'zod';
import { getI18n } from '@/i18n/server';
import { getActor } from '@/server/auth/current';
import { db } from '@/server/db/client';
import { errorKeyMessage, failure, invalid, keepValues, success, type FormState } from '@/server/actions';
import { isAdmin, type Actor } from '@/server/policy';
import { getRequestMeta } from '@/server/security/request-meta';
import { issuePasswordReset } from '@/server/services/accounts';
import { reviewDuplicate, revokeUserSessions, setDonorRestriction, setUserRole, setUserStatus } from '@/server/services/admin';
import { audit } from '@/server/services/audit';
import { reviewCommunity } from '@/server/services/communities';
import { reviewDonation, voidDonation } from '@/server/services/donations';
import { reviewProfileVerification } from '@/server/services/donors';
import { invalidateLocationIndex } from '@/server/services/location-index';
import { createLocation, updateLocation } from '@/server/services/locations';
import { dispatchQueuedDeliveries } from '@/server/services/notifications';
import { processDeletion } from '@/server/services/privacy';
import { handleReport } from '@/server/services/reports';
import { expireStale } from '@/server/services/requests';
import { updateSettings } from '@/server/services/settings';
import { getExternalProvider } from '@/server/notify/providers';
import { f, formDataToObject, parseInput } from '@/server/validation';

/** Every admin action starts here: signed-in, active platform administrator or nothing. */
async function adminActor(): Promise<Actor | null> {
  const actor = await getActor();
  return actor && isAdmin(actor) ? actor : null;
}

async function denied(): Promise<FormState> {
  return { status: 'error', message: await errorKeyMessage('forbidden'), ts: Date.now() };
}

async function done(message?: string, data?: FormState['data']): Promise<FormState> {
  refresh();
  const { t } = await getI18n();
  return success(message ?? t.admin.done, data);
}

const uuid = z.string().regex(/^[0-9a-f-]{36}$/i, { error: 'invalid' });
const note = f.safeNote(300);

/** Parses form data, runs the action as an admin and converts errors into form state. */
async function run<S extends z.ZodType>(
  schema: S,
  formData: FormData,
  fn: (actor: Actor, data: z.output<S>, meta: Awaited<ReturnType<typeof getRequestMeta>>) => Promise<FormState>,
): Promise<FormState> {
  const actor = await adminActor();
  if (!actor) return denied();
  const raw = formDataToObject(formData);
  const parsed = parseInput(schema, raw);
  if (!parsed.ok) return invalid(parsed.fieldErrors, keepValues(raw));
  try {
    return await fn(actor, parsed.data, await getRequestMeta());
  } catch (error) {
    return failure(error, keepValues(raw));
  }
}

// ---------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------

export async function runExpiryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(z.object({}), formData, async (actor, _d, meta) => {
    const result = await expireStale();
    await audit(db, { actor, action: 'admin.maintenance_expiry', metadata: result, ipHash: meta.ipHash });
    const { t, n } = await getI18n();
    return done(t.admin.overview.expiryDone(n(result.requests), n(result.contactRequests)));
  });
}

export async function sendQueuedAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(z.object({}), formData, async (actor, _d, meta) => {
    const { t, n } = await getI18n();
    if (!getExternalProvider()) return success(t.admin.overview.noProvider);
    const result = await dispatchQueuedDeliveries(100);
    await audit(db, { actor, action: 'admin.maintenance_dispatch', metadata: result, ipHash: meta.ipHash });
    return done(t.admin.overview.sendDone(n(result.sent), n(result.failed)));
  });
}

// ---------------------------------------------------------------------------
// Users and donors
// ---------------------------------------------------------------------------

export async function setUserStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(z.object({ userId: uuid, status: z.enum(['active', 'suspended']), reason: note }), formData, async (actor, d, meta) => {
    await setUserStatus(actor, d.userId, d.status, d.reason, meta);
    return done();
  });
}

export async function setUserRoleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(z.object({ userId: uuid, role: z.enum(['user', 'admin']), password: z.string().min(1, { error: 'required' }).max(128) }), formData, async (actor, d, meta) => {
    await setUserRole(actor, d.userId, d.role, d.password, meta);
    return done();
  });
}

export async function revokeSessionsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(z.object({ userId: uuid }), formData, async (actor, d, meta) => {
    await revokeUserSessions(actor, d.userId, meta);
    return done();
  });
}

export async function setDonorRestrictionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(z.object({ donorId: uuid, restricted: z.enum(['1', '0']), reason: note }), formData, async (actor, d, meta) => {
    await setDonorRestriction(actor, d.donorId, d.restricted === '1', d.reason, meta);
    return done();
  });
}

export async function reviewProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(z.object({ donorId: uuid, decision: z.enum(['verified', 'rejected']), note }), formData, async (actor, d, meta) => {
    await reviewProfileVerification(actor, d.donorId, d.decision, d.note, meta);
    return done();
  });
}

export async function reviewDonationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(z.object({ donationId: uuid, decision: z.enum(['verified', 'rejected']), note }), formData, async (actor, d, meta) => {
    await reviewDonation(actor, d.donationId, d.decision, d.note, meta);
    return done();
  });
}

export async function voidDonationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(z.object({ donationId: uuid, reason: f.requiredText(200).refine((v) => !/(?:\+?88)?01[3-9]\d{8}/.test(v), { error: 'noPhoneInText' }) }), formData, async (actor, d, meta) => {
    await voidDonation(actor, d.donationId, d.reason, meta);
    return done();
  });
}

export async function issueResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(z.object({ userId: uuid }), formData, async (actor, d, meta) => {
    const token = await issuePasswordReset(actor, d.userId, meta);
    const base = appBaseUrl();
    const { t } = await getI18n();
    // No refresh(): the link must stay on screen, it is shown exactly once.
    return success(t.admin.done, { link: `${base}/reset-password/${token}` });
  });
}

export async function processDeletionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(z.object({ requestId: uuid, confirm: f.mustAccept }), formData, async (actor, d, meta) => {
    await processDeletion(actor, d.requestId, meta);
    return done();
  });
}

// ---------------------------------------------------------------------------
// Communities, reports, duplicates
// ---------------------------------------------------------------------------

export async function reviewCommunityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(z.object({ communityId: uuid, decision: z.enum(['approved', 'rejected', 'suspended']), reason: note }), formData, async (actor, d, meta) => {
    await reviewCommunity(actor, d.communityId, d.decision, d.reason, meta);
    return done();
  });
}

export async function handleReportAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(z.object({ reportId: uuid, status: z.enum(['reviewing', 'resolved', 'dismissed']), note }), formData, async (actor, d, meta) => {
    await handleReport(actor, d.reportId, d.status, d.note, meta);
    return done();
  });
}

export async function reviewDuplicateAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(z.object({ donorA: uuid, donorB: uuid, decision: z.enum(['not_duplicate', 'duplicate_resolved']), note }), formData, async (actor, d, meta) => {
    await reviewDuplicate(actor, d.donorA, d.donorB, d.decision, d.note, meta);
    return done();
  });
}

// ---------------------------------------------------------------------------
// Locations and settings
// ---------------------------------------------------------------------------

const locationName = f.requiredText(80);

export async function createLocationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(
    z.object({ parentId: z.union([z.literal(''), z.coerce.number().int().positive()]).transform((v) => (v === '' ? null : v)), level: z.enum(['division', 'district', 'upazila']), nameBn: locationName, nameEn: locationName }),
    formData,
    async (actor, d, meta) => {
      await createLocation(actor, { parentId: d.parentId, level: d.level, nameBn: d.nameBn, nameEn: d.nameEn }, meta.ipHash);
      invalidateLocationIndex();
      return done();
    },
  );
}

export async function updateLocationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(z.object({ id: z.coerce.number().int().positive(), nameBn: locationName, nameEn: locationName, isActive: f.checkbox }), formData, async (actor, d, meta) => {
    await updateLocation(actor, d.id, { nameBn: d.nameBn, nameEn: d.nameEn, isActive: d.isActive }, meta.ipHash);
    invalidateLocationIndex();
    return done();
  });
}

const days = z.coerce.number({ error: 'invalidNumber' }).int({ error: 'invalidNumber' });

export async function updateSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(
    z.object({
      availabilityExpiryDays: days,
      whole_blood: days,
      double_red_cells: days,
      platelets: days,
      plasma: days,
      requestExpiryHours: days,
      contactRequestExpiryDays: days,
      minimumDonorAge: days,
    }),
    formData,
    async (actor, d, meta) => {
      try {
        await updateSettings(
          actor,
          {
            availabilityExpiryDays: d.availabilityExpiryDays,
            eligibilityIntervals: { whole_blood: d.whole_blood, double_red_cells: d.double_red_cells, platelets: d.platelets, plasma: d.plasma },
            requestExpiryHours: d.requestExpiryHours,
            contactRequestExpiryDays: d.contactRequestExpiryDays,
            minimumDonorAge: d.minimumDonorAge,
          },
          meta.ipHash,
        );
      } catch (error) {
        // The service reports nested paths ("eligibilityIntervals.plasma"); map them to form field names.
        const e = error as { fieldErrors?: Record<string, string> };
        if (e?.fieldErrors) {
          for (const key of Object.keys(e.fieldErrors)) {
            if (key.startsWith('eligibilityIntervals.')) e.fieldErrors[key.slice('eligibilityIntervals.'.length)] = e.fieldErrors[key];
          }
        }
        throw error;
      }
      return done();
    },
  );
}
