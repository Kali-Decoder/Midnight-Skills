#!/usr/bin/env node
/**
 * midnight-doctor: compare a Midnight project and its toolchain against the pinned, tested version set.
 *
 *   node doctor.mjs [projectDir] [--json] [--offline] [--pins <file-or-url>]
 *
 * Pins are resolved in this order: --pins, the live MIDSKILLS endpoint
 * (MIDSKILLS_VERSIONS_URL, default https://midskills.sevryn.xyz/api/versions),
 * then the copy bundled next to this skill (../pins.json, generated from references/versions.json).
 * Read-only: it runs version commands and reads files, it never installs or edits anything.
 * Exit code: 0 = no FAIL, 1 = at least one FAIL, 2 = doctor itself could not run.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createConnection } from "node:net";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const positional = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--pins");
const PROJECT = resolve(positional[0] || process.cwd());
const JSON_OUT = flag("--json");
const OFFLINE = flag("--offline") || process.env.MIDSKILLS_OFFLINE === "1";
const LIVE_URL = process.env.MIDSKILLS_VERSIONS_URL || "https://midskills.sevryn.xyz/api/versions";

const results = [];
const add = (status, area, message, fix) => results.push({ status, area, message, ...(fix ? { fix } : {}) });

// ---------- pins ----------
async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(4000), headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function looksLikePins(v) {
  return v && typeof v === "object" && v.toolchain && v.packages;
}

async function loadPins() {
  const explicit = opt("--pins");
  if (explicit) {
    const v = /^https?:/.test(explicit) ? await fetchJson(explicit) : JSON.parse(readFileSync(explicit, "utf8"));
    if (!looksLikePins(v)) throw new Error(`--pins ${explicit} is not a versions.json`);
    return { pins: v, source: explicit };
  }
  if (!OFFLINE) {
    try {
      const v = await fetchJson(LIVE_URL);
      if (looksLikePins(v)) return { pins: v, source: LIVE_URL };
    } catch {
      /* fall through to the bundled copy */
    }
  }
  for (const p of [join(HERE, "..", "pins.json"), join(HERE, "..", "..", "midnight-version-matrix", "versions.json")]) {
    if (existsSync(p)) return { pins: JSON.parse(readFileSync(p, "utf8")), source: `${relative(process.cwd(), p)} (bundled copy)` };
  }
  throw new Error("No pins: live endpoint unreachable and no bundled pins.json. Pass --pins <path-to-versions.json>.");
}

// ---------- helpers ----------
function run(cmd, cmdArgs) {
  try {
    return execFileSync(cmd, cmdArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15000 }).trim();
  } catch {
    return null;
  }
}
const firstVersion = (s) => s?.match(/\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/)?.[0] ?? null;

function portOpen(port, host = "127.0.0.1") {
  return new Promise((done) => {
    const sock = createConnection({ port, host });
    const finish = (ok) => {
      sock.destroy();
      done(ok);
    };
    sock.setTimeout(1500, () => finish(false));
    sock.once("connect", () => finish(true));
    sock.once("error", () => finish(false));
  });
}

const SKIP = new Set(["node_modules", ".git", "dist", ".next", "build", ".turbo", "managed"]);
function findFiles(dir, test, depth = 4, out = []) {
  if (depth < 0) return out;
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (SKIP.has(e)) continue;
    const p = join(dir, e);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) findFiles(p, test, depth - 1, out);
    else if (test(e)) out.push(p);
  }
  return out;
}

const MIDNIGHT_PKG = /^@midnight-?ntwrk\//;

// ---------- checks ----------
function checkNode() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major >= 22) add("ok", "node", `Node.js ${process.versions.node}`);
  else if (major >= 18) add("warn", "node", `Node.js ${process.versions.node}: the templates in this repo are tested on Node 22`, "Use Node 22 LTS");
  else add("fail", "node", `Node.js ${process.versions.node} is too old (no global fetch)`, "Install Node 22 LTS");
}

