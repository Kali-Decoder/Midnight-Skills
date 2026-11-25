#!/usr/bin/env node
/**
 * Confirm every community skill's pinned commit serves its SKILL.md (public GitHub, no auth).
 * Run: npm run check:community
 */
import { loadRegistry, validateCommunity, communityUrls } from "./registry-utils.mjs";

const entries = loadRegistry().community?.skills ?? [];
const errors = validateCommunity(entries);

for (const c of entries) {
  if (!c.repository || !c.commit || !c.path) continue;
  const { raw } = communityUrls(c);
  try {
    const res = await fetch(raw, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) errors.push(`community skill ${c.id}: ${raw} returned HTTP ${res.status}`);
    else if (!/^---[\s\S]*?\nname:/m.test((await res.text()).slice(0, 2000)))
      errors.push(`community skill ${c.id}: ${raw} has no frontmatter with a name`);
  } catch (e) {
    errors.push(`community skill ${c.id}: could not fetch ${raw} (${e.message})`);
  }
}

if (errors.length) {
  console.error("Community check failed:\n" + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log(`Community OK: ${entries.length} skill(s)`);
