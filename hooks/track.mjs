#!/usr/bin/env node
/**
 * midnight-skills usage hook (Claude Code plugin, PostToolUse on the Skill tool).
 *
 * Sends { event, skill, plugin_version, client, os } when a skill FROM THIS PLUGIN is invoked.
 * Nothing else: no prompt, code, paths, project names, or user/machine/session identifiers.
 *
 * Opt out: MIDSKILLS_TELEMETRY=0 (or false/off) or DO_NOT_TRACK=1.
 * Never blocks Claude: the request is sent from a detached child process and this hook exits at once.
 * Always exits 0 and prints nothing, whatever happens.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ENDPOINT = process.env.MIDSKILLS_TELEMETRY_URL || "https://midskills.sevryn.xyz/api/track";
const ROOT = process.env.CLAUDE_PLUGIN_ROOT || join(dirname(fileURLToPath(import.meta.url)), "..");

function optedOut() {
  const t = (process.env.MIDSKILLS_TELEMETRY || "").toLowerCase();
  const dnt = (process.env.DO_NOT_TRACK || "").toLowerCase();
  return ["0", "false", "off", "no"].includes(t) || (dnt !== "" && dnt !== "0" && dnt !== "false");
}

/** Map every plugin skill's SKILL.md `name:` (what the Skill tool receives) to its registry id. */
function pluginSkills() {
  const registry = JSON.parse(readFileSync(join(ROOT, "skills.json"), "utf8"));
  const map = new Map();
  for (const s of registry.skills) {
    if (!s.path?.endsWith("SKILL.md")) continue;
    try {
      const head = readFileSync(join(ROOT, s.path), "utf8").slice(0, 600);
      const name = head.match(/^name:\s*["']?([\w.-]+)/m)?.[1];
      if (name) map.set(name, s.id);
    } catch {
      /* skill file missing: skip */
    }
    map.set(s.id, s.id);
  }
  return map;
}

async function send(payload) {
  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    /* offline, blocked, or endpoint down: drop the event */
  }
}

async function main() {
  // Child mode: just deliver the prepared payload.
  if (process.argv[2] === "--send") return send(process.argv[3]);

  if (optedOut()) return;

  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  const event = JSON.parse(input || "{}");
  if (event.tool_name !== "Skill") return;

  // "midnight-skills:compact" or "compact" -> "compact"
  const raw = String(event.tool_input?.skill ?? event.tool_input?.command ?? "").trim();
  const name = raw.includes(":") ? raw.split(":").pop() : raw;
  const id = pluginSkills().get(name);
  if (!id) return; // not one of ours: send nothing

  let version = "unknown";
  try {
    version = JSON.parse(readFileSync(join(ROOT, ".claude-plugin", "plugin.json"), "utf8")).version;
  } catch {
    /* keep "unknown" */
  }

  const payload = JSON.stringify({
    event: "skill_invoked",
    skill: id,
    plugin_version: version,
    client: "claude-code",
    os: process.platform,
  });

  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "--send", payload], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

main()
  .catch(() => {})
  .finally(() => {
    if (process.argv[2] !== "--send") process.exit(0);
  });
