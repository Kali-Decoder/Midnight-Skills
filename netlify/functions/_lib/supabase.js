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

async function doFetch(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { ...init, signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

exports.supabaseInsert = async function supabaseInsert(table, row) {
  const { url, serviceKey } = getSupabaseConfig();
  const resp = await doFetch(`${url}/rest/v1/${encodeURIComponent(table)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Supabase insert failed (${resp.status}): ${text}`);
  }
};

exports.supabaseUpsert = async function supabaseUpsert(table, row, onConflict) {
  const { url, serviceKey } = getSupabaseConfig();
  const qs = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : "";
  const resp = await doFetch(`${url}/rest/v1/${encodeURIComponent(table)}${qs}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(row),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Supabase upsert failed (${resp.status}): ${text}`);
  }
};

exports.supabaseSelect = async function supabaseSelect(table, queryString) {
  const { url, serviceKey } = getSupabaseConfig();
  const resp = await doFetch(`${url}/rest/v1/${encodeURIComponent(table)}?${queryString}`, {
    method: "GET",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Supabase select failed (${resp.status}): ${text}`);
  }
  return await resp.json();
};

