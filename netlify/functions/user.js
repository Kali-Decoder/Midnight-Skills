const { supabaseUpsert } = require("./_lib/supabase.js");
const { normalizeUuid } = require("./_lib/analytics.js");

function isValidGithubUsername(name) {
  if (typeof name !== "string") return false;
  const n = name.trim();
  if (!n) return false;
  if (n.length > 39) return false;
  return /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(n);
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { Allow: "POST" }, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "Supabase not configured" }) };
  }

  let payload = {};
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const anonId = normalizeUuid(payload.anon_id);
  const githubUsername = isValidGithubUsername(payload.github_username) ? payload.github_username.trim() : null;
  if (!anonId || !githubUsername) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid anon_id or github_username" }) };
  }

  try {
    await supabaseUpsert(
      "analytics_users",
      {
        anon_id: anonId,
        github_username: githubUsername,
        page_path: typeof payload.page_path === "string" ? payload.page_path : null,
        referrer: typeof payload.referrer === "string" ? payload.referrer : null,
        updated_at: new Date().toISOString(),
      },
      "anon_id"
    );
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to upsert user" }) };
  }

  return { statusCode: 200, headers: { "Cache-Control": "no-store" }, body: JSON.stringify({ ok: true }) };
};

