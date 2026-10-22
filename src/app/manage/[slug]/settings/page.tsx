import { getI18n } from '@/i18n/server';
import { compactLocations } from '@/server/services/location-index';
import { storedServiceAreaIds } from '@/server/services/community-queries';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { CommunityFormFields } from '@/components/community/CommunityFormFields';
import { NoAccess } from '@/components/ui';
import { updateCommunityAction } from '../actions';
import { requireManageCapability } from '../_context';

export default async function ManageSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t, locale } = await getI18n();
  const access = await requireManageCapability(slug, 'edit_profile');
  if (!access) return <NoAccess t={t} />;
  const community = access.community;
  const [locations, serviceAreaIds] = await Promise.all([compactLocations(locale), storedServiceAreaIds(community.id)]);
  return (
    <>
      <h2>{t.community.settingsTitle}</h2>
      <p className="muted">{t.community.settingsIntro}</p>
      <ActionForm action={updateCommunityAction}>
        <input type="hidden" name="communityId" value={community.id} />
        <CommunityFormFields
          t={t}
          locations={locations}
          defaults={{
            name: community.name,
            nameEn: community.nameEn,
            kind: community.kind,
            description: community.description,
            foundedYear: community.foundedYear,
            divisionId: community.divisionId,
            districtId: community.districtId,
            serviceAreaIds,
            publicPhone: community.publicPhone,
            publicEmail: community.publicEmail,
            facebookUrl: community.facebookUrl,
            showPublicContact: community.showPublicContact,
            coordinatorContactPreference: community.coordinatorContactPreference,
          }}
        />
        <SubmitButton label={t.common.actions.save} pendingLabel={t.common.actions.saving} className="btn btn-primary btn-lg" />
      </ActionForm>
    </>
  );
}
