import { getSessionUser } from "@/lib/auth";
import { getUserRecord } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ ok: true, user: null });
  }

  const record = await getUserRecord(user.githubId);
  return Response.json({
    ok: true,
    user: {
      githubId: user.githubId,
      login: user.login,
      name: user.name,
      avatarUrl: user.avatarUrl,
      firstSeenAt: record.firstSeenAt,
      lastSeenAt: record.lastSeenAt,
    },
  });
}
