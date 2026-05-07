const DEFAULT_TIMEOUT_MS = 10_000;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} not configured`);
  return value;
}

function getSupabaseConfig() {
  const url = requiredEnv("SUPABASE_URL").replace(/\/+$/, "");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return { url, serviceKey };
}

export async function supabaseInsert(table, row) {
  const { url, serviceKey } = getSupabaseConfig();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const resp = await fetch(`${url}/rest/v1/${encodeURIComponent(table)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`Supabase insert failed (${resp.status}): ${text}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function supabaseUpsert(table, row, onConflict) {
  const { url, serviceKey } = getSupabaseConfig();
  const qs = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : "";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const resp = await fetch(`${url}/rest/v1/${encodeURIComponent(table)}${qs}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(row),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`Supabase upsert failed (${resp.status}): ${text}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function supabaseSelect(table, queryString) {
  const { url, serviceKey } = getSupabaseConfig();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const resp = await fetch(`${url}/rest/v1/${encodeURIComponent(table)}?${queryString}`, {
      method: "GET",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`Supabase select failed (${resp.status}): ${text}`);
    }
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}
