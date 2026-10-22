'use server';

import { appBaseUrl } from '@/server/config';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { isLocale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { getI18n } from '@/i18n/server';
import { getActor } from '@/server/auth/current';
import { db } from '@/server/db/client';
import { donorProfiles, users } from '@/server/db/schema';
import { errorKeyMessage, failure, invalid, keepValues, success, type FormState } from '@/server/actions';
import { CONTACT_METHODS, PHONE_VISIBILITIES, VISIBILITIES } from '@/server/domain/constants';
import { can, type Actor, type PlatformPermission } from '@/server/policy';
import { getRequestMeta } from '@/server/security/request-meta';
import { issuePasswordReset } from '@/server/services/accounts';
import { reviewDuplicate, revokeUserSessions, setUserRole, setUserStatus } from '@/server/services/admin';
import { audit } from '@/server/services/audit';
import { reviewCommunity, setCommunityAffiliation } from '@/server/services/communities';
import { reviewDonation, voidDonation } from '@/server/services/donations';
import { reviewDonorRegistration, staffCreateDonor, staffSetAvailability, staffSetListingStatus, staffUpdateDonor } from '@/server/services/donor-admin';
import { reviewProfileVerification } from '@/server/services/donors';
import { invalidateLocationIndex } from '@/server/services/location-index';
import { createLocation, updateLocation } from '@/server/services/locations';
import { dispatchQueuedDeliveries } from '@/server/services/notifications';
import { addOperatingArea, setOperatingAreaActive, updateOperatingAreaNote } from '@/server/services/operating-areas';
import { processDeletion } from '@/server/services/privacy';
import { handleReport } from '@/server/services/reports';
import { expireStale } from '@/server/services/requests';
import { updateSettings } from '@/server/services/settings';
import { getExternalProvider } from '@/server/notify/providers';
import { containsPhoneNumber, f, formDataToObject, parseInput } from '@/server/validation';

/** Every staff action starts here: a signed-in, active staff member holding this permission, or nothing. */
async function staffActor(permission: PlatformPermission): Promise<Actor | null> {
  const actor = await getActor();
  return actor && can(actor, permission) ? actor : null;
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
/** A required reason: short, and never a phone number. */
const reason = f.requiredText(300).refine((v) => !containsPhoneNumber(v), { error: 'noPhoneInText' });

/**
 * Reports a missing reason and a missing confirmation together (instead of one per submit).
 * Returns null when everything needed is there.
 */
async function missing(formData: FormData, checks: { reason?: string | null; needsReason?: boolean; confirm?: boolean; needsConfirm?: boolean }): Promise<FormState | null> {
  const errors: Record<string, string> = {};
  if (checks.needsReason && !checks.reason) errors.reason = 'required';
  if (checks.needsConfirm && !checks.confirm) errors.confirm = 'mustAccept';
  return Object.keys(errors).length ? invalid(errors, keepValues(formDataToObject(formData))) : null;
}

/** Parses form data, checks the permission, runs the action and converts errors into form state. */
async function run<S extends z.ZodType>(
  permission: PlatformPermission,
  schema: S,
  formData: FormData,
  fn: (actor: Actor, data: z.output<S>, meta: Awaited<ReturnType<typeof getRequestMeta>>) => Promise<FormState>,
): Promise<FormState> {
  const actor = await staffActor(permission);
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

/** Notifications quote a status label; write it in the donor's own language. */
async function donorMessages(donorId: string) {
  const [row] = await db
    .select({ locale: users.preferredLocale })
    .from(donorProfiles)
    .innerJoin(users, eq(users.id, donorProfiles.userId))
    .where(eq(donorProfiles.id, donorId));
  return getMessages(isLocale(row?.locale) ? row.locale : 'bn');
}

// ---------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------

export async function runExpiryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run('settings.manage', z.object({}), formData, async (actor, _d, meta) => {
    const result = await expireStale();
    await audit(db, { actor, action: 'admin.maintenance_expiry', metadata: result, ipHash: meta.ipHash });
    const { t, n } = await getI18n();
    return done(t.admin.overview.expiryDone(n(result.requests), n(result.contactRequests)));
  });
}

export async function sendQueuedAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run('settings.manage', z.object({}), formData, async (actor, _d, meta) => {
    const { t, n } = await getI18n();
    if (!getExternalProvider()) return success(t.admin.overview.noProvider);
    const result = await dispatchQueuedDeliveries(100);
    await audit(db, { actor, action: 'admin.maintenance_dispatch', metadata: result, ipHash: meta.ipHash });
    return done(t.admin.overview.sendDone(n(result.sent), n(result.failed)));
  });
}

// ---------------------------------------------------------------------------
// Donors (staff)
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

function pickProfile(d: z.output<z.ZodObject<typeof profileShape>>) {
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

export async function reviewRegistrationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(
    'donors.review',
    z.object({ donorId: uuid, decision: z.enum(['approved', 'rejected']), reason: note, confirm: f.checkbox }),
    formData,
    async (actor, d, meta) => {
      const rejecting = d.decision === 'rejected';
      const problem = await missing(formData, { reason: d.reason, needsReason: rejecting, confirm: d.confirm, needsConfirm: rejecting });
      if (problem) return problem;
      await reviewDonorRegistration(actor, d.donorId, d.decision, d.reason, meta);
      const { t } = await getI18n();
      return done(t.admin.doneNotified);
    },
  );
}

export async function staffUpdateDonorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run('donors.manage', z.object({ donorId: uuid, ...profileShape, reason }), formData, async (actor, d, meta) => {
    const { changed } = await staffUpdateDonor(actor, d.donorId, pickProfile(d), d.reason, meta);
    const { t } = await getI18n();
    if (changed.length === 0) return success(t.admin.donor.noChanges);
    return done(t.admin.doneNotified);
  });
}

