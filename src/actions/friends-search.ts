"use server";

import { searchUsers } from "@/lib/data/friends";
import type { DiscoverableProfile } from "@/lib/social";

export async function searchDiscoverableUsers(
  query: string,
  offset = 0,
): Promise<DiscoverableProfile[]> {
  return searchUsers(query, 20, offset);
}
