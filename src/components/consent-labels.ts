import type { Messages } from '@/i18n/messages';
import type { ConsentLabels } from './DonorFormParts';

/** Only plain strings may cross into client components, so pick the consent labels explicitly. */
export function consentLabels(t: Messages): ConsentLabels {
  const a = t.auth;
  return {
    listedInSearch: a.listedInSearch,
    listedInSearchHint: a.listedInSearchHint,
    publicNotice: a.publicNotice,
    allowCoordinatorContact: a.allowCoordinatorContact,
    allowContactRequests: a.allowContactRequests,
  };
}

export function locationLabels(t: Messages) {
  const l = t.common.location;
  return {
    division: l.division,
    district: l.district,
    upazila: l.upazila,
    any: l.any,
    chooseDivision: l.chooseDivision,
    chooseDistrict: l.chooseDistrict,
    chooseUpazila: l.chooseUpazila,
    chooseDistrictFirst: l.chooseDistrictFirst,
  };
}
