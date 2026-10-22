import type { Messages } from '@/i18n/messages';
import { COMMUNITY_KINDS } from '@/server/domain/constants';
import { formatBdPhone } from '@/server/domain/phone';
import type { CompactLocation } from '../form/LocationPicker';
import { CheckboxField, RadioGroup, SelectField, TextArea, TextField } from '../form/fields';
import { CommunityAreaFields, type CommunityAreaLabels } from './CommunityAreaFields';

export interface CommunityFormDefaults {
  name?: string;
  nameEn?: string | null;
  kind?: string;
  description?: string | null;
  foundedYear?: number | null;
  divisionId?: number | null;
  districtId?: number | null;
  serviceAreaIds?: number[];
  publicPhone?: string | null;
  publicEmail?: string | null;
  facebookUrl?: string | null;
  showPublicContact?: boolean;
  coordinatorContactPreference?: string;
  representativeName?: string | null;
  representativeRole?: string | null;
  representativePhone?: string | null;
  verificationInfo?: string | null;
}

function areaLabels(t: Messages): CommunityAreaLabels {
  const c = t.community;
  return {
    hqDivision: c.hqDivision,
    hqDistrict: c.hqDistrict,
    chooseDivision: t.common.location.chooseDivision,
    chooseDistrict: t.common.location.chooseDistrict,
    serviceAreasLegend: c.serviceAreasLegend,
    serviceAreasHint: c.serviceAreasHint,
    wholeDistrict: c.wholeDistrict,
    upazilasOf: c.upazilasOf,
    otherAreas: c.otherAreas,
    addDistrict: c.addDistrict,
    addButton: c.addButton,
    removeArea: c.removeArea,
    chooseHqFirst: c.chooseHqFirst,
    noAreasSelected: c.noAreasSelected,
  };
}

/** Fields shared by "add a community" and the community settings page. */
export function CommunityFormFields({ t, locations, defaults }: { t: Messages; locations: CompactLocation[]; defaults?: CommunityFormDefaults }) {
  const c = t.community;
  const opt = t.common.states.optional;
  return (
    <>
      <fieldset className="form-section">
        <legend>{c.sectionBasics}</legend>
        <TextField name="name" label={c.name} hint={c.nameHint} required maxLength={120} defaultValue={defaults?.name} />
        <TextField name="nameEn" label={c.nameEn} hint={c.nameEnHint} optionalLabel={opt} maxLength={120} defaultValue={defaults?.nameEn} />
        <SelectField
          name="kind"
          label={c.kindLabel}
          required
          options={COMMUNITY_KINDS.map((k) => ({ value: k, label: t.common.communityKind[k] }))}
          defaultValue={defaults?.kind ?? 'volunteer_group'}
        />
        <TextArea name="description" label={c.description} hint={c.descriptionHint} optionalLabel={opt} maxLength={1000} rows={4} defaultValue={defaults?.description} />
        <TextField
          name="foundedYear"
          label={c.foundedYear}
          hint={c.foundedYearHint}
          optionalLabel={opt}
          inputMode="numeric"
          maxLength={4}
          defaultValue={defaults?.foundedYear ? String(defaults.foundedYear) : ''}
        />
      </fieldset>

      <fieldset className="form-section">
        <legend>{c.sectionArea}</legend>
        <CommunityAreaFields
          locations={locations}
          labels={areaLabels(t)}
          defaults={{ divisionId: defaults?.divisionId, districtId: defaults?.districtId, serviceAreaIds: defaults?.serviceAreaIds }}
        />
      </fieldset>

      <fieldset className="form-section">
        <legend>{c.sectionContact}</legend>
        <p className="hint">{c.phoneIfNeeded}</p>
        <TextField
          name="publicPhone"
          type="tel"
          inputMode="tel"
          label={c.publicPhoneLabel}
          hint={c.publicPhoneHint}
          optionalLabel={opt}
          maxLength={20}
          defaultValue={defaults?.publicPhone ? formatBdPhone(defaults.publicPhone) : ''}
        />
        <TextField name="publicEmail" type="email" label={c.publicEmailLabel} optionalLabel={opt} maxLength={200} defaultValue={defaults?.publicEmail} />
        <TextField name="facebookUrl" type="url" inputMode="url" label={c.facebookUrl} hint={c.facebookHint} optionalLabel={opt} maxLength={300} defaultValue={defaults?.facebookUrl} />
        <CheckboxField name="showPublicContact" label={c.showPublicContact} hint={c.showPublicContactHint} defaultChecked={defaults?.showPublicContact ?? false} />
        <RadioGroup
          name="coordinatorContactPreference"
          legend={c.contactPreference}
          defaultValue={defaults?.coordinatorContactPreference ?? 'in_app'}
          options={[
            { value: 'in_app', label: c.prefInApp },
            { value: 'phone', label: c.prefPhone },
            { value: 'both', label: c.prefBoth },
          ]}
        />
      </fieldset>

      <fieldset className="form-section">
        <legend>{c.sectionRepresentative}</legend>
        <p className="hint">{c.representativeIntro}</p>
        <TextField name="representativeName" label={c.representativeName} required maxLength={120} autoComplete="name" defaultValue={defaults?.representativeName} />
        <TextField name="representativeRole" label={c.representativeRole} hint={c.representativeRoleHint} optionalLabel={opt} maxLength={80} defaultValue={defaults?.representativeRole} />
        <TextField
          name="representativePhone"
          type="tel"
          inputMode="tel"
          label={c.representativePhone}
          hint={c.representativePhoneHint}
          required
          maxLength={20}
          autoComplete="tel"
          defaultValue={defaults?.representativePhone ? formatBdPhone(defaults.representativePhone) : ''}
        />
        <TextArea name="verificationInfo" label={c.verificationInfo} hint={c.verificationInfoHint} optionalLabel={opt} maxLength={1000} rows={3} defaultValue={defaults?.verificationInfo} />
      </fieldset>
    </>
  );
}
