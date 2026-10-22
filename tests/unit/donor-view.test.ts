import { describe, expect, it } from 'vitest';
import { projectDonor, shortName, type DonorFacts } from '@/server/domain/donor-view';

const facts = (consents: Partial<DonorFacts['consents']> = {}): DonorFacts => ({
  publicId: 'abcdefgh23',
  userId: 'donor',
  fullName: 'Md. Rakib Hasan',
  bloodGroup: 'O+',
  divisionId: 1,
  districtId: 2,
  upazilaId: 3,
  locality: 'Haydarganj',
  preferredContactMethod: 'call',
  verificationStatus: 'unverified',
  availability: 'available',
  availabilityConfirmedAt: new Date(),
  consents: {
    listedInSearch: true,
    nameVisibility: 'signed_in',
    phoneVisibility: 'signed_in',
    localityVisibility: 'coordinators',
    donationHistoryVisibility: 'private',
    communityVisibility: 'public',
    allowCoordinatorContact: true,
    allowContactRequests: true,
    ...consents,
  },
  stats: { verifiedCount: 2, reportedCount: 3, lastDonation: '2026-01-01' },
  communities: [{ slug: 'c', name: 'C' }],
});

describe('shortName', () => {
  it('skips honorific prefixes and abbreviates the last name', () => {
    expect(shortName('Md. Rakib Hasan')).toBe('Rakib H.');
    expect(shortName('মোঃ রাকিব হাসান')).toBe('রাকিব হা.');
    expect(shortName('Nusrat')).toBe('Nusrat');
  });
});

describe('projectDonor', () => {
  it('shows anonymous visitors only what is public and never a phone number', () => {
    const v = projectDonor(facts(), 'anonymous');
    expect(v.name).toBe('Rakib H.');
    expect(v.nameIsShortened).toBe(true);
    expect(v.locality).toBeNull();
    expect(v.localityHidden).toBe(true);
    expect(v.stats).toBeNull();
    expect(v.communities).toEqual([{ slug: 'c', name: 'C' }]);
    expect(v.phoneAccess).toBe('sign_in_required');
    expect(JSON.stringify(v)).not.toContain('+880');
  });

  it('lets signed-in users reveal a number only when the donor allows signed-in users', () => {
    expect(projectDonor(facts(), 'signed_in').phoneAccess).toBe('reveal');
    expect(projectDonor(facts({ phoneVisibility: 'coordinators' }), 'signed_in').phoneAccess).toBe('hidden');
    expect(projectDonor(facts({ phoneVisibility: 'coordinators' }), 'coordinator').phoneAccess).toBe('reveal');
    expect(projectDonor(facts({ phoneVisibility: 'private' }), 'coordinator').phoneAccess).toBe('hidden');
    expect(projectDonor(facts({ phoneVisibility: 'coordinators' }), 'anonymous').phoneAccess).toBe('hidden');
  });

  it('shows the owner everything', () => {
    const v = projectDonor(facts(), 'owner');
    expect(v.name).toBe('Md. Rakib Hasan');
    expect(v.stats).not.toBeNull();
    expect(v.phoneAccess).toBe('owner');
    expect(v.canSendContactRequest).toBe(false);
  });

  it('blocks contact requests when the donor opted out or is restricted', () => {
    expect(projectDonor(facts({ allowContactRequests: false }), 'signed_in').canSendContactRequest).toBe(false);
    expect(projectDonor({ ...facts(), availability: 'restricted' }, 'signed_in').canSendContactRequest).toBe(false);
  });
});
