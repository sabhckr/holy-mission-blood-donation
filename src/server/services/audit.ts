import { auditLogs } from '../db/schema';
import type { Executor } from '../db/client';
import type { Actor } from '../policy';

export interface AuditEntry {
  actor: Actor | null;
  action: string;
  targetType?: string;
  targetId?: string | null;
  communityId?: string | null;
  /** Non-sensitive context only: ids, field names, enum values. Never phone numbers, passwords or tokens. */
  metadata?: Record<string, unknown>;
  ipHash?: string | null;
}

const FORBIDDEN_KEYS = /phone|password|token|secret|otp/i;

/** Drops keys that look sensitive, so a careless caller cannot leak them into the audit trail. */
export function sanitizeMetadata(metadata: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_KEYS.test(key)) continue;
    if (Array.isArray(value)) out[key] = value.filter((v) => typeof v !== 'string' || !FORBIDDEN_KEYS.test(v));
    else out[key] = value;
  }
  return out;
}

export async function audit(executor: Executor, entry: AuditEntry): Promise<void> {
  await executor.insert(auditLogs).values({
    actorUserId: entry.actor?.userId ?? null,
    actorRole: entry.actor?.role ?? null,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    communityId: entry.communityId ?? null,
    metadata: sanitizeMetadata(entry.metadata),
    ipHash: entry.ipHash ?? null,
  });
}
