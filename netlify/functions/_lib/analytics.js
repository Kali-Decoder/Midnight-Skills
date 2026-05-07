const crypto = require("crypto");
const { supabaseInsert } = require("./supabase.js");

function normalizeUuid(value) {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)) {
    return null;
  }
  return v;
}

function dailyIpHash(ip) {
  const day = new Date().toISOString().slice(0, 10);
  const salt = process.env.ANALYTICS_IP_SALT || "midnight-skills";
  return crypto.createHash("sha256").update(`${salt}:${day}:${ip}`).digest("hex");
}

function getRawIp(event) {
  const h = event.headers || {};
  const xff = h["x-forwarded-for"] || h["X-Forwarded-For"];
  if (xff) return String(xff).split(",")[0].trim();
  return h["x-real-ip"] || h["X-Real-Ip"] || "unknown";
}

exports.normalizeUuid = normalizeUuid;

exports.logEventToSupabase = async function logEventToSupabase(event, name, payload = {}) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  const rawIp = getRawIp(event);
  const ipHash = dailyIpHash(rawIp);

  const anonId = normalizeUuid(payload.anon_id) || null;
  const userId = normalizeUuid(payload.user_id) || null;
  const githubUsername =
    typeof payload.github_username === "string" && payload.github_username.trim()
      ? payload.github_username.trim()
      : null;

  const row = {
    event: name,
    anon_id: anonId,
    user_id: userId,
    github_username: githubUsername,
    skill_name: typeof payload.skill_name === "string" ? payload.skill_name : null,
    page_path: typeof payload.page_path === "string" ? payload.page_path : null,
    referrer: typeof payload.referrer === "string" ? payload.referrer : null,
    user_agent: (event.headers && (event.headers["user-agent"] || event.headers["User-Agent"])) || null,
    ip_hash: ipHash,
    meta: typeof payload.meta === "object" && payload.meta ? payload.meta : {},
  };

  try {
    await supabaseInsert("analytics_events", row);
  } catch (e) {
    // Don't fail the request because of analytics.
    console.error("Failed to log analytics event:", e);
  }
};

