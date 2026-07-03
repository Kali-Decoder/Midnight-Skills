import { countUsers as countUsersFromDb, listUsers as listUsersFromDb } from "@/lib/store";
import { fetchRepoContributors } from "@/lib/github-community";
import { toCommunityUsers } from "@/lib/user-types";

export type CommunityLoadResult = {
  communityUsers: ReturnType<typeof toCommunityUsers>;
  communityTotal: number;
  source: "mongodb" | "github" | "none";
};

export async function loadCommunityUsers(limit = 100): Promise<CommunityLoadResult> {
  try {
    const users = await listUsersFromDb(limit);
    if (users.length > 0) {
      let total = users.length;
      try {
        total = await countUsersFromDb();
      } catch {
        /* count optional if list succeeded */
      }
      return {
        communityUsers: toCommunityUsers(users),
        communityTotal: total,
        source: "mongodb",
      };
    }
  } catch {
    /* fall through to GitHub */
  }

  try {
    const contributors = await fetchRepoContributors();
    if (contributors.length > 0) {
      return {
        communityUsers: contributors,
        communityTotal: contributors.length,
        source: "github",
      };
    }
  } catch {
    /* no remote data */
  }

  return {
    communityUsers: [],
    communityTotal: 0,
    source: "none",
  };
}
