import type { Metadata } from 'next';
import { getI18n } from '@/i18n/server';
import { requireAdmin } from '@/server/auth/current';
import { Alert } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.export.title, robots: { index: false } };
}

const KINDS = ['donors_by_area', 'requests_summary', 'donor_directory'] as const;

/** A plain POST form (no JavaScript needed); the route handler streams the CSV download. */
export default async function AdminExportPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin('/admin/export');
  const { t } = await getI18n();
  const e = t.admin.export;
  const failed = (await searchParams).error === '1';
  return (
    <>
      <header className="stack-sm">
        <h1>{e.title}</h1>
        <p className="muted">{e.intro}</p>
      </header>
      {failed && (
        <Alert tone="error" live>
          {e.error}
        </Alert>
      )}
      <form method="post" action="/admin/export/download" className="card form">
        <fieldset className="choice-group">
          <legend>{e.kind}</legend>
          {KINDS.map((kind, i) => (
            <label key={kind} className="check">
              <input type="radio" name="kind" value={kind} defaultChecked={i === 0} />
              <span>{e.kinds[kind]}</span>
            </label>
          ))}
        </fieldset>
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
        <p className="small muted">{e.handleNote}</p>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            {e.download}
          </button>
        </div>
      </form>
    </>
  );
}
