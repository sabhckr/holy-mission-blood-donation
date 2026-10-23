import type { Messages } from '@/i18n/messages';

/**
 * Plain strings for the browser-side checks in <ActionForm clientMessages={…}>. They are the same
 * translated messages the server returns, so a visitor sees identical wording with or without
 * JavaScript. Pick them on the server with clientValidationMessages(t); never pass `t` itself.
 */
export interface ClientValidationMessages {
  /** Shown above the form, like the server's errors.validation. */
  summary: string;
  required: string;
  mustAccept: string;
  invalidPhone: string;
  passwordMismatch: string;
  invalidLocation: string;
  invalidBloodGroup: string;
  /** Date fields with min/max (e.g. the 15-day booking window). */
  pastDate?: string;
  tooFarAhead?: string;
  /** Visible word shown beside the "*" of required fields (e.g. "আবশ্যক"). */
  requiredMark?: string;
}

/** Keys a field may name (data-required-key) to show a more specific "missing" message. */
export type RequiredMessageKey = 'required' | 'mustAccept' | 'invalidLocation' | 'invalidBloodGroup';

export function clientValidationMessages(t: Messages): ClientValidationMessages {
  const v = t.validation;
  return {
    summary: t.errors.validation,
    required: v.required,
    mustAccept: v.mustAccept,
    invalidPhone: v.invalidPhone,
    passwordMismatch: v.passwordMismatch,
    invalidLocation: v.invalidLocation,
    invalidBloodGroup: v.invalidBloodGroup,
    pastDate: v.pastDate,
    tooFarAhead: v.tooFarAhead,
    requiredMark: t.common.states.required,
  };
}