function checkCompact(tc) {
  const devtools = firstVersion(run("compact", ["--version"]));
  if (!devtools) {
    add("fail", "compact", "`compact` not found on PATH", "Install the Compact devtools (midnight-environment-setup), then open a new shell");
    return;
  }
  add(devtools === tc.compactDevtools ? "ok" : "warn", "compact", `devtools ${devtools} (pinned ${tc.compactDevtools})`,
    devtools === tc.compactDevtools ? undefined : `Install devtools ${tc.compactDevtools} (see midnight-environment-setup)`);
  const toolchain = firstVersion(run("compact", ["compile", "--version"]));
  if (!toolchain) add("warn", "compact", "could not read `compact compile --version`", `compact update ${tc.compact}`);
  else
    add(toolchain === tc.compact ? "ok" : "fail", "compact", `toolchain ${toolchain} (pinned ${tc.compact})`,
      toolchain === tc.compact ? undefined : `compact update ${tc.compact}  (or compile with: compact compile +${tc.compact} ...)`);
}

async function checkDocker(tc) {
  const ver = run("docker", ["version", "--format", "{{.Server.Version}}"]);
  if (!ver) {
    add("warn", "docker", "Docker is not installed or the daemon is not running", "Start Docker Desktop / the Docker daemon (needed for the proof server and local devnet)");
  } else {
    add("ok", "docker", `Docker daemon ${ver}`);
    const images = (run("docker", ["ps", "--format", "{{.Image}}"]) || "").split("\n").filter(Boolean);
    for (const pinned of [tc.proofServer, tc.indexer, tc.node]) {
      const repo = pinned.slice(0, pinned.lastIndexOf(":"));
      const running = images.filter((i) => i.startsWith(repo + ":") || i === repo);
      if (!running.length) continue;
      for (const img of running)
        add(img === pinned ? "ok" : "fail", "docker", `running ${img} (pinned ${pinned})`, img === pinned ? undefined : `Restart it with ${pinned}`);
    }
  }
  const proof = await portOpen(6300);
  add(proof ? "ok" : "warn", "proof-server", proof ? "something is listening on localhost:6300" : "nothing on localhost:6300",
    proof ? undefined : `docker run -p 6300:6300 ${tc.proofServer} midnight-proof-server -v`);
}

function checkPackages(pins) {
  const pinned = { ...pins.packages, ...pins.nodePackages };
  const removed = pins.removed || {};
  const manifests = findFiles(PROJECT, (n) => n === "package.json", 3);
  if (!manifests.length) {
    add("info", "project", `no package.json under ${PROJECT}`);
    return;
  }
  for (const file of manifests) {
    const rel = relative(PROJECT, file) || "package.json";
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      add("warn", "project", `${rel}: not valid JSON`);
      continue;
    }
    const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
    const mid = Object.entries(deps).filter(([n]) => MIDNIGHT_PKG.test(n));
    if (!mid.length) continue;

    const scopes = new Set(mid.filter(([n]) => /midnight-js-/.test(n)).map(([n]) => n.split("/")[0]));
    if (scopes.size > 1)
      add("fail", "project", `${rel}: Midnight.js packages from both @midnight-ntwrk and @midnightntwrk`, "Use one scope per package as listed in midnight-version-matrix; two scopes load two ledger WASM copies");

    const before = results.filter((r) => r.status === "fail" || r.status === "warn").length;
    for (const [name, spec] of mid) {
      if (name in removed) {
        add("fail", "project", `${rel}: ${name} is removed (${removed[name]})`);
        continue;
      }
      const want = pinned[name];
      if (!want) {
        const other = name.startsWith("@midnight-ntwrk/") ? name.replace("@midnight-ntwrk/", "@midnightntwrk/") : name.replace("@midnightntwrk/", "@midnight-ntwrk/");
        if (pinned[other]) {
          add("fail", "project", `${rel}: ${name} is the wrong scope; the tested package is ${other}@${pinned[other]}`, `npm uninstall ${name} && npm install --save-exact ${other}@${pinned[other]}`);
          continue;
        }
        add("warn", "project", `${rel}: ${name}@${spec} has no tested pin`, "Check midnight-version-matrix; do not guess a version");
        continue;
      }
      const declared = String(spec).replace(/^[\^~=]/, "");
      if (/^[\^~]/.test(spec)) add("warn", "project", `${rel}: ${name}@${spec} is a range`, `Pin exactly: "${name}": "${want}"`);
      if (declared !== want && !/^[\^~]/.test(want)) add("fail", "project", `${rel}: ${name}@${spec} (pinned ${want})`, `npm install --save-exact ${name}@${want}`);
      const installedPath = join(dirname(file), "node_modules", ...name.split("/"), "package.json");
      if (existsSync(installedPath)) {
        const inst = JSON.parse(readFileSync(installedPath, "utf8")).version;
        if (inst !== want && !/^[\^~]/.test(want)) add("fail", "project", `${rel}: installed ${name} is ${inst} (pinned ${want})`, "Reinstall: rm -rf node_modules && npm ci");
      }
    }
    if (results.filter((r) => r.status === "fail" || r.status === "warn").length === before)
      add("ok", "project", `${rel}: ${mid.length} Midnight package(s) match the pins`);
  }

  // Duplicate compact-runtime copies cause "expected instance of ChargedState" / WASM identity errors
  const copies = new Set();
  const scan = (dir, depth) => {
    if (depth < 0 || !existsSync(dir)) return;
    const p = join(dir, "node_modules", "@midnight-ntwrk", "compact-runtime", "package.json");
    if (existsSync(p)) copies.add(JSON.parse(readFileSync(p, "utf8")).version + "  " + relative(PROJECT, p));
    for (const e of readdirSync(dir)) {
      if (SKIP.has(e) || e.startsWith(".")) continue;
      const sub = join(dir, e);
      try {
        if (statSync(sub).isDirectory()) scan(sub, depth - 1);
      } catch {
        /* ignore */
      }
    }
  };
  scan(PROJECT, 2);
  const versions = new Set([...copies].map((c) => c.split("  ")[0]));
  if (versions.size > 1)
    add("fail", "project", `several @midnight-ntwrk/compact-runtime versions installed:\n      ${[...copies].join("\n      ")}`, "Make every package resolve the pinned runtime (npm ls @midnight-ntwrk/compact-runtime)");
}

