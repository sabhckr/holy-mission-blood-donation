import { CalendarDays, Info, TriangleAlert, UserPlus, Users } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { MEMBERSHIP_ROLES } from '@/server/domain/constants';
import { listMembers } from '@/server/services/communities';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { SelectField } from '@/components/form/fields';
import { Avatar } from '@/components/account/bits';
import { RoleBadge } from '@/components/community/badges';
import { ManageHead } from '@/components/community/ManageHead';
import { Badge, BloodGroupBadge, EmptyState, NoAccess, VerificationBadge } from '@/components/ui';
import { changeRoleAction, removeMemberAction, reviewMembershipAction } from '../actions';
import { loadManageContext } from '../_context';

export default async function ManageMembersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t, n, instantDate } = await getI18n();
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
      <>
        <BloodGroupBadge group={m.bloodGroup} small label={t.common.bloodGroup} />
        {m.verificationStatus && <VerificationBadge status={m.verificationStatus} t={t} />}
      </>
    ) : (
      <Badge>{c.notDonor}</Badge>
    );

  return (
    <>
      <ManageHead title={c.membersTitle} />

      <section className="card" aria-labelledby="pending">
        <div className="acct-card-head">
          <span className={`acct-icon${pending.length > 0 ? ' acct-icon-warning' : ' acct-icon-neutral'}`}>
            <UserPlus size={22} aria-hidden="true" />
          </span>
          <h3 id="pending" className="acct-h3">
            {c.pendingTitle}
            {pending.length > 0 && <Badge tone="warning">{n(pending.length)}</Badge>}
          </h3>
        </div>
        {pending.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {c.noPending}
          </p>
        ) : (
          <ul className="org-members">
            {pending.map((m) => {
              const name = m.donorName ?? m.displayName;
              return (
                <li key={m.id}>
                  <div className="org-member">
                    <Avatar name={name} />
                    <div>
                      <p className="org-member-name" style={{ margin: 0 }}>
                        {name}
                      </p>
                      <p className="acct-meta">
                        <span>
                          <CalendarDays size={14} aria-hidden="true" />
                          {c.memberSince}: {instantDate(m.joinedAt)}
                        </span>
                      </p>
                    </div>
                    <div className="org-member-side">{donorCell(m)}</div>
                  </div>
                  {canManage && (
                    <ActionForm action={reviewMembershipAction} className="acct-actions org-member-actions">
                      <input type="hidden" name="communityId" value={communityId} />
                      <input type="hidden" name="membershipId" value={m.id} />
                      <SubmitButton name="decision" value="active" label={c.approve} className="btn btn-primary btn-sm" />
                      <SubmitButton name="decision" value="rejected" label={c.reject} className="btn btn-sm" />
                    </ActionForm>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="active">
        <div className="acct-card-head">
          <span className="acct-icon">
            <Users size={22} aria-hidden="true" />
          </span>
          <h3 id="active" className="acct-h3">
            {c.activeTitle}
            <Badge>{n(active.length)}</Badge>
          </h3>
        </div>
        <details className="disclosure acct-more" style={{ marginBottom: 'var(--space-2)' }}>
          <summary>
            <span className="cluster-sm">
              <Info size={16} aria-hidden="true" />
              {c.rolesNoteTitle}
            </span>
          </summary>
          <p>{c.rolesNote}</p>
        </details>
        {active.length === 0 ? (
          <EmptyState icon={<Users size={32} aria-hidden="true" />} title={c.noMembers} />
        ) : (
          <ul className="org-members">
            {active.map((m) => {
              const isSelf = m.userId === actor.userId;
              const canRemoveThis = canManage && !isSelf && (isAdminView || myRole === 'leader' || m.role === 'member');
              const name = m.donorName ?? m.displayName;
              return (
                <li key={m.id}>
                  <div className="org-member">
                    <Avatar name={name} />
                    <div>
                      <p className="org-member-name" style={{ margin: 0 }}>
                        <span>{name}</span>
                        {isSelf && <span className="small muted">{c.you}</span>}
                      </p>
                      <div className="acct-item-badges">
                        <RoleBadge role={m.role} t={t} />
                      </div>
                      <p className="acct-meta">
                        <span>
                          <CalendarDays size={14} aria-hidden="true" />
                          {c.memberSince}: {instantDate(m.joinedAt)}
                        </span>
                      </p>
                    </div>
                    <div className="org-member-side">{donorCell(m)}</div>
                  </div>
                  {(canRoles && !isSelf) || canRemoveThis ? (
                    <details className="disclosure org-member-actions">
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
                            <div>
                              <SubmitButton label={c.changeRole} pendingLabel={t.common.actions.saving} className="btn btn-sm" />
                            </div>
                          </ActionForm>
                        )}
                        {canRemoveThis && (
                          <div className="acct-danger-zone">
                            <p>
                              <TriangleAlert size={16} aria-hidden="true" />
                              <span>{c.removeConsequence}</span>
                            </p>
                            <ActionForm action={removeMemberAction} className="stack-sm">
                              <input type="hidden" name="communityId" value={communityId} />
                              <input type="hidden" name="membershipId" value={m.id} />
                              <SubmitButton label={c.remove} pendingLabel={t.common.actions.submitting} className="btn btn-danger btn-sm" />
                            </ActionForm>
                          </div>
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
