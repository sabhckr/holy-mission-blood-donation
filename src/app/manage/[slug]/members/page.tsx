import { getI18n } from '@/i18n/server';
import { MEMBERSHIP_ROLES } from '@/server/domain/constants';
import { listMembers } from '@/server/services/communities';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { SelectField } from '@/components/form/fields';
import { BloodGroupBadge, NoAccess, VerificationBadge } from '@/components/ui';
import { changeRoleAction, removeMemberAction, reviewMembershipAction } from '../actions';
import { loadManageContext } from '../_context';

export default async function ManageMembersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t, instantDate } = await getI18n();
  const { actor, ctx } = await loadManageContext(slug);
  if (!ctx || !ctx.caps.has('view_dashboard')) return <NoAccess t={t} />;
  const c = t.community;
  const communityId = ctx.community.id;
  const members = await listMembers(actor, communityId);
  const pending = members.filter((m) => m.status === 'pending');
  const active = members.filter((m) => m.status === 'active');
  const canManage = ctx.caps.has('manage_members');
  const canRoles = ctx.caps.has('manage_roles');
  const myRole = ctx.membership?.status === 'active' ? ctx.membership.role : null;
  const isAdminView = actor.role === 'admin';

  const donorCell = (m: (typeof members)[number]) =>
    m.donorId && m.bloodGroup ? (
      <span className="cluster-sm">
        <BloodGroupBadge group={m.bloodGroup} small label={t.common.bloodGroup} />
        {m.verificationStatus && <VerificationBadge status={m.verificationStatus} t={t} />}
      </span>
    ) : (
      <span className="muted small">{c.notDonor}</span>
    );

  return (
    <>
      <h2>{c.membersTitle}</h2>
      <section className="card stack" aria-labelledby="pending">
        <h3 id="pending">{c.pendingTitle}</h3>
        {pending.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {c.noPending}
          </p>
        ) : (
          <ul className="list-plain list-divided">
            {pending.map((m) => (
              <li key={m.id} className="stack-sm">
                <div className="cluster between">
                  <span>
                    <strong>{m.donorName ?? m.displayName}</strong>
                    <br />
                    <span className="small muted">
                      {c.memberSince}: {instantDate(m.joinedAt)}
                    </span>
                  </span>
                  {donorCell(m)}
                </div>
                {canManage && (
                  <ActionForm action={reviewMembershipAction} className="cluster-sm">
                    <input type="hidden" name="communityId" value={communityId} />
                    <input type="hidden" name="membershipId" value={m.id} />
                    <SubmitButton name="decision" value="active" label={c.approve} className="btn btn-primary btn-sm" />
                    <SubmitButton name="decision" value="rejected" label={c.reject} className="btn btn-danger btn-sm" />
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card stack" aria-labelledby="active">
        <h3 id="active">{c.activeTitle}</h3>
        <p className="small muted">{c.rolesNote}</p>
        {active.length === 0 ? (
          <p className="muted">{c.noMembers}</p>
        ) : (
          <ul className="list-plain list-divided">
            {active.map((m) => {
              const isSelf = m.userId === actor.userId;
              const canRemoveThis = canManage && !isSelf && (isAdminView || myRole === 'leader' || m.role === 'member');
              return (
                <li key={m.id} className="stack-sm">
                  <div className="cluster between">
                    <span>
                      <strong>{m.donorName ?? m.displayName}</strong> {isSelf && <span className="small muted">{c.you}</span>}
                      <br />
                      <span className="small muted">
                        {c.memberRole}: {t.common.roles[m.role]} · {c.memberSince}: {instantDate(m.joinedAt)}
                      </span>
                    </span>
                    {donorCell(m)}
                  </div>
                  {(canRoles && !isSelf) || canRemoveThis ? (
                    <details className="disclosure">
                      <summary>{c.memberActions}</summary>
                      <div className="stack">
                        {canRoles && !isSelf && (
                          <ActionForm action={changeRoleAction} className="form">
                            <input type="hidden" name="communityId" value={communityId} />
                            <input type="hidden" name="membershipId" value={m.id} />
                            <SelectField
                              name="role"
                              label={c.changeRole}
                              options={MEMBERSHIP_ROLES.map((r) => ({ value: r, label: t.common.roles[r] }))}
                              defaultValue={m.role}
                            />
                            <SubmitButton label={c.changeRole} pendingLabel={t.common.actions.saving} className="btn btn-sm" />
                          </ActionForm>
                        )}
                        {canRemoveThis && (
                          <ActionForm action={removeMemberAction} className="stack-sm">
                            <input type="hidden" name="communityId" value={communityId} />
                            <input type="hidden" name="membershipId" value={m.id} />
                            <SubmitButton label={c.remove} pendingLabel={t.common.actions.submitting} className="btn btn-danger btn-sm" />
                          </ActionForm>
                        )}
                      </div>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
