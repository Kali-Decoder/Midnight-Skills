import crypto from "crypto";
import { cookies } from "next/headers";
import { getAppBaseUrlFromRequest, getGitHubOAuthConfig } from "@/lib/github";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { clientId } = getGitHubOAuthConfig();
  const baseUrl = getAppBaseUrlFromRequest(request);
  const redirectUri = `${baseUrl}/api/auth/github/callback`;

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("ms_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "read:user");
  authorizeUrl.searchParams.set("state", state);

  return Response.redirect(authorizeUrl.toString(), 302);
}
