import { cache } from 'react';
import type { Locale } from '@/i18n/config';
import { placeList } from '@/i18n/format';
import type { Messages } from '@/i18n/messages';
import { listOperatingAreas } from '@/server/services/operating-areas';

/** One database read per request, shared by the footer and the home page. */
const activeAreas = cache(() => listOperatingAreas({ activeOnly: true }));

export interface OperatingAreaSummary {
  /** The full public sentence, e.g. "হলি মিশন ব্লাড ডোনেশনের বর্তমান কার্যক্রম লক্ষ্মীপুরে। …" */
  sentence: string;
  /** Optional public notes an administrator added to an area. */
  notes: string[];
  count: number;
}

/**
 * Holy Mission's own official operating area(s), straight from the database. This is never
 * where donors or organisations may come from — that is all of Bangladesh.
 */
export async function operatingAreaSummary(locale: Locale, t: Messages): Promise<OperatingAreaSummary> {
  const oa = t.common.operatingArea;
  const areas = await activeAreas();
  const names = areas.map((a) => {
    const name = locale === 'en' ? a.nameEn : a.nameBn;
    const parent = locale === 'en' ? a.parentNameEn : a.parentNameBn;
    if (a.level === 'upazila' && parent) return oa.upazilaName(name, parent);
    if (a.level === 'division') return oa.divisionName(name);
    return name;
  });
  return {
    sentence: names.length ? oa.notice(placeList(locale, names, oa.and)) : oa.none,
    notes: areas.flatMap((a) => (a.publicNote ? [a.publicNote] : [])),
    count: names.length,
  };
}
