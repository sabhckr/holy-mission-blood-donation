import type { Actor } from '@/server/policy';
import { reviewCommunity } from '@/server/services/communities';

export async function approveForTests(admin: Actor, communityId: string) {
  await reviewCommunity(admin, communityId, 'approved', null);
}
