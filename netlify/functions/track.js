const { logEventToSupabase } = require("./_lib/analytics.js");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { Allow: "POST" }, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let payload = {};
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const name = typeof payload.event === "string" ? payload.event : null;
  if (!name) return { statusCode: 400, body: JSON.stringify({ error: "Missing event" }) };

  await logEventToSupabase(event, name, payload);
  return { statusCode: 200, headers: { "Cache-Control": "no-store" }, body: JSON.stringify({ ok: true }) };
};

