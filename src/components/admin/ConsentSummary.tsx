import type { Messages } from '@/i18n/messages';

type Visibility = 'public' | 'signed_in' | 'coordinators' | 'private';

export interface ConsentRow {
  listedInSearch: boolean;
  nameVisibility: Visibility;
  phoneVisibility: Visibility;
  localityVisibility: Visibility;
  donationHistoryVisibility: Visibility;
  communityVisibility: Visibility;
  allowCoordinatorContact: boolean;
  allowContactRequests: boolean;
  consentedAt: Date;
  policyVersion: string;
}

/** Read-only summary of a donor's privacy choices, worded about the donor (not "me"). */
export function ConsentSummary({ consent, t, instantDate }: { consent: ConsentRow; t: Messages; instantDate: (d: Date) => string }) {
  const c = t.admin.consent;
  const vis = c.visibility;
  const yesNo = (v: boolean) => (v ? t.common.states.yes : t.common.states.no);
  return (
    <dl className="dl">
      <dt>{c.listedInSearch}</dt>
      <dd>{yesNo(consent.listedInSearch)}</dd>
      <dt>{c.nameVisibility}</dt>
      <dd>{vis[consent.nameVisibility]}</dd>
      <dt>{c.phoneVisibility}</dt>
      <dd>{vis[consent.phoneVisibility]}</dd>
      <dt>{c.localityVisibility}</dt>
      <dd>{vis[consent.localityVisibility]}</dd>
      <dt>{c.historyVisibility}</dt>
      <dd>{vis[consent.donationHistoryVisibility]}</dd>
      <dt>{c.communityVisibility}</dt>
      <dd>{vis[consent.communityVisibility]}</dd>
      <dt>{c.allowCoordinatorContact}</dt>
      <dd>{yesNo(consent.allowCoordinatorContact)}</dd>
      <dt>{c.allowContactRequests}</dt>
      <dd>{yesNo(consent.allowContactRequests)}</dd>
      <dt>{c.consentAt}</dt>
      <dd>
        {instantDate(consent.consentedAt)} · {consent.policyVersion}
      </dd>
    </dl>
  );
}
