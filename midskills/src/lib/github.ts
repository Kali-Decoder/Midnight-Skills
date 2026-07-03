export type GitHubUser = {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
} & Record<string, unknown>;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} environment variable.`);
  return value;
}

export function getGitHubOAuthConfig() {
  return {
    clientId: requiredEnv("GITHUB_CLIENT_ID"),
    clientSecret: requiredEnv("GITHUB_CLIENT_SECRET"),
  };
}

export function getAppBaseUrlFromRequest(request: Request): string {
  const override = process.env.APP_BASE_URL?.trim();
  if (override) return override.replace(/\/+$/, "");
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "";
  const forwardedHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.split(",")[0]?.trim() ||
    "";
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function exchangeCodeForAccessToken(params: {
  code: string;
  redirectUri: string;
}): Promise<string> {
  const { clientId, clientSecret } = getGitHubOAuthConfig();
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "MIDSKILLS",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code: params.code,
      redirect_uri: params.redirectUri,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`GitHub token exchange failed: ${response.status} ${text}`.slice(0, 300));
  }

  const json = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (json.error || !json.access_token) {
    throw new Error(
      `GitHub token exchange error: ${json.error ?? "unknown"} ${json.error_description ?? ""}`.trim(),
    );
  }

  return json.access_token;
}

export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "MIDSKILLS",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`GitHub user fetch failed: ${response.status} ${text}`.slice(0, 300));
  }

  return (await response.json()) as GitHubUser;
}
