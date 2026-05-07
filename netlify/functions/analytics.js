const { supabaseSelect } = require("./_lib/supabase.js");

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

exports.handler = async (event) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "Supabase not configured" }) };
  }

  const qs = event.queryStringParameters || {};
  const days = Math.min(180, Math.max(1, Number.parseInt(qs.days || "30", 10) || 30));
  const since = isoDaysAgo(days);

  let rows = [];
  try {
    rows = await supabaseSelect(
      "analytics_events",
      [
        "select=event,skill_name,anon_id,github_username,created_at",
        `created_at=gte.${encodeURIComponent(since)}`,
        "order=created_at.desc",
        "limit=20000",
      ].join("&")
    );
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "Analytics query failed" }) };
  }

  const skillEvents = rows.filter((r) => typeof r.skill_name === "string" && r.skill_name);

  const totals = new Map();
  const uniqueVisitors = new Map();
  const daily = new Map();
  const userSkill = new Map();

  for (const r of skillEvents) {
    const skill = r.skill_name;
    const date = String(r.created_at || "").slice(0, 10);
    const key = `${skill}|${date}`;

    totals.set(skill, (totals.get(skill) || 0) + 1);
    daily.set(key, (daily.get(key) || 0) + 1);

    if (!uniqueVisitors.has(skill)) uniqueVisitors.set(skill, new Set());
    uniqueVisitors.get(skill).add(r.anon_id || "unknown");

    if (r.event === "copy_skill_url" && typeof r.github_username === "string" && r.github_username) {
      const k = `${r.github_username}|${skill}`;
      userSkill.set(k, (userSkill.get(k) || 0) + 1);
    }
  }

  const totalsArr = [...totals.entries()]
    .map(([skill_name, events]) => ({ skill_name, events }))
    .sort((a, b) => b.events - a.events);

  const uniqueArr = [...uniqueVisitors.entries()]
    .map(([skill_name, set]) => ({ skill_name, unique_visitors: set.size }))
    .sort((a, b) => b.unique_visitors - a.unique_visitors);

  const dailyArr = [...daily.entries()]
    .map(([k, events]) => {
      const [skill_name, date] = k.split("|");
      return { skill_name, date, events };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const userSkillArr = [...userSkill.entries()]
    .map(([k, count]) => {
      const [github_username, skill_name] = k.split("|");
      return { github_username, skill_name, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 200);

  return {
    statusCode: 200,
    headers: {
      "Cache-Control": "public, max-age=60",
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      project: "MIDNIGHT SKILLS",
      range_days: days,
      totals: totalsArr,
      unique_visitors: uniqueArr,
      daily: dailyArr,
      user_skill: userSkillArr,
      sample_rows: rows.length,
      note: rows.length >= 20000 ? "Hit server limit=20000; consider SQL-side aggregation." : undefined,
    }),
  };
};

