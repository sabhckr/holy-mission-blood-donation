import type { Messages } from '@/i18n/messages';
import type { ConsentLabels, ProfileLabels } from '../DonorFormParts';
import { locationLabels } from '../consent-labels';

/** Donor detail labels for staff forms. Only plain strings, so they can cross into client components. */
export function adminProfileLabels(t: Messages, contactPhoneHint: string = t.admin.form.contactPhoneHint): ProfileLabels {
  const m = t.common.contactMethod;
  return {
    fullName: t.admin.form.fullName,
    dateOfBirth: t.admin.form.dateOfBirth,
    dateOfBirthHint: t.admin.form.dateOfBirthHint,
    bloodGroup: t.common.bloodGroup,
    locality: t.common.location.locality,
    localityHint: t.common.location.localityHint,
    preferredContact: t.admin.form.preferredContact,
    contactPhone: t.admin.form.contactPhone,
    contactPhoneHint,
    optional: t.common.states.optional,
    location: locationLabels(t),
    contactMethods: { call: m.call, sms: m.sms, whatsapp: m.whatsapp, in_app: m.in_app },
  };
}

/** Consent labels written about the donor (third person), for staff entering them on someone's behalf. */
export function adminConsentLabels(t: Messages): ConsentLabels {
  const c = t.admin.consent;
  return {
    listedInSearch: c.listedInSearch,
    listedInSearchHint: c.listedInSearchHint,
    publicNotice: c.publicNotice,
    allowCoordinatorContact: c.allowCoordinatorContact,
    allowContactRequests: c.allowContactRequests,
  };
}
