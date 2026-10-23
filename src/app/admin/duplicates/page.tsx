import type { Metadata } from 'next';
import Link from 'next/link';
import { Copy } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { duplicateCandidates } from '@/server/services/admin';
import { getLocationIndex, labelFrom } from '@/server/services/location-index';
import { AdminAction } from '@/components/admin/AdminAction';
import { AdminEmpty, AdminPageHead } from '@/components/admin/AdminUi';
import { ADMIN_ICONS } from '@/components/admin/icons';
import { BloodGroupBadge } from '@/components/ui';
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
      <AdminPageHead icon={ADMIN_ICONS.duplicates} title={d.title} intro={d.intro} />
      {rows.length === 0 ? (
        <AdminEmpty title={d.empty} done />
      ) : (
        <ul className="record-list">
          {rows.map((row) => (
            <li key={`${row.aId}-${row.bId}`}>
              <article className="card card-tight record-card" aria-labelledby={`dup-${row.aId}-${row.bId}`}>
                <div className="record-card-head">
                  <span className="record-card-icon">
                    <Copy size={20} aria-hidden="true" />
                  </span>
                  <div className="record-card-title">
                    <h2 id={`dup-${row.aId}-${row.bId}`}>{row.samePhone ? d.samePhone : d.sameName}</h2>
                  </div>
                </div>
                <div className="pair-compare">
                  {(
                    [
                      [d.profileA, row.aId, row.aName, row.aGroup, row.aDistrict, row.aCreated],
                      [d.profileB, row.bId, row.bName, row.bGroup, row.bDistrict, row.bCreated],
                    ] as const
                  ).map(([label, donorId, name, group, district, created]) => (
                    <div key={label} className="pair-profile">
                      <p className="status-label">{label}</p>
                      <div className="donor-cell">
                        <BloodGroupBadge group={group} small label={t.common.bloodGroup} />
                        <div>
                          <Link href={`/admin/donors/${donorId}`} style={{ fontWeight: 700 }}>
                            {name}
                          </Link>
                          <span className="cell-sub">{labelFrom(index, locale, district)}</span>
                          <span className="cell-sub">
                            {d.registered}: {instantDate(created)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="action-row">
                  <AdminAction action={reviewDuplicateAction} hidden={{ donorA: row.aId, donorB: row.bId, decision: 'not_duplicate' }} submit={d.notDuplicate} pending={pending} size="md" note={noteField} />
                  <div className="stack-sm">
                    <p className="hint">{d.resolvedHint}</p>
                    <AdminAction action={reviewDuplicateAction} hidden={{ donorA: row.aId, donorB: row.bId, decision: 'duplicate_resolved' }} submit={d.resolved} pending={pending} tone="primary" size="md" note={noteField} />
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
