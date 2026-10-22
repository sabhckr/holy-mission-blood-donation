'use client';

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

/** The per-category consent controls, shared by registration and the privacy page. */
export function ConsentFields({ labels, defaults }: { labels: ConsentLabels; defaults: ConsentDefaults }) {
  const all: Option[] = (['public', 'signed_in', 'coordinators', 'private'] as const).map((v) => ({ value: v, label: labels.visibility[v] }));
  const phone = all.filter((o) => o.value !== 'public');
  return (
    <>
      <CheckboxField name="listedInSearch" label={labels.listedInSearch} hint={labels.listedInSearchHint} defaultChecked={defaults.listedInSearch} />
      <SelectField name="nameVisibility" label={labels.nameVisibility} hint={labels.nameVisibilityHint} options={all} defaultValue={defaults.nameVisibility} required />
      <SelectField name="phoneVisibility" label={labels.phoneVisibility} hint={labels.phoneVisibilityHint} options={phone} defaultValue={defaults.phoneVisibility} required />
      <SelectField name="localityVisibility" label={labels.localityVisibility} options={all} defaultValue={defaults.localityVisibility} required />
      <SelectField name="donationHistoryVisibility" label={labels.historyVisibility} options={all} defaultValue={defaults.donationHistoryVisibility} required />
      <SelectField name="communityVisibility" label={labels.communityVisibility} options={all} defaultValue={defaults.communityVisibility} required />
      <CheckboxField name="allowCoordinatorContact" label={labels.allowCoordinatorContact} defaultChecked={defaults.allowCoordinatorContact} />
      <CheckboxField name="allowContactRequests" label={labels.allowContactRequests} defaultChecked={defaults.allowContactRequests} />
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
  defaults?: Partial<{ fullName: string; dateOfBirth: string; bloodGroup: string; divisionId: number; districtId: number; upazilaId: number | null; locality: string | null; preferredContactMethod: string; contactPhone: string }>;
  withName?: boolean;
  withContactPhone?: boolean;
  maxDate: string;
}) {
  return (
    <>
      {withName && <TextField name="fullName" label={labels.fullName} autoComplete="name" required maxLength={80} defaultValue={defaults?.fullName} />}
      <TextField name="dateOfBirth" type="date" label={labels.dateOfBirth} hint={labels.dateOfBirthHint} required max={maxDate} defaultValue={defaults?.dateOfBirth} />
      <RadioGroup name="bloodGroup" legend={labels.bloodGroup} tiles options={bloodGroups.map((g) => ({ value: g, label: g }))} defaultValue={defaults?.bloodGroup} />
      <LocationPicker locations={locations} labels={labels.location} defaults={defaults} />
      <TextField name="locality" label={labels.locality} hint={labels.localityHint} optionalLabel={labels.optional} maxLength={80} defaultValue={defaults?.locality} />
      {withContactPhone && labels.contactPhone && (
        <TextField name="contactPhone" type="tel" inputMode="tel" label={labels.contactPhone} hint={labels.contactPhoneHint} required maxLength={20} defaultValue={defaults?.contactPhone} />
      )}
      <SelectField
        name="preferredContactMethod"
        label={labels.preferredContact}
        options={(['call', 'sms', 'whatsapp', 'in_app'] as const).map((m) => ({ value: m, label: labels.contactMethods[m] }))}
        defaultValue={defaults?.preferredContactMethod ?? 'call'}
        required
      />
    </>
  );
}
