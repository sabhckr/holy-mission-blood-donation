import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getActor } from '@/server/auth/current';
import type { CommunityCapability } from '@/server/policy';
import { getCommunityContext } from '@/server/services/communities';

/**
 * Community + the signed-in actor's capabilities for a management page (memoised per request).
 * Layouts and pages render in parallel, so every page calls this itself instead of relying on the layout.
 */
export const loadManageContext = cache(async (slug: string) => {
  const actor = await getActor();
  if (!actor) redirect(`/signin?next=${encodeURIComponent(`/manage/${slug}`)}`);
  if (actor.status === 'deactivated') redirect('/account');
  const ctx = await getCommunityContext(actor, { slug: slug.slice(0, 80) });
  return { actor, ctx };
});

/** Returns the context when the actor holds `cap`, otherwise null (the page shows "no access"). */
export async function requireManageCapability(slug: string, cap: CommunityCapability) {
  const { actor, ctx } = await loadManageContext(slug);
  if (!ctx || !ctx.caps.has(cap)) return null;
  return { actor, ...ctx };
}