export async function staffSetAvailabilityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(
    'donors.availability',
    z.object({ donorId: uuid, status: z.enum(['available', 'unavailable', 'unknown'], { error: 'required' }), reason }),
    formData,
    async (actor, d, meta) => {
      const label = (await donorMessages(d.donorId)).common.availability[d.status];
      await staffSetAvailability(actor, d.donorId, d.status, d.reason, label, meta);
      const { t } = await getI18n();
      return done(t.admin.doneNotified);
    },
  );
}

export async function staffSetListingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(
    'donors.manage',
    z.object({ donorId: uuid, status: z.enum(['active', 'restricted', 'removed']), reason: note, confirm: f.checkbox }),
    formData,
    async (actor, d, meta) => {
      const problem = await missing(formData, { reason: d.reason, needsReason: true, confirm: d.confirm, needsConfirm: d.status !== 'active' });
      if (problem) return problem;
      const label = (await donorMessages(d.donorId)).common.listingStatus[d.status];
      await staffSetListingStatus(actor, d.donorId, d.status, d.reason ?? '', label, meta);
      const { t } = await getI18n();
      return done(t.admin.doneNotified);
    },
  );
}

export async function staffCreateDonorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(
    'donors.manage',
    z.object({ phone: f.phone, ...profileShape, ...consentShape, availableNow: f.checkbox, consentConfirmed: f.mustAccept, note }),
    formData,
    async (actor, d, meta) => {
      const { donor } = await staffCreateDonor(
        actor,
        {
          phone: d.phone,
          profile: pickProfile(d),
          consents: {
            listedInSearch: d.listedInSearch,
            nameVisibility: d.nameVisibility,
            phoneVisibility: d.phoneVisibility,
            localityVisibility: d.localityVisibility,
            donationHistoryVisibility: d.donationHistoryVisibility,
            communityVisibility: d.communityVisibility,
            allowCoordinatorContact: d.allowCoordinatorContact,
            allowContactRequests: d.allowContactRequests,
          },
          availableNow: d.availableNow,
          consentConfirmed: d.consentConfirmed,
          note: d.note,
        },
        meta,
      );
      refresh();
      redirect(`/admin/donors/${donor.id}?created=1`);
    },
  );
}

export async function reviewProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run('verifications.review', z.object({ donorId: uuid, decision: z.enum(['verified', 'rejected']), note }), formData, async (actor, d, meta) => {
    await reviewProfileVerification(actor, d.donorId, d.decision, d.note, meta);
    return done();
  });
}

export async function reviewDonationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run('verifications.review', z.object({ donationId: uuid, decision: z.enum(['verified', 'rejected']), note }), formData, async (actor, d, meta) => {
    await reviewDonation(actor, d.donationId, d.decision, d.note, meta);
    return done();
  });
}

export async function voidDonationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run('verifications.review', z.object({ donationId: uuid, reason: f.requiredText(200).refine((v) => !containsPhoneNumber(v), { error: 'noPhoneInText' }) }), formData, async (actor, d, meta) => {
    await voidDonation(actor, d.donationId, d.reason, meta);
    return done();
  });
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function setUserStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run('users.manage', z.object({ userId: uuid, status: z.enum(['active', 'suspended']), reason: note }), formData, async (actor, d, meta) => {
    await setUserStatus(actor, d.userId, d.status, d.reason, meta);
    return done();
  });
}

