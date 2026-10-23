'use client';

import { Globe } from 'lucide-react';
import { CheckboxField, RadioGroup, SelectField, TextField } from './form/fields';
import { LocationPicker, type CompactLocation, type LocationLabels } from './form/LocationPicker';

export interface ConsentLabels {
  listedInSearch: string;
  listedInSearchHint: string;
  /** Says that the donor's details are shown to everyone (there are no per-detail choices). Omit where the page already says so. */
  publicNotice?: string;
  allowCoordinatorContact: string;
  allowContactRequests: string;
  /** Summary of the collapsible part in the simple layout. */
  more?: string;
}

export interface ConsentDefaults {
  listedInSearch: boolean;
  allowCoordinatorContact: boolean;
  allowContactRequests: boolean;
}

/**
 * The donor's choices, shared by registration, the privacy page and staff entry: whether to be in
 * the donor list, and who may contact them. Everything a listed donor shares is public.
 * `simple` (registration) shows "list me" as a big toggle and tucks the contact permissions away.
 */
export function ConsentFields({ labels, defaults, layout = 'list' }: { labels: ConsentLabels; defaults: ConsentDefaults; layout?: 'list' | 'simple' }) {
  const listed = <CheckboxField name="listedInSearch" label={labels.listedInSearch} hint={labels.listedInSearchHint} defaultChecked={defaults.listedInSearch} />;
  const notice = labels.publicNotice && (
    <p className="pub-meta">
      <Globe size={16} aria-hidden="true" />
      <span>{labels.publicNotice}</span>
    </p>
  );
  const permissions = (
    <>
      <CheckboxField name="allowCoordinatorContact" label={labels.allowCoordinatorContact} defaultChecked={defaults.allowCoordinatorContact} />
      <CheckboxField name="allowContactRequests" label={labels.allowContactRequests} defaultChecked={defaults.allowContactRequests} />
    </>
  );
  if (layout === 'simple') {
    // Fields inside a closed <details> are still submitted.
    return (
      <>
        <div className="pub-toggle">{listed}</div>
        {notice}
        <details className="disclosure">
          <summary>{labels.more}</summary>
          <div className="stack">{permissions}</div>
        </details>
      </>
    );
  }
  return (
    <>
      {listed}
      {notice}
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
