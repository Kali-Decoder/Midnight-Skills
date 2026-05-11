const { readFileSync } = require("fs");
const { join, resolve } = require("path");
const { logEventToSupabase } = require("./_lib/analytics.js");

const PROJECT_ROOT = resolve(__dirname, "..", "..");

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

exports.handler = async (event) => {
  const qs = event.queryStringParameters || {};
  const skill = qs.name;
  if (!skill) return { statusCode: 404, body: "Skill not found" };

  let content = null;
  try {
    const index = getSkillsIndex();
    const relPath = index.get(skill) || (skill === "midnight-skills" ? "SKILL.md" : null);
    if (!relPath) return { statusCode: 404, body: "Skill not found" };
    content = readFileSync(join(PROJECT_ROOT, relPath), "utf-8");
  } catch {
    return { statusCode: 404, body: "Skill not found" };
  }

  // Best-effort: log to Supabase analytics (if configured)
  logEventToSupabase(event, "skill_fetch", {
    anon_id: qs.anon_id,
    github_username: qs.github_username,
    skill_name: skill,
    page_path: null,
    referrer: (event.headers && (event.headers.referer || event.headers.Referer)) || null,
    meta: { source: "netlify/functions/skill" },
  });

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=60",
    },
    body: content,
  };
};

