import type { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink, KeyRound } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { getActor } from '@/server/auth/current';
import { getLocationIndex, labelFrom } from '@/server/services/location-index';
import { publicIdForManageToken } from '@/server/services/request-queries';
import { getRequestForViewer } from '@/server/services/requests';
import { ManagePanel } from '@/components/request/ManagePanel';
import { RequestSummary } from '@/components/request/RequestSummary';
import { Alert, BloodGroupBadge, Disclaimer, PageHeader } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.request.tokenTitle, robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

/** Private management page reached through the link given to the requester when the request was created. */
export default async function ManageByTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const i18n = await getI18n();
  const { t, locale } = i18n;
  const publicId = await publicIdForManageToken(token);
  const view = publicId ? await getRequestForViewer(publicId, await getActor(), token) : null;
  if (!view || !view.access.isRequester) {
    return (
      <>
        <PageHeader title={t.request.tokenTitle} />
        <div className="section pub-body">
          <div className="container container-narrow stack">
            <Alert tone="error">{t.request.tokenInvalid}</Alert>
            <Link className="btn" href="/requests">
              {t.request.boardTitle}
            </Link>
          </div>
        </div>
      </>
    );
  }
  const index = await getLocationIndex();
  const r = view.request;
  return (
    <>
      <PageHeader title={t.request.detailTitle(r.bloodGroup)}>
        <BloodGroupBadge group={r.bloodGroup} label={t.common.bloodGroup} />
      </PageHeader>
      <div className="section pub-body">
        <div className="container detail-layout">
          <div className="detail-wide">
            <div className="card card-tight keep-private next-note">
              <span className="pub-icon">
                <KeyRound size={20} aria-hidden="true" />
              </span>
              <div>
                <h2>{t.request.keepPrivateTitle}</h2>
                <p>{t.request.tokenKeepPrivate}</p>
              </div>
            </div>
          </div>
          <div className="stack">
            <RequestSummary view={view} place={labelFrom(index, locale, r.upazilaId, r.districtId, r.divisionId)} i18n={i18n} />
            {r.showOnPublicBoard && (
              <Link className="btn btn-ghost" href={`/requests/${r.publicId}`}>
                <ExternalLink size={18} aria-hidden="true" />
                {t.request.publicPageLink}
              </Link>
            )}
          </div>
          <ManagePanel view={view} i18n={i18n} token={token} />
          <div className="detail-wide">
            <Disclaimer t={t} compact />
          </div>
        </div>
      </div>
    </>
  );
}
