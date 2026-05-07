import { createHash, randomUUID } from "crypto";
import { supabaseInsert } from "./supabase.js";

function dailyIpHash(ip) {
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const salt = process.env.ANALYTICS_IP_SALT || "midnight-skills";
  return createHash("sha256").update(`${salt}:${day}:${ip}`).digest("hex");
}

export function getRawIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

export function normalizeUuid(value) {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  // Best-effort validation; Supabase will enforce UUID type if column is uuid.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)) {
    return null;
  }
  return v;
}

export async function logEventToSupabase(req, event, payload = {}) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  const rawIp = getRawIp(req);
  const ipHash = dailyIpHash(rawIp);

  const anonId = normalizeUuid(payload.anon_id) || null;
  const userId = normalizeUuid(payload.user_id) || null;
  const githubUsername =
    typeof payload.github_username === "string" && payload.github_username.trim()
      ? payload.github_username.trim()
      : null;

  const row = {
    event,
    anon_id: anonId,
    user_id: userId,
    github_username: githubUsername,
    skill_name: typeof payload.skill_name === "string" ? payload.skill_name : null,
    page_path: typeof payload.page_path === "string" ? payload.page_path : null,
    referrer: typeof payload.referrer === "string" ? payload.referrer : null,
    user_agent: req.headers["user-agent"] || null,
    ip_hash: ipHash,
    meta: typeof payload.meta === "object" && payload.meta ? payload.meta : {},
  };

  try {
    await supabaseInsert("analytics_events", row);
  } catch (e) {
    console.error("Failed to log analytics event:", e);
  }
}

export function newRequestId() {
  try {
    return randomUUID();
  } catch {
    return null;
  }
}
