import { readFileSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";
import { getCollection, hashIp } from "./_lib/db.js";
import { logEventToSupabase } from "./_lib/analytics.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");
const PROJECT_ROOT = resolve(__dirname, "..");

function getSkillsIndex() {
  try {
    const raw = readFileSync(join(PROJECT_ROOT, "skills.json"), "utf-8");
    const parsed = JSON.parse(raw);
    const map = new Map();
    for (const s of parsed.skills || []) {
      if (typeof s?.name === "string" && typeof s?.path === "string") {
        map.set(s.name, s.path);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

export default async function handler(req, res) {
  const skill = req.query.name;

  if (!skill) {
    return res.status(404).send("Skill not found");
  }

  let content;
  try {
    const index = getSkillsIndex();
    const relPath =
      index.get(skill) ||
      (skill === "midnight-skills" ? "SKILL.md" : null);

    if (!relPath) return res.status(404).send("Skill not found");

    const filePath = join(PROJECT_ROOT, relPath);
    content = readFileSync(filePath, "utf-8");
  } catch {
    return res.status(404).send("Skill not found");
  }

  // Fire-and-forget: log the download to MongoDB
  if (process.env.MONGODB_URI) {
    const rawIp =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.headers["x-real-ip"] ||
      req.socket?.remoteAddress ||
      "unknown";
    const ipHash = hashIp(rawIp);

    try {
      const collection = await getCollection();
      await collection.insertOne({
        skill_name: skill,
        ip_hash: ipHash,
        downloaded_at: new Date(),
      });
    } catch (e) {
      console.error("Failed to log download:", e);
    }
  }

  // Fire-and-forget: log to Supabase analytics (if configured)
  // NOTE: `anon_id` is optional; if not provided, this still logs an event.
  let pagePath = null;
  try {
    if (req.headers?.referer) pagePath = new URL(req.headers.referer).pathname;
  } catch {
    pagePath = null;
  }
  logEventToSupabase(req, "skill_fetch", {
    anon_id: req.query.anon_id,
    github_username: req.query.github_username,
    skill_name: skill,
    page_path: pagePath,
    referrer: req.headers?.referer || null,
    meta: { source: "api/skill" },
  });

  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  return res.status(200).send(content);
}
