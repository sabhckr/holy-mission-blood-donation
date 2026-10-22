import type { Metadata } from 'next';
import Link from 'next/link';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { duplicateCandidates } from '@/server/services/admin';
import { getLocationIndex, labelFrom } from '@/server/services/location-index';
import { AdminAction } from '@/components/admin/AdminAction';
import { Badge, EmptyState } from '@/components/ui';
import { reviewDuplicateAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.duplicates.title, robots: { index: false } };
}

export default async function AdminDuplicatesPage() {
  const actor = await requirePermission('/admin/duplicates', 'duplicates.review');
  const { t, instantDate, locale } = await getI18n();
  const [rows, index] = await Promise.all([duplicateCandidates(actor), getLocationIndex()]);
  const d = t.admin.duplicates;
  const pending = t.common.actions.submitting;
  const noteField = { name: 'note', label: t.admin.noteLabel, hint: t.admin.reasonHint };
  return (
    <>
      <header className="stack-sm">
        <h1>{d.title}</h1>
        <p className="muted">{d.intro}</p>
      </header>
      {rows.length === 0 ? (
        <EmptyState title={d.empty} />
      ) : (
        <ul className="list-plain stack">
          {rows.map((row) => (
            <li key={`${row.aId}-${row.bId}`} className="card card-tight stack-sm">
              <div className="cluster-sm">
                <Badge tone="warning">{row.samePhone ? d.samePhone : d.sameName}</Badge>
              </div>
              <div className="grid grid-2">
                {(
                  [
                    [d.profileA, row.aId, row.aName, row.aGroup, row.aDistrict, row.aCreated],
                    [d.profileB, row.bId, row.bName, row.bGroup, row.bDistrict, row.bCreated],
                  ] as const
                ).map(([label, donorId, name, group, district, created]) => (
                  <div key={label} className="stack-sm">
                    <p className="small muted" style={{ margin: 0 }}>
                      {label}
                    </p>
                    <p style={{ margin: 0 }}>
                      <Link href={`/admin/donors/${donorId}`}>{name}</Link> · <strong>{group}</strong>
                    </p>
                    <p className="small" style={{ margin: 0 }}>
                      {labelFrom(index, locale, district)} · {d.registered}: {instantDate(created)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="grid grid-2">
                <AdminAction action={reviewDuplicateAction} hidden={{ donorA: row.aId, donorB: row.bId, decision: 'not_duplicate' }} submit={d.notDuplicate} pending={pending} note={noteField} />
                <div className="stack-sm">
                  <p className="hint">{d.resolvedHint}</p>
                  <AdminAction action={reviewDuplicateAction} hidden={{ donorA: row.aId, donorB: row.bId, decision: 'duplicate_resolved' }} submit={d.resolved} pending={pending} tone="primary" note={noteField} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