function checkPragmas(tc) {
  const files = findFiles(PROJECT, (n) => n.endsWith(".compact"), 5);
  const want = tc.languageVersion;
  const short = want.split(".").slice(0, 2).join(".");
  for (const f of files) {
    const m = readFileSync(f, "utf8").match(/pragma\s+language_version\s*([><=]+)\s*(\d+\.\d+(?:\.\d+)?)/);
    const rel = relative(PROJECT, f);
    if (!m) add("warn", "contracts", `${rel}: no pragma language_version`, `Add: pragma language_version >= ${want};`);
    else if (m[2] !== want && m[2] !== short) add("warn", "contracts", `${rel}: pragma ${m[1]} ${m[2]} (toolchain ${tc.compact} is language ${want})`, `pragma language_version >= ${want};`);
    else add("ok", "contracts", `${rel}: pragma ${m[1]} ${m[2]}`);
  }
}

// ---------- main ----------
let pinsInfo;
try {
  pinsInfo = await loadPins();
} catch (e) {
  console.error(`midnight-doctor: ${e.message}`);
  process.exit(2);
}
const { pins, source } = pinsInfo;
add("info", "pins", `using ${source}${pins.ledger ? ` (Ledger ${pins.ledger})` : ""}`);

checkNode();
checkCompact(pins.toolchain);
await checkDocker(pins.toolchain);
checkPackages(pins);
checkPragmas(pins.toolchain);

const fails = results.filter((r) => r.status === "fail").length;
const warns = results.filter((r) => r.status === "warn").length;

if (JSON_OUT) {
  console.log(JSON.stringify({ project: PROJECT, pinsSource: source, fails, warns, results }, null, 2));
} else {
  const icon = { ok: "OK  ", warn: "WARN", fail: "FAIL", info: "INFO" };
  console.log(`midnight-doctor — ${PROJECT}\n`);
  for (const r of results) {
    console.log(`  ${icon[r.status]}  [${r.area}] ${r.message}`);
    if (r.fix) console.log(`        fix: ${r.fix}`);
  }
  console.log(`\n${fails} fail, ${warns} warn`);
}
process.exit(fails ? 1 : 0);
