import { describe, expect, it } from 'vitest';
import { availabilityExpiry, availabilityState } from '@/server/domain/availability';

const now = new Date('2026-10-22T06:00:00Z');
const base = { accountStatus: 'active' as const, profileStatus: 'active' as const };

describe('availability state', () => {
  it('is available only while a recent confirmation has not expired', () => {
    expect(availabilityState({ ...base, availabilityStatus: 'available', availabilityExpiresAt: new Date('2026-10-23T00:00:00Z') }, now)).toBe('available');
    expect(availabilityState({ ...base, availabilityStatus: 'available', availabilityExpiresAt: new Date('2026-10-22T05:59:59Z') }, now)).toBe('unknown');
    expect(availabilityState({ ...base, availabilityStatus: 'available', availabilityExpiresAt: now }, now)).toBe('unknown');
  });

  it('needs confirmation when the donor never said anything', () => {
    expect(availabilityState({ ...base, availabilityStatus: null, availabilityExpiresAt: null }, now)).toBe('unknown');
  });

  it('respects an explicit "not available"', () => {
    expect(availabilityState({ ...base, availabilityStatus: 'unavailable', availabilityExpiresAt: null }, now)).toBe('unavailable');
  });

  it('treats paused listings as unavailable and restricted/suspended accounts as restricted', () => {
    const avail = { availabilityStatus: 'available' as const, availabilityExpiresAt: new Date('2030-01-01') };
    expect(availabilityState({ ...avail, accountStatus: 'active', profileStatus: 'paused' }, now)).toBe('unavailable');
    expect(availabilityState({ ...avail, accountStatus: 'active', profileStatus: 'restricted' }, now)).toBe('restricted');
    expect(availabilityState({ ...avail, accountStatus: 'suspended', profileStatus: 'active' }, now)).toBe('restricted');
    expect(availabilityState({ ...avail, accountStatus: 'deactivated', profileStatus: 'active' }, now)).toBe('restricted');
  });

  it('computes expiry from the configured number of days', () => {
    expect(availabilityExpiry(now, 30).toISOString()).toBe('2026-11-21T06:00:00.000Z');
  });
});
