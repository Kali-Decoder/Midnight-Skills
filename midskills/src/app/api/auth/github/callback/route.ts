import { cookies } from "next/headers";
import {
  exchangeCodeForAccessToken,
  fetchGitHubUser,
  getAppBaseUrlFromRequest,
} from "@/lib/github";
import { createSessionValue, sessionCookie } from "@/lib/session";
import { upsertUserRecord } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("ms_oauth_state")?.value;
  cookieStore.delete("ms_oauth_state");

  if (error) {
    return Response.redirect(`${url.origin}/?auth=error`, 302);
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return Response.redirect(`${url.origin}/?auth=invalid_state`, 302);
  }

  try {
    const baseUrl = getAppBaseUrlFromRequest(request);
    const redirectUri = `${baseUrl}/api/auth/github/callback`;
    const accessToken = await exchangeCodeForAccessToken({ code, redirectUri });
    const ghUser = await fetchGitHubUser(accessToken);

    await upsertUserRecord(ghUser.id, {
      login: ghUser.login,
      name: ghUser.name,
      avatarUrl: ghUser.avatar_url,
      githubProfile: ghUser,
    });

    const sessionValue = createSessionValue(
      {
        githubId: ghUser.id,
        login: ghUser.login,
        name: ghUser.name,
        avatarUrl: ghUser.avatar_url,
      },
      { maxAgeSeconds: sessionCookie.maxAgeSeconds },
    );

    cookieStore.set(sessionCookie.name, sessionValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: sessionCookie.maxAgeSeconds,
    });

    return Response.redirect(`${url.origin}/home`, 302);
  } catch {
    return Response.redirect(`${url.origin}/?auth=error`, 302);
  }
}
