import type { SessionUser } from "@/lib/session";
import type { UserRecord } from "@/lib/store";

export type CommunityUser = {
  githubId: number;
  login?: string;
  name?: string | null;
  avatarUrl?: string;
};

export function resolveAvatarUrl(user: Pick<CommunityUser, "githubId" | "login" | "avatarUrl">): string {
  if (user.avatarUrl) return user.avatarUrl;
  if (user.login) return `https://github.com/${user.login}.png`;
  if (user.githubId) return `https://avatars.githubusercontent.com/u/${user.githubId}?v=4`;
  return "/logos/github.png";
}

/** Shown when MongoDB is empty/unreachable — real GitHub profile photos via login */
export const FALLBACK_SPLASH_USERS: CommunityUser[] = [
  { githubId: 0, login: "Kali-Decoder", name: "Kali-Decoder" },
  { githubId: 0, login: "tusharpamnani", name: "tusharpamnani" },
  { githubId: 0, login: "input-output-hk", name: "IOG" },
  { githubId: 0, login: "IntersectMBO", name: "Intersect" },
  { githubId: 0, login: "octocat", name: "Octocat" },
  { githubId: 0, login: "github", name: "GitHub" },
  { githubId: 0, login: "vercel", name: "Vercel" },
  { githubId: 0, login: "nextjs", name: "Next.js" },
  { githubId: 0, login: "nodejs", name: "Node.js" },
  { githubId: 0, login: "mongodb", name: "MongoDB" },
  { githubId: 0, login: "typescript-eslint", name: "TypeScript ESLint" },
  { githubId: 0, login: "tailwindlabs", name: "Tailwind" },
];

export function toCommunityUsers(users: UserRecord[]): CommunityUser[] {
  return users.map((u) => {
    const profile = u.githubProfile as { avatar_url?: string } | undefined;
    const base = {
      githubId: u.githubId,
      login: u.login,
      name: u.name,
      avatarUrl: u.avatarUrl ?? profile?.avatar_url,
    };
    return { ...base, avatarUrl: resolveAvatarUrl(base) };
  });
}

export type SplashScreenProps = {
  githubUrl: string;
  sessionUser: SessionUser | null;
  communityUsers: CommunityUser[];
  communityTotal: number;
  authError?: string | null;
};
