'use client';

import { Eye, MessageCircle } from 'lucide-react';
import { CheckboxField, RadioGroup, SelectField, TextField, type Option } from './form/fields';
import { LocationPicker, type CompactLocation, type LocationLabels } from './form/LocationPicker';

export interface ConsentLabels {
  listedInSearch: string;
  listedInSearchHint: string;
  nameVisibility: string;
  nameVisibilityHint: string;
  phoneVisibility: string;
  phoneVisibilityHint: string;
  localityVisibility: string;
  historyVisibility: string;
  communityVisibility: string;
  allowCoordinatorContact: string;
  allowContactRequests: string;
  visibility: Record<'public' | 'signed_in' | 'coordinators' | 'private', string>;
  /** Sub-headings for the grouped layout. */
  whoCanSee?: string;
  contactPermissions?: string;
  /** Summary of the collapsible part in the simple layout. */
  more?: string;
}

export interface ConsentDefaults {
  listedInSearch: boolean;
  nameVisibility: string;
  phoneVisibility: string;
  localityVisibility: string;
  donationHistoryVisibility: string;
  communityVisibility: string;
  allowCoordinatorContact: boolean;
  allowContactRequests: boolean;
}

/**
 * The per-category consent controls, shared by registration and the privacy page.
 * `grouped` (registration) shows "list me" as a big toggle, then the "who can see" choices side by
 * side and the contact permissions under their own sub-headings. Field names and labels are the same.
 */
export function ConsentFields({ labels, defaults, layout = 'list' }: { labels: ConsentLabels; defaults: ConsentDefaults; layout?: 'list' | 'grouped' | 'simple' }) {
  const all: Option[] = (['public', 'signed_in', 'coordinators', 'private'] as const).map((v) => ({ value: v, label: labels.visibility[v] }));
  // Phone: "everyone" means anyone can tap "show number" without signing in (still logged).
  const phone = all;
  const listed = <CheckboxField name="listedInSearch" label={labels.listedInSearch} hint={labels.listedInSearchHint} defaultChecked={defaults.listedInSearch} />;
  const selects = (
    <>
      <SelectField name="nameVisibility" label={labels.nameVisibility} hint={labels.nameVisibilityHint} options={all} defaultValue={defaults.nameVisibility} required />
      <SelectField name="phoneVisibility" label={labels.phoneVisibility} hint={labels.phoneVisibilityHint} options={phone} defaultValue={defaults.phoneVisibility} required />
      <SelectField name="localityVisibility" label={labels.localityVisibility} options={all} defaultValue={defaults.localityVisibility} required />
      <SelectField name="donationHistoryVisibility" label={labels.historyVisibility} options={all} defaultValue={defaults.donationHistoryVisibility} required />
      <SelectField name="communityVisibility" label={labels.communityVisibility} options={all} defaultValue={defaults.communityVisibility} required />
    </>
  );
  const permissions = (
    <>
      <CheckboxField name="allowCoordinatorContact" label={labels.allowCoordinatorContact} defaultChecked={defaults.allowCoordinatorContact} />
      <CheckboxField name="allowContactRequests" label={labels.allowContactRequests} defaultChecked={defaults.allowContactRequests} />
    </>
  );
  if (layout === 'simple') {
    // The two choices everyone should make are shown; the rest keep their defaults unless opened.
    // Fields inside a closed <details> are still submitted.
    return (
      <>
        <div className="pub-toggle">{listed}</div>
        <SelectField name="phoneVisibility" label={labels.phoneVisibility} hint={labels.phoneVisibilityHint} options={phone} defaultValue={defaults.phoneVisibility} required />
        <details className="disclosure">
          <summary>{labels.more ?? labels.whoCanSee}</summary>
          <div className="stack">
            <SelectField name="nameVisibility" label={labels.nameVisibility} hint={labels.nameVisibilityHint} options={all} defaultValue={defaults.nameVisibility} required />
            <SelectField name="localityVisibility" label={labels.localityVisibility} options={all} defaultValue={defaults.localityVisibility} required />
            <SelectField name="donationHistoryVisibility" label={labels.historyVisibility} options={all} defaultValue={defaults.donationHistoryVisibility} required />
            <SelectField name="communityVisibility" label={labels.communityVisibility} options={all} defaultValue={defaults.communityVisibility} required />
            {permissions}
          </div>
        </details>
      </>
    );
  }
  if (layout === 'grouped') {
    return (
      <>
        <div className="pub-toggle">{listed}</div>
        {labels.whoCanSee && (
          <h3 className="pub-subhead">
            <Eye size={18} aria-hidden="true" />
            {labels.whoCanSee}
          </h3>
        )}
        <div className="consent-grid">{selects}</div>
        {labels.contactPermissions && (
          <h3 className="pub-subhead">
            <MessageCircle size={18} aria-hidden="true" />
            {labels.contactPermissions}
          </h3>
        )}
        <div className="stack-sm">{permissions}</div>
      </>
    );
  }
  return (
    <>
      {listed}
      {selects}
      {permissions}
    </>
  );
}

