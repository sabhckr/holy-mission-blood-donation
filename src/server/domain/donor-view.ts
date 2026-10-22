/**
 * Pure projection of a donor record into what a given viewer may see.
 * All public pages and search results go through projectDonor(); nothing else
 * should hand donor rows to the UI.
 */
import { canSee, type ViewerLevel } from '../policy';
import type { AvailabilityState } from './availability';
import type { BloodGroup, ContactMethod, Visibility } from './constants';

export interface DonorConsentsView {
  listedInSearch: boolean;
  nameVisibility: Visibility;
  phoneVisibility: Visibility;
  localityVisibility: Visibility;
  donationHistoryVisibility: Visibility;
  communityVisibility: Visibility;
  allowCoordinatorContact: boolean;
  allowContactRequests: boolean;
}

export interface DonorFacts {
  publicId: string;
  userId: string;
  fullName: string;
  bloodGroup: BloodGroup;
  divisionId: number;
  districtId: number;
  upazilaId: number | null;
  locality: string | null;
  preferredContactMethod: ContactMethod;
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
  availability: AvailabilityState;
  availabilityConfirmedAt: Date | null;
  /** Who last set availability: the donor, or staff (an override that must be labelled as such). */
  availabilitySource?: 'donor' | 'staff' | null;
  consents: DonorConsentsView;
  stats?: { verifiedCount: number; reportedCount: number; lastDonation: string | null };
  communities?: { slug: string; name: string }[];
}

export type PhoneAccess = 'hidden' | 'sign_in_required' | 'reveal' | 'owner';

export interface DonorView {
  publicId: string;
  name: string;
  nameIsShortened: boolean;
  bloodGroup: BloodGroup;
  divisionId: number;
  districtId: number;
  upazilaId: number | null;
  locality: string | null;
  localityHidden: boolean;
  preferredContactMethod: ContactMethod;
  verificationStatus: DonorFacts['verificationStatus'];
  availability: AvailabilityState;
  availabilityConfirmedAt: Date | null;
  availabilitySource: 'donor' | 'staff' | null;
  stats: NonNullable<DonorFacts['stats']> | null;
  communities: NonNullable<DonorFacts['communities']> | null;
  phoneAccess: PhoneAccess;
  canSendContactRequest: boolean;
  isOwner: boolean;
}

const NAME_PREFIXES = new Set(['md', 'md.', 'mohammad', 'mohammed', 'muhammad', 'mohd', 'mst', 'mst.', 'mosammat', 'মো', 'মো.', 'মোঃ', 'মোহাম্মদ', 'মুহাম্মদ', 'মোসাম্মৎ', 'মোছা', 'মোছাঃ', 'মোসাঃ']);

const BENGALI_VIRAMA = '\u09CD';

/** First user-perceived letter. A Bengali letter ending in the virama (as in "অ্যা") joins the next one. */
function firstGrapheme(word: string): string {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  let out = '';
  for (const { segment } of segmenter.segment(word)) {
    out += segment;
    if (!segment.endsWith(BENGALI_VIRAMA)) break;
  }
  return out;
}

/** "Md. Rakib Hasan" -> "Rakib H." ; "মোঃ রাকিব হাসান" -> "রাকিব হা." */
export function shortName(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  const meaningful = words.filter((w) => !NAME_PREFIXES.has(w.toLowerCase()));
  const use = meaningful.length ? meaningful : words;
  if (use.length <= 1) return use[0] ?? '';
  return `${use[0]} ${firstGrapheme(use[use.length - 1])}.`;
}

export function projectDonor(donor: DonorFacts, viewer: ViewerLevel): DonorView {
  const isOwner = viewer === 'owner';
  const c = donor.consents;
  const showName = canSee(c.nameVisibility, viewer);
  const showLocality = canSee(c.localityVisibility, viewer);
  let phoneAccess: PhoneAccess = 'hidden';
  if (isOwner) phoneAccess = 'owner';
  else if (c.phoneVisibility !== 'private' && c.phoneVisibility !== 'public') {
    // 'signed_in' numbers can be revealed (logged, rate limited) by signed-in users;
    // 'coordinators' numbers only by coordinator-level viewers.
    if (canSee(c.phoneVisibility, viewer)) phoneAccess = 'reveal';
    else if (viewer === 'anonymous' && c.phoneVisibility === 'signed_in') phoneAccess = 'sign_in_required';
  }
  return {
    publicId: donor.publicId,
    name: showName ? donor.fullName : shortName(donor.fullName),
    nameIsShortened: !showName,
    bloodGroup: donor.bloodGroup,
    divisionId: donor.divisionId,
    districtId: donor.districtId,
    upazilaId: donor.upazilaId,
    locality: showLocality ? donor.locality : null,
    localityHidden: !showLocality && !!donor.locality,
    preferredContactMethod: donor.preferredContactMethod,
    verificationStatus: donor.verificationStatus,
    availability: donor.availability,
    availabilityConfirmedAt: donor.availabilityConfirmedAt,
    availabilitySource: donor.availabilitySource ?? null,
    stats: donor.stats && canSee(c.donationHistoryVisibility, viewer) ? donor.stats : null,
    communities: donor.communities && canSee(c.communityVisibility, viewer) ? donor.communities : null,
    phoneAccess,
    canSendContactRequest: !isOwner && c.allowContactRequests && donor.availability !== 'restricted',
    isOwner,
  };
}
