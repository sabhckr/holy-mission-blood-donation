import type { Metadata } from 'next';
import { Download, FileSpreadsheet, KeyRound, ShieldCheck } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { AdminPageHead } from '@/components/admin/AdminUi';
import { ADMIN_ICONS } from '@/components/admin/icons';
import { Alert } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.export.title, robots: { index: false } };
}

const KINDS = ['donors_by_area', 'requests_summary', 'donor_directory'] as const;

/** A plain POST form (no JavaScript needed); the route handler streams the CSV download. */
export default async function AdminExportPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requirePermission('/admin/export', 'data.export');
  const { t } = await getI18n();
  const e = t.admin.export;
  const failed = (await searchParams).error === '1';
  return (
    <>
      <AdminPageHead icon={ADMIN_ICONS.export} title={e.title} intro={e.intro} />
      {failed && (
        <Alert tone="error" live>
          {e.error}
        </Alert>
      )}
      <form method="post" action="/admin/export/download" className="form">
        <fieldset className="form-section">
          <legend>
            <span className="legend-row">
              <FileSpreadsheet size={20} aria-hidden="true" />
              {e.kind}
            </span>
          </legend>
          <div className="option-list">
            {KINDS.map((kind, i) => (
              <label key={kind} className="option-card">
                <input type="radio" name="kind" value={kind} defaultChecked={i === 0} />
                <span>{e.kinds[kind]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="form-section">
          <legend>
            <span className="legend-row">
              <KeyRound size={20} aria-hidden="true" />
              {e.confirmTitle}
            </span>
          </legend>
          <div className="field">
            <label className="label" htmlFor="export-password">
              {t.admin.yourPassword}
              <span className="req" aria-hidden="true">
                *
              </span>
            </label>
            <p className="hint" id="export-password-hint">
              {t.admin.yourPasswordHint}
            </p>
            <input id="export-password" className="input" type="password" name="password" required autoComplete="current-password" maxLength={128} aria-describedby="export-password-hint" />
          </div>
          <p className="logged-note">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>{e.handleNote}</span>
          </p>
        </fieldset>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary btn-lg">
            <Download size={20} aria-hidden="true" />
            {e.download}
          </button>
        </div>
      </form>
    </>
  );
}
