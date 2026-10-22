import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/client';
import { reports, users } from '../db/schema';
import { PAGE_SIZE, type ReportReason, type ReportTarget } from '../domain/constants';
import { AppError, forbidden, notFound } from '../errors';
import { can, type Actor } from '../policy';
import type { ClientMeta } from './accounts';
import { audit } from './audit';

/** Anyone (signed in or not) can report wrong information or misuse. Rate limited by the caller. */
export async function createReport(actor: Actor | null, input: { targetType: ReportTarget; targetId: string; reason: ReportReason; details: string | null }, meta: ClientMeta = {}) {
  if (!/^[a-z0-9-]{6,40}$/i.test(input.targetId)) throw notFound();
  const [row] = await db
    .insert(reports)
    .values({ ...input, reporterUserId: actor?.userId ?? null })
    .returning({ id: reports.id });
  await audit(db, { actor, action: 'report.created', targetType: input.targetType, targetId: input.targetId, metadata: { reason: input.reason, reportId: row.id }, ipHash: meta.ipHash });
  return row;
}

export async function listReports(actor: Actor, filters: { status?: 'open' | 'reviewing' | 'resolved' | 'dismissed' | null; page?: number }) {
  if (!can(actor, 'reports.handle')) throw forbidden();
  const conds: SQL[] = [];
  if (filters.status) conds.push(eq(reports.status, filters.status));
  const where = conds.length ? and(...conds) : undefined;
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(reports).where(where);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);
  const items = await db
    .select({ report: reports, reporterName: users.displayName })
    .from(reports)
    .leftJoin(users, eq(users.id, reports.reporterUserId))
    .where(where)
    .orderBy(desc(reports.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);
  return { items, total, page, pageCount };
}

export async function handleReport(actor: Actor, reportId: string, status: 'reviewing' | 'resolved' | 'dismissed', note: string | null, meta: ClientMeta = {}) {
  if (!can(actor, 'reports.handle')) throw forbidden();
  return db.transaction(async (tx) => {
    const [report] = await tx.select().from(reports).where(eq(reports.id, reportId)).for('update');
    if (!report) throw notFound();
    if (report.status === 'resolved' || report.status === 'dismissed') throw new AppError('invalid_state');
    await tx.update(reports).set({ status, resolutionNote: note, handledByUserId: actor.userId, handledAt: new Date() }).where(eq(reports.id, reportId));
    await audit(tx, { actor, action: `report.${status}`, targetType: 'report', targetId: reportId, ipHash: meta.ipHash });
  });
}
