import type { CompactLocation } from '@/components/form/LocationPicker';
import type { Locale } from '@/i18n/config';
import { listActiveLocations, type LocationNode } from './locations';
import { getServiceArea } from './service-area';

const TTL_MS = 5 * 60 * 1000;
let cached: { at: number; nodes: LocationNode[]; byId: Map<number, LocationNode> } | null = null;

/** All active locations, cached in memory for five minutes (cleared when an admin edits locations). */
export async function getLocationIndex() {
  if (!cached || Date.now() - cached.at > TTL_MS) {
    const nodes = await listActiveLocations();
    cached = { at: Date.now(), nodes, byId: new Map(nodes.map((n) => [n.id, n])) };
  }
  return cached;
}

export function invalidateLocationIndex(): void {
  cached = null;
}

const LEVEL = { division: 0, district: 1, upazila: 2 } as const;

/**
 * Locations offered in pickers: Lakshmipur district (with its division) and its upazilas only.
 * With a single division and district the picker fixes both and asks only for the upazila.
 */
export async function compactLocations(locale: Locale): Promise<CompactLocation[]> {
  const [{ nodes }, area] = await Promise.all([getLocationIndex(), getServiceArea()]);
  const allowed = new Set([area.divisionId, area.districtId, ...area.upazilas.map((u) => u.id)]);
  const collator = new Intl.Collator(locale === 'bn' ? 'bn' : 'en');
  return nodes
    .filter((n) => allowed.has(n.id))
    .map((n): CompactLocation => [n.id, n.parentId ?? 0, locale === 'bn' ? n.nameBn : n.nameEn, LEVEL[n.level]])
    .sort((a, b) => a[3] - b[3] || collator.compare(a[2], b[2]));
}

/** "Upazila, District" style label for display. Missing ids are skipped. */
export async function placeLabel(locale: Locale, ...ids: (number | null | undefined)[]): Promise<string> {
  const { byId } = await getLocationIndex();
  return ids
    .filter((id): id is number => typeof id === 'number')
    .map((id) => byId.get(id))
    .filter((n): n is LocationNode => !!n)
    .map((n) => (locale === 'bn' ? n.nameBn : n.nameEn))
    .join(', ');
}

/** Synchronous label lookup once the index is loaded (for lists). */
export function labelFrom(index: Awaited<ReturnType<typeof getLocationIndex>>, locale: Locale, ...ids: (number | null | undefined)[]): string {
  return ids
    .filter((id): id is number => typeof id === 'number')
    .map((id) => index.byId.get(id))
    .filter((n): n is LocationNode => !!n)
    .map((n) => (locale === 'bn' ? n.nameBn : n.nameEn))
    .join(', ');
}
