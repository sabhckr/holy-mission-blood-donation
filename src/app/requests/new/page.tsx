import type { Metadata } from 'next';
import { z } from 'zod';
import { getI18n } from '@/i18n/server';
import { getActor } from '@/server/auth/current';
import { BLOOD_GROUPS, REQUEST_CONTACT_PREFERENCES, URGENCIES } from '@/server/domain/constants';
import { APP_TIME_ZONE, todayInBangladesh } from '@/server/domain/dates';
import { compactLocations, getLocationIndex, labelFrom } from '@/server/services/location-index';
import { approvedCommunityById, approvedCommunityOptions, ownContact } from '@/server/services/request-queries';
import { createRequestAction } from '../actions';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { CheckboxField, RadioGroup, SelectField, TextArea, TextField } from '@/components/form/fields';
import { LocationPicker } from '@/components/form/LocationPicker';
import { locationLabels } from '@/components/consent-labels';
import { CreatedPanel, HideOnSuccess } from '@/components/request/CreatedPanel';
import { RequestAdvice } from '@/components/request/RequestAdvice';
import { Alert, Disclaimer, PageHeader } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.request.newTitle, description: t.request.newIntro };
}

const id = z.coerce.number().int().positive().optional().catch(undefined);
const prefillSchema = z.object({
  group: z.enum(BLOOD_GROUPS).optional().catch(undefined),
  division: id,
  district: id,
  upazila: id,
  community: z.string().max(40).optional().catch(undefined),
});

/** A sensible default "needed by": the next full hour, Bangladesh time. */
function defaultNeeded() {
  const at = new Date(Date.now() + 3600 * 1000);
  const hour = new Intl.DateTimeFormat('en-GB', { timeZone: APP_TIME_ZONE, hour: '2-digit', hourCycle: 'h23' }).format(at);
  return { date: todayInBangladesh(at), time: `${hour.padStart(2, '0')}:00` };
}

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, locale } = await getI18n();
  const sp = await searchParams;
  const prefill = prefillSchema.parse(Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const actor = await getActor();
  const [locs, index, contact, preselected, options] = await Promise.all([
    compactLocations(locale),
    getLocationIndex(),
    actor ? ownContact(actor.userId) : Promise.resolve(null),
    prefill.community ? approvedCommunityById(prefill.community) : Promise.resolve(null),
    approvedCommunityOptions(),
  ]);
  const needed = defaultNeeded();
  const opt = t.common.states.optional;
  const communityName = (c: { name: string; nameEn: string | null }) => (locale === 'en' && c.nameEn ? c.nameEn : c.name);
  // Keep the division consistent with a prefilled district.
  const divisionId = prefill.division ?? (prefill.district ? (index.byId.get(prefill.district)?.parentId ?? undefined) : undefined);

  return (
    <>
      <PageHeader title={t.request.newTitle} intro={t.request.newIntro} crumbs={[{ href: '/requests', label: t.request.boardTitle }]} />
      <div className="container container-narrow section stack">
        <RequestAdvice t={t} />
        <Disclaimer t={t} compact />
        <ActionForm action={createRequestAction} aria-label={t.request.newTitle}>
          <CreatedPanel
            labels={{
              title: t.request.createdTitle,
              body: t.request.createdBody,
              linkLabel: t.request.manageLinkLabel,
              copy: t.request.copyLink,
              copied: t.request.copied,
              view: t.request.viewRequest,
              searchDonors: t.request.searchDonorsNow,
              signedInNote: t.request.signedInManageNote,
            }}
          />
          <HideOnSuccess>
            <fieldset className="form-section">
              <legend>{t.request.sectionNeed}</legend>
              <RadioGroup name="bloodGroup" legend={t.request.bloodGroup} tiles options={BLOOD_GROUPS.map((g) => ({ value: g, label: g }))} defaultValue={prefill.group} />
              <TextField name="units" type="number" inputMode="numeric" label={t.request.unitsLabel} hint={t.request.unitsHint} required min={1} max={20} defaultValue="1" />
              <RadioGroup name="urgency" legend={t.request.urgencyLabel} options={URGENCIES.map((u) => ({ value: u, label: t.common.urgency[u] }))} />
            </fieldset>

            <fieldset className="form-section">
              <legend>{t.request.sectionPlace}</legend>
              <LocationPicker locations={locs} labels={locationLabels(t)} defaults={{ divisionId, districtId: prefill.district, upazilaId: prefill.upazila }} />
              <TextField name="hospitalName" label={t.request.hospitalLabel} hint={t.request.hospitalHint} required maxLength={120} />
              <div className="field-row">
                <TextField name="neededDate" type="date" label={t.request.neededDate} required min={todayInBangladesh()} defaultValue={needed.date} />
                <TextField name="neededTime" type="time" label={t.request.neededTime} hint={t.request.neededTimeHint} required defaultValue={needed.time} />
              </div>
            </fieldset>

            <fieldset className="form-section">
              <legend>{t.request.sectionContact}</legend>
              <TextField name="requesterName" label={t.request.requesterName} autoComplete="name" required maxLength={80} defaultValue={contact?.displayName} />
              <TextField
                name="requesterPhone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                label={t.request.requesterPhone}
                hint={t.request.requesterPhoneHint}
                required
                maxLength={20}
                defaultValue={contact?.phone.startsWith('+88') ? contact.phone.replace(/^\+88/, '') : undefined}
              />
              <SelectField
                name="contactPreference"
                label={t.request.contactPreference}
                options={REQUEST_CONTACT_PREFERENCES.map((c) => ({ value: c, label: t.common.contactMethod[c] }))}
                defaultValue="call"
                required
              />
              <CheckboxField name="sharePhoneWithResponders" label={t.request.shareWithResponders} hint={t.request.shareWithRespondersHint} />
              <TextArea name="note" label={t.request.note} hint={t.request.noteHint} optionalLabel={opt} maxLength={300} rows={2} />
            </fieldset>

            <fieldset className="form-section">
              <legend>{t.request.sectionVisibility}</legend>
              <CheckboxField name="showOnPublicBoard" label={t.request.showOnBoard} hint={t.request.showOnBoardHint} defaultChecked />
              {preselected ? (
                <>
                  <input type="hidden" name="communityId" value={preselected.id} />
                  <Alert tone="info">{t.request.communityPreselected(communityName(preselected))}</Alert>
                </>
              ) : (
                options.length > 0 && (
                  <SelectField
                    name="communityId"
                    label={t.request.community}
                    hint={t.request.communityHint}
                    optionalLabel={opt}
                    placeholder={t.request.communityNone}
                    options={options.map((c) => ({ value: c.id, label: `${communityName(c)} — ${labelFrom(index, locale, c.districtId)}` }))}
                  />
                )
              )}
              <CheckboxField name="confirmGenuine" required label={t.request.confirmGenuine} />
            </fieldset>

            <SubmitButton label={t.request.submit} pendingLabel={t.request.submitting} className="btn btn-primary btn-lg btn-block" />
          </HideOnSuccess>
        </ActionForm>
      </div>
    </>
  );
}
