import { cache } from 'react';
import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages';
import { listOperatingAreas } from '@/server/services/operating-areas';

/** One database read per request, shared by the footer and the home page. */
const activeAreas = cache(() => listOperatingAreas({ activeOnly: true }));

export interface OperatingAreaSummary {
  /** The full public sentence, e.g. "লক্ষ্মীপুর ব্লাড ডোনেশন শুধু লক্ষ্মীপুর জেলায় কাজ করে। …" */
  sentence: string;
  /** Optional public notes an administrator added to an area. */
  notes: string[];
  count: number;
}

/**
 * Lakshmipur Blood Donation's own official operating area(s), straight from the database. This is never
 * where donors or organisations may come from. The public sentence is the fixed Lakshmipur-only policy.
 */
export async function operatingAreaSummary(locale: Locale, t: Messages): Promise<OperatingAreaSummary> {
  const areas = await activeAreas();
  void locale;
  return {
    sentence: t.common.operatingArea.notice,
    notes: areas.flatMap((a) => (a.publicNote ? [a.publicNote] : [])),
    count: areas.length,
  };
}
