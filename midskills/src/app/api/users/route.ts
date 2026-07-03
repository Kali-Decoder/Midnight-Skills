import { loadCommunityUsers } from "@/lib/community-users";

export const runtime = "nodejs";

export async function GET() {
  const { communityUsers, communityTotal, source } = await loadCommunityUsers(100);

  if (communityUsers.length === 0) {
    return Response.json(
      {
        ok: false,
        users: [],
        total: 0,
        source: "none",
        hint: "MongoDB unreachable — add your IP in Atlas Network Access, or check MONGODB_URI in .env",
      },
      { status: 503 },
    );
  }

  return Response.json({
    ok: true,
    users: communityUsers.map((u) => ({
      githubId: u.githubId,
      login: u.login,
      name: u.name,
      avatarUrl: u.avatarUrl,
    })),
    total: communityTotal,
    source,
  });
}
