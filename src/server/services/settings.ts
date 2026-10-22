import { z } from 'zod';
import { inArray } from 'drizzle-orm';
import { db, type Executor } from '../db/client';
import { settings } from '../db/schema';
import { DEFAULT_SETTINGS, SETTINGS_LIMITS, type AppSettings } from '../domain/settings-defaults';
import type { Actor } from '../policy';
import { isAdmin } from '../policy';
import { AppError, forbidden } from '../errors';
import { audit } from './audit';

const intervalDays = z.number().int().min(SETTINGS_LIMITS.interval.min).max(SETTINGS_LIMITS.interval.max);

export const settingsSchema = z.object({
  availabilityExpiryDays: z.number().int().min(SETTINGS_LIMITS.availabilityExpiryDays.min).max(SETTINGS_LIMITS.availabilityExpiryDays.max),
  eligibilityIntervals: z.object({
    whole_blood: intervalDays,
    double_red_cells: intervalDays,
    platelets: intervalDays,
    plasma: intervalDays,
  }),
  requestExpiryHours: z.number().int().min(SETTINGS_LIMITS.requestExpiryHours.min).max(SETTINGS_LIMITS.requestExpiryHours.max),
  contactRequestExpiryDays: z.number().int().min(SETTINGS_LIMITS.contactRequestExpiryDays.min).max(SETTINGS_LIMITS.contactRequestExpiryDays.max),
  minimumDonorAge: z.number().int().min(SETTINGS_LIMITS.minimumDonorAge.min).max(SETTINGS_LIMITS.minimumDonorAge.max),
});

const KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[];

/** Current settings: stored values validated individually, falling back to defaults. */
export async function getSettings(executor: Executor = db): Promise<AppSettings> {
  const rows = await executor.select().from(settings).where(inArray(settings.key, KEYS));
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    const field = settingsSchema.shape[row.key as keyof AppSettings];
    const parsed = field?.safeParse(row.value);
    if (parsed?.success) merged[row.key] = parsed.data;
  }
  return merged as unknown as AppSettings;
}

export async function updateSettings(actor: Actor, next: AppSettings, ipHash?: string | null): Promise<AppSettings> {
  if (!isAdmin(actor)) throw forbidden();
  const parsed = settingsSchema.safeParse(next);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join('.')] = 'outOfRange';
    throw new AppError('validation', 'validation', fieldErrors);
  }
  return db.transaction(async (tx) => {
    const before = await getSettings(tx);
    const changed: string[] = [];
    for (const key of KEYS) {
      const value = parsed.data[key];
      if (JSON.stringify(value) === JSON.stringify(before[key])) continue;
      changed.push(key);
      await tx
        .insert(settings)
        .values({ key, value, updatedByUserId: actor.userId })
        .onConflictDoUpdate({ target: settings.key, set: { value, updatedByUserId: actor.userId, updatedAt: new Date() } });
    }
    if (changed.length) {
      await audit(tx, {
        actor,
        action: 'settings.updated',
        targetType: 'settings',
        metadata: { changed, before: Object.fromEntries(changed.map((k) => [k, before[k as keyof AppSettings]])), after: Object.fromEntries(changed.map((k) => [k, parsed.data[k as keyof AppSettings]])) },
        ipHash,
      });
    }
    return parsed.data;
  });
}
