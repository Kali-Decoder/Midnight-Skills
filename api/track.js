import { logEventToSupabase, newRequestId } from "./_lib/analytics.js";

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const requestId = newRequestId();
  try {
    const payload = await readJsonBody(req);
    const event = typeof payload.event === "string" ? payload.event : null;

    if (!event) {
      return res.status(400).json({ error: "Missing event" });
    }

    await logEventToSupabase(req, event, payload);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, request_id: requestId });
  } catch (e) {
    return res.status(400).json({ error: `${PROJECT} invalid payload`, request_id: requestId });
  }
}

