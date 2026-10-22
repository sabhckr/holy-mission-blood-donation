const BANGLA_DIGITS = '০১২৩৪৫৬৭৮৯';

export function toAsciiDigits(value: string): string {
  return value.replace(/[০-৯]/g, (ch) => String(BANGLA_DIGITS.indexOf(ch)));
}

/**
 * Normalise a Bangladeshi mobile number to +8801XXXXXXXXX.
 * Accepts 01XXXXXXXXX, 8801XXXXXXXXX, +8801XXXXXXXXX, spaces/dashes and Bangla digits.
 * Returns null for anything that is not a valid mobile number (operator prefixes 013–019).
 */
export function normalizeBdPhone(input: string): string | null {
  const digits = toAsciiDigits(input).replace(/[\s\-().]/g, '');
  const m = /^(?:\+?88)?(01[3-9]\d{8})$/.exec(digits);
  return m ? `+88${m[1]}` : null;
}

/** +8801712345678 -> 01712-345678 */
export function formatBdPhone(normalized: string): string {
  const local = normalized.replace(/^\+88/, '');
  return `${local.slice(0, 5)}-${local.slice(5)}`;
}

/** +8801712345678 -> 017••••••78 */
export function maskBdPhone(normalized: string): string {
  const local = normalized.replace(/^\+88/, '');
  return `${local.slice(0, 3)}••••••${local.slice(-2)}`;
}
