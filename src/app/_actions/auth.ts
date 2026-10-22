'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { safeNextPath, setSessionCookie } from '@/server/auth/current';
import { failure, invalid, keepValues, type FormState } from '@/server/actions';
import { CONTACT_METHODS, DONATION_TYPES, PHONE_VISIBILITIES, VISIBILITIES } from '@/server/domain/constants';
import { normalizeBdPhone } from '@/server/domain/phone';
import { AppError } from '@/server/errors';
import { enforceRateLimit } from '@/server/security/rate-limit';
import { getRequestMeta } from '@/server/security/request-meta';
import { authenticate, createSession, registerAccount, resetPasswordWithToken } from '@/server/services/accounts';
import { registerDonor } from '@/server/services/donors';
import { f, formDataToObject, parseInput } from '@/server/validation';
import { getLocale } from '@/i18n/server';

const signInSchema = z.object({ phone: z.string().trim().max(30), password: z.string().min(1, { error: 'required' }).max(128), next: z.string().optional() });

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formDataToObject(formData);
  const parsed = parseInput(signInSchema, raw);
  if (!parsed.ok) return invalid(parsed.fieldErrors, keepValues(raw));
  const meta = await getRequestMeta();
  const phone = normalizeBdPhone(parsed.data.phone);
  try {
    await enforceRateLimit('signIn', meta.ipHash);
    if (phone) await enforceRateLimit('signIn', `phone:${phone}`);
    const user = await authenticate(phone, parsed.data.password, meta);
    const session = await createSession(user.id, meta);
    await setSessionCookie(session.token, session.expiresAt);
  } catch (error) {
    return failure(error, keepValues(raw));
  }
  redirect(safeNextPath(parsed.data.next));
}

const passwordPair = { password: f.password, confirmPassword: z.string() };
const accountFields = {
  displayName: f.requiredText(80, 2),
  phone: f.phone,
  email: f.optionalEmail,
  ...passwordPair,
};

const accountSchema = z
  .object({ ...accountFields, acceptPrivacy: f.mustAccept })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], error: 'passwordMismatch' });

export async function registerAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formDataToObject(formData);
  const parsed = parseInput(accountSchema, raw);
  if (!parsed.ok) return invalid(parsed.fieldErrors, keepValues(raw));
  const meta = await getRequestMeta();
  try {
    await enforceRateLimit('register', meta.ipHash);
    const d = parsed.data;
    const user = await registerAccount({ phone: d.phone, password: d.password, displayName: d.displayName, email: d.email, locale: await getLocale() }, meta);
    const session = await createSession(user.id, meta);
    await setSessionCookie(session.token, session.expiresAt);
  } catch (error) {
    return failure(error, keepValues(raw));
  }
  redirect(safeNextPath(raw.next, '/account'));
}

const donorSchema = z
  .object({
    fullName: f.requiredText(80, 2),
    phone: f.phone,
    email: f.optionalEmail,
    ...passwordPair,
    dateOfBirth: f.isoDate,
    bloodGroup: f.bloodGroup,
    divisionId: f.locationId,
    districtId: f.locationId,
    upazilaId: f.optionalLocationId,
    locality: f.optionalText(80),
    preferredContactMethod: z.enum(CONTACT_METHODS, { error: 'required' }),
    lastDonationDate: f.optionalIsoDate,
    lastDonationType: z.enum(DONATION_TYPES).optional().or(z.literal('')),
    availableNow: f.checkbox,
    listedInSearch: f.checkbox,
    nameVisibility: z.enum(VISIBILITIES),
    phoneVisibility: z.enum(PHONE_VISIBILITIES),
    localityVisibility: z.enum(VISIBILITIES),
    donationHistoryVisibility: z.enum(VISIBILITIES),
    communityVisibility: z.enum(VISIBILITIES),
    allowCoordinatorContact: f.checkbox,
    allowContactRequests: f.checkbox,
    acceptPrivacy: f.mustAccept,
    confirmTruth: f.mustAccept,
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], error: 'passwordMismatch' });

export async function registerDonorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formDataToObject(formData);
  const parsed = parseInput(donorSchema, raw);
  if (!parsed.ok) return invalid(parsed.fieldErrors, keepValues(raw));
  const d = parsed.data;
  const meta = await getRequestMeta();
  try {
    await enforceRateLimit('register', meta.ipHash);
    const { user, donor } = await registerDonor(
      {
        account: { phone: d.phone, password: d.password, displayName: d.fullName, email: d.email, locale: await getLocale() },
        profile: {
          fullName: d.fullName,
          dateOfBirth: d.dateOfBirth,
          bloodGroup: d.bloodGroup,
          divisionId: d.divisionId,
          districtId: d.districtId,
          upazilaId: d.upazilaId,
          locality: d.locality,
          contactPhone: d.phone,
          preferredContactMethod: d.preferredContactMethod,
        },
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
        lastDonation: d.lastDonationDate ? { date: d.lastDonationDate, type: d.lastDonationType || 'whole_blood' } : null,
      },
      meta,
    );
    void donor;
    const session = await createSession(user.id, meta);
    await setSessionCookie(session.token, session.expiresAt);
  } catch (error) {
    return failure(error, keepValues(raw));
  }
  redirect('/account?welcome=1');
}

const resetSchema = z
  .object({ token: z.string().min(20).max(100), ...passwordPair })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], error: 'passwordMismatch' });

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formDataToObject(formData);
  const parsed = parseInput(resetSchema, raw);
  if (!parsed.ok) return invalid(parsed.fieldErrors);
  const meta = await getRequestMeta();
  try {
    await enforceRateLimit('passwordReset', meta.ipHash);
    await resetPasswordWithToken(parsed.data.token, parsed.data.password, meta);
  } catch (error) {
    if (error instanceof AppError && error.code === 'invalid_state') return failure(error);
    return failure(error);
  }
  redirect('/signin?reset=1');
}
