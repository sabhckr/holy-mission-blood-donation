import { NextResponse } from 'next/server';
import { getActor } from '@/server/auth/current';
import { can } from '@/server/policy';
import { hitRateLimit } from '@/server/security/rate-limit';
import { getRequestMeta } from '@/server/security/request-meta';
import { isSameOrigin } from '@/server/security/origin';
import { exportData, type ExportKind } from '@/server/services/admin';

const KINDS: ExportKind[] = ['donors_by_area', 'requests_summary', 'donor_directory'];

/** CSV export: same-origin POST, staff with the data.export permission, rate limited, password re-check and audit log (in exportData). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new NextResponse(null, { status: 403 });
  const actor = await getActor();
  if (!actor || !can(actor, 'data.export')) return new NextResponse(null, { status: 404 });
  const back = NextResponse.redirect(new URL('/admin/export?error=1', request.url), 303);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return back;
  }
  const kind = String(form.get('kind') ?? '') as ExportKind;
  const password = String(form.get('password') ?? '');
  if (!KINDS.includes(kind) || !password || password.length > 128) return back;
  if (!(await hitRateLimit('export', actor.userId)).ok) return back;
  try {
    const result = await exportData(actor, kind, password, await getRequestMeta());
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(`﻿${result.csv}`, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${date}-${result.filename}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return back;
  }
}