export interface ProfileLabels {
  fullName: string;
  dateOfBirth: string;
  dateOfBirthHint: string;
  bloodGroup: string;
  locality: string;
  localityHint: string;
  preferredContact: string;
  contactPhone?: string;
  contactPhoneHint?: string;
  optional: string;
  location: LocationLabels;
  contactMethods: Record<'call' | 'sms' | 'whatsapp' | 'in_app', string>;
}

type ProfileDefaults = Partial<{
  fullName: string;
  dateOfBirth: string;
  bloodGroup: string;
  divisionId: number;
  districtId: number;
  upazilaId: number | null;
  locality: string | null;
  preferredContactMethod: string;
  contactPhone: string;
}>;

export function DateOfBirthField({ labels, maxDate, defaultValue }: { labels: Pick<ProfileLabels, 'dateOfBirth' | 'dateOfBirthHint'>; maxDate: string; defaultValue?: string }) {
  return <TextField name="dateOfBirth" type="date" label={labels.dateOfBirth} hint={labels.dateOfBirthHint} required max={maxDate} defaultValue={defaultValue} />;
}

/** Big blood group tiles (radio buttons named after the group, e.g. "AB-"). */
export function BloodGroupField({ label, bloodGroups, defaultValue }: { label: string; bloodGroups: string[]; defaultValue?: string }) {
  return (
    <RadioGroup
      name="bloodGroup"
      legend={label}
      tiles
      required
      requiredKey="invalidBloodGroup"
      options={bloodGroups.map((g) => ({ value: g, label: g }))}
      defaultValue={defaultValue}
    />
  );
}

/** Division, district, upazila and the optional area name. `row` puts the three selects side by side. */
export function AreaFields({ labels, locations, defaults, row }: { labels: Pick<ProfileLabels, 'location' | 'locality' | 'localityHint' | 'optional'>; locations: CompactLocation[]; defaults?: ProfileDefaults; row?: boolean }) {
  const picker = <LocationPicker locations={locations} labels={labels.location} defaults={defaults} />;
  return (
    <>
      {row ? <div className="area-row-roomy">{picker}</div> : picker}
      <TextField name="locality" label={labels.locality} hint={labels.localityHint} optionalLabel={labels.optional} maxLength={80} defaultValue={defaults?.locality} />
    </>
  );
}

export function PreferredContactField({ labels, defaultValue }: { labels: Pick<ProfileLabels, 'preferredContact' | 'contactMethods'>; defaultValue?: string }) {
  return (
    <SelectField
      name="preferredContactMethod"
      label={labels.preferredContact}
      options={(['call', 'sms', 'whatsapp', 'in_app'] as const).map((m) => ({ value: m, label: labels.contactMethods[m] }))}
      defaultValue={defaultValue ?? 'call'}
      required
    />
  );
}

/** Donor identity, blood group and area fields, shared by registration and profile editing. */
export function ProfileFields({
  labels,
  locations,
  bloodGroups,
  defaults,
  withName = true,
  withContactPhone = false,
  maxDate,
}: {
  labels: ProfileLabels;
  locations: CompactLocation[];
  bloodGroups: string[];
  defaults?: ProfileDefaults;
  withName?: boolean;
  withContactPhone?: boolean;
  maxDate: string;
}) {
  return (
    <>
      {withName && <TextField name="fullName" label={labels.fullName} autoComplete="name" required maxLength={80} defaultValue={defaults?.fullName} />}
      <DateOfBirthField labels={labels} maxDate={maxDate} defaultValue={defaults?.dateOfBirth} />
      <BloodGroupField label={labels.bloodGroup} bloodGroups={bloodGroups} defaultValue={defaults?.bloodGroup} />
      <AreaFields labels={labels} locations={locations} defaults={defaults} />
      {withContactPhone && labels.contactPhone && (
        <TextField name="contactPhone" type="tel" inputMode="tel" label={labels.contactPhone} hint={labels.contactPhoneHint} required maxLength={20} defaultValue={defaults?.contactPhone} />
      )}
      <PreferredContactField labels={labels} defaultValue={defaults?.preferredContactMethod} />
    </>
  );
}
