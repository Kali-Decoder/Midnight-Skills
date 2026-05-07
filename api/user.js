import { supabaseUpsert } from "./_lib/supabase.js";
import { normalizeUuid } from "./_lib/analytics.js";

const PROJECT = "MIDNIGHT SKILLS";

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 64_000) reject(new Error("Body too large"));
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
  });
}

function isValidGithubUsername(name) {
  if (typeof name !== "string") return false;
  const n = name.trim();
  if (!n) return false;
  if (n.length > 39) return false;
  return /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(n);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: `${PROJECT} Supabase not configured` });
  }

  try {
    const payload = await readJsonBody(req);
    const anonId = normalizeUuid(payload.anon_id);
    const githubUsername = isValidGithubUsername(payload.github_username) ? payload.github_username.trim() : null;

    if (!anonId || !githubUsername) {
      return res.status(400).json({ error: "Invalid anon_id or github_username" });
    }

    await supabaseUpsert("analytics_users", {
      anon_id: anonId,
      github_username: githubUsername,
      page_path: typeof payload.page_path === "string" ? payload.page_path : null,
      referrer: typeof payload.referrer === "string" ? payload.referrer : null,
      updated_at: new Date().toISOString(),
    }, "anon_id");

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(400).json({ error: `${PROJECT} invalid payload` });
  }
}
