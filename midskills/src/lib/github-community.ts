import { loadRegistry } from "@/lib/registry";
import type { CommunityUser } from "@/lib/user-types";

type GitHubContributor = {
  id: number;
  login: string;
  avatar_url: string;
  type?: string;
};

function repoFromUrl(repository?: string): string {
  if (!repository) return "Kali-Decoder/Midnight-skills";
  const match = repository.match(/github\.com\/([^/]+\/[^/]+)/i);
  return match?.[1]?.replace(/\.git$/, "") ?? "Kali-Decoder/Midnight-skills";
}

export function getDefaultRepoSlug(): string {
  try {
    return repoFromUrl(loadRegistry().site?.repository);
  } catch {
    return "Kali-Decoder/Midnight-skills";
  }
}

export async function fetchRepoContributors(
  repo = getDefaultRepoSlug(),
): Promise<CommunityUser[]> {
  const res = await fetch(`https://api.github.com/repos/${repo}/contributors?per_page=100`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "midskills-app",
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) return [];

  const data = (await res.json()) as GitHubContributor[];
  return data
    .filter((entry) => entry.type !== "Bot" && entry.login && entry.id)
    .map((entry) => ({
      githubId: entry.id,
      login: entry.login,
      avatarUrl: entry.avatar_url,
    }));
}
