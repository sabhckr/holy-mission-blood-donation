import type { IntervalConfig } from './eligibility';

export interface AppSettings {
  /** Days a donor's "I am available" confirmation stays valid. */
  availabilityExpiryDays: number;
  /** Minimum days between donations used for the ESTIMATED next date, per donation type. */
  eligibilityIntervals: IntervalConfig;
  /** Hours after the needed time before an unresolved request is marked expired. */
  requestExpiryHours: number;
  /** Days before an unanswered contact request expires. */
  contactRequestExpiryDays: number;
  /** Minimum age to register as a donor (legal consent age, not a medical rule). */
  minimumDonorAge: number;
}

/**
 * Defaults are deliberately conservative. Sources and reasoning: docs/ELIGIBILITY.md.
 * Administrators can change them in Admin → Settings; every change is audit-logged.
 */
export const DEFAULT_SETTINGS: AppSettings = {
  availabilityExpiryDays: 30,
  eligibilityIntervals: {
    whole_blood: 120,
    double_red_cells: 240,
    platelets: 14,
    plasma: 28,
  },
  requestExpiryHours: 48,
  contactRequestExpiryDays: 7,
  minimumDonorAge: 18,
};

export const SETTINGS_LIMITS = {
  availabilityExpiryDays: { min: 7, max: 180 },
  interval: { min: 7, max: 365 },
  requestExpiryHours: { min: 6, max: 24 * 14 },
  contactRequestExpiryDays: { min: 1, max: 30 },
  minimumDonorAge: { min: 18, max: 21 },
} as const;