export async function setUserRoleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(
    'users.manage',
    z.object({ userId: uuid, role: z.enum(['user', 'moderator', 'admin'], { error: 'required' }), password: z.string().min(1, { error: 'required' }).max(128) }),
    formData,
    async (actor, d, meta) => {
      await setUserRole(actor, d.userId, d.role, d.password, meta);
      return done();
    },
  );
}

export async function revokeSessionsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run('users.manage', z.object({ userId: uuid }), formData, async (actor, d, meta) => {
    await revokeUserSessions(actor, d.userId, meta);
    return done();
  });
}

export async function issueResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run('users.manage', z.object({ userId: uuid }), formData, async (actor, d, meta) => {
    const token = await issuePasswordReset(actor, d.userId, meta);
    const base = appBaseUrl();
    const { t } = await getI18n();
    // No refresh(): the link must stay on screen, it is shown exactly once.
    return success(t.admin.done, { link: `${base}/reset-password/${token}` });
  });
}

export async function processDeletionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run('deletions.process', z.object({ requestId: uuid, confirm: f.mustAccept }), formData, async (actor, d, meta) => {
    await processDeletion(actor, d.requestId, meta);
    return done();
  });
}

// ---------------------------------------------------------------------------
// Organisations, operating areas, reports, duplicates
// ---------------------------------------------------------------------------

export async function reviewCommunityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run('communities.review', z.object({ communityId: uuid, decision: z.enum(['approved', 'rejected', 'suspended']), reason: note }), formData, async (actor, d, meta) => {
    await reviewCommunity(actor, d.communityId, d.decision, d.reason, meta);
    return done();
  });
}

export async function setAffiliationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(
    'communities.review',
    z.object({ communityId: uuid, affiliation: z.enum(['independent', 'holy_mission']), reason: note, confirm: f.checkbox }),
    formData,
    async (actor, d, meta) => {
      const problem = await missing(formData, { reason: d.reason, needsReason: true, confirm: d.confirm, needsConfirm: d.affiliation === 'holy_mission' });
      if (problem) return problem;
      await setCommunityAffiliation(actor, d.communityId, d.affiliation, d.reason ?? '', meta);
      return done();
    },
  );
}

const areaId = z.coerce.number().int().positive();

export async function addOperatingAreaAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(
    'operating_areas.manage',
    z.object({ divisionId: f.locationId, districtId: f.locationId, upazilaId: f.optionalLocationId, publicNote: note }),
    formData,
    async (actor, d, meta) => {
      try {
        await addOperatingArea(actor, d.upazilaId ?? d.districtId, d.publicNote, meta);
      } catch (error) {
        // The service reports the chosen place as "locationId"; show it on the district select.
        const e = error as { fieldErrors?: Record<string, string> };
        if (e?.fieldErrors?.locationId) e.fieldErrors[d.upazilaId ? 'upazilaId' : 'districtId'] = e.fieldErrors.locationId;
        throw error;
      }
      return done();
    },
  );
}

export async function setOperatingAreaActiveAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(
    'operating_areas.manage',
    z.object({ id: areaId, isActive: z.enum(['1', '0']), reason: note, confirm: f.checkbox }),
    formData,
    async (actor, d, meta) => {
      const problem = await missing(formData, { reason: d.reason, needsReason: true, confirm: d.confirm, needsConfirm: d.isActive === '0' });
      if (problem) return problem;
      await setOperatingAreaActive(actor, d.id, d.isActive === '1', d.reason ?? '', meta);
      return done();
    },
  );
}

export async function updateOperatingAreaNoteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run('operating_areas.manage', z.object({ id: areaId, publicNote: note }), formData, async (actor, d, meta) => {
    await updateOperatingAreaNote(actor, d.id, d.publicNote, meta);
    return done();
  });
}

export async function handleReportAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run('reports.handle', z.object({ reportId: uuid, status: z.enum(['reviewing', 'resolved', 'dismissed']), note }), formData, async (actor, d, meta) => {
    await handleReport(actor, d.reportId, d.status, d.note, meta);
    return done();
  });
}

export async function reviewDuplicateAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run('duplicates.review', z.object({ donorA: uuid, donorB: uuid, decision: z.enum(['not_duplicate', 'duplicate_resolved']), note }), formData, async (actor, d, meta) => {
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
    'locations.manage',
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
  return run('locations.manage', z.object({ id: z.coerce.number().int().positive(), nameBn: locationName, nameEn: locationName, isActive: f.checkbox }), formData, async (actor, d, meta) => {
    await updateLocation(actor, d.id, { nameBn: d.nameBn, nameEn: d.nameEn, isActive: d.isActive }, meta.ipHash);
    invalidateLocationIndex();
    return done();
  });
}

const days = z.coerce.number({ error: 'invalidNumber' }).int({ error: 'invalidNumber' });

export async function updateSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return run(
    'settings.manage',
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
