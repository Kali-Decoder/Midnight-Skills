#!/usr/bin/env node
/**
 * Keep every Midnight version literal in skills and references equal to references/versions.json.
 *
 *   npm run check:versions   report drift, exit 1 if any
 *   npm run sync:versions    rewrite drifted literals from versions.json (unknown/removed packages still fail)
 *
 * Checked forms:
 *   @scope/pkg@1.2.3                      "@scope/pkg": "1.2.3"
 *   midnightntwrk/proof-server:9.0.2      (also indexer-standalone, midnight-node)
 *   compact update 0.36.1                 compact compile +0.36.1
 *   releases/download/compact-v0.5.1/     pragma language_version >= 0.28.0
 *
 * A line containing <!-- pin-ok --> is skipped (use it for deliberate examples of a wrong or third-party version).
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const PINS_FILE = join(ROOT, "references", "versions.json");
const SCAN_DIRS = [join(ROOT, ".agents", "skills"), join(ROOT, "references")];
const ALLOW_MARKER = "<!-- pin-ok -->";
const FIX = process.argv.includes("--fix");

const pins = JSON.parse(readFileSync(PINS_FILE, "utf8"));
const pkgPins = { ...pins.packages, ...pins.nodePackages };
const removed = pins.removed ?? {};
const tc = pins.toolchain;
const dockerPins = Object.fromEntries(
  [tc.proofServer, tc.indexer, tc.node].map((img) => {
    const i = img.lastIndexOf(":");
    return [img.slice(0, i), img.slice(i + 1)];
  }),
);

const VER = String.raw`\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?`;
const NAME = String.raw`@midnight-?ntwrk\/[a-z0-9-]+`;

/** Each rule: regex with named groups `pre` (kept), `ver` (checked), optional `name`; expected(m) returns the pin or an error. */
const rules = [
  {
    re: new RegExp(String.raw`(?<pre>(?<name>${NAME})@)(?<ver>[\^~]?${VER})`, "g"),
    expected: (g) => pkgExpected(g.name),
  },
  {
    re: new RegExp(String.raw`(?<pre>"(?<name>${NAME})"\s*:\s*")(?<ver>[\^~]?${VER})(?=")`, "g"),
    expected: (g) => pkgExpected(g.name),
  },
  {
    re: new RegExp(String.raw`(?<pre>(?<name>midnightntwrk\/(?:proof-server|indexer-standalone|midnight-node)):)(?<ver>${VER})`, "g"),
    expected: (g) => ({ want: dockerPins[g.name] }),
  },
  {
    re: new RegExp(String.raw`(?<pre>compact update )(?<ver>${VER})`, "g"),
    expected: () => ({ want: tc.compact }),
  },
  {
    re: new RegExp(String.raw`(?<pre>compact compile \+)(?<ver>${VER})`, "g"),
    expected: () => ({ want: tc.compact }),
  },
  {
    re: new RegExp(String.raw`(?<pre>releases\/download\/compact-v)(?<ver>${VER})`, "g"),
    expected: () => ({ want: tc.compactDevtools }),
  },
  {
    re: new RegExp(String.raw`(?<pre>pragma language_version\s*>=\s*)(?<ver>\d+\.\d+(?:\.\d+)?)`, "g"),
    // `>= 0.28` and `>= 0.28.0` are both valid for language 0.28.0
    expected: (g) => ({ want: tc.languageVersion, alsoOk: [tc.languageVersion.split(".").slice(0, 2).join(".")] }),
  },
];

function pkgExpected(name) {
  if (name in removed) return { error: `removed package ${name}: ${removed[name]}` };
  if (!(name in pkgPins)) return { error: `unknown package ${name}: add it to references/versions.json (verify with npm view) or drop it` };
  return { want: pkgPins[name] };
}

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".md") ? [p] : [];
  });
}

const problems = [];
let checked = 0;
let fixed = 0;

for (const file of SCAN_DIRS.flatMap(walk)) {
  const rel = relative(ROOT, file);
  const lines = readFileSync(file, "utf8").split("\n");
  let changed = false;

  lines.forEach((line, i) => {
    if (line.includes(ALLOW_MARKER)) return;
    let out = line;
    for (const rule of rules) {
      out = out.replace(rule.re, (...args) => {
        const match = args[0];
        const g = args.at(-1);
        checked++;
        const exp = rule.expected(g);
        if (exp.error) {
          problems.push(`${rel}:${i + 1}  ${match}  -> ${exp.error}`);
          return match;
        }
        if (exp.want === undefined || g.ver === exp.want || exp.alsoOk?.includes(g.ver)) return match;
        if (FIX) {
          fixed++;
          return g.pre + exp.want;
        }
        problems.push(`${rel}:${i + 1}  ${match}  -> expected ${exp.want}`);
        return match;
      });
    }
    if (out !== line) {
      lines[i] = out;
      changed = true;
    }
  });

  if (changed) writeFileSync(file, lines.join("\n"));
}

if (FIX && fixed) console.log(`Rewrote ${fixed} literal(s) from references/versions.json`);
if (problems.length) {
  console.error(`Version check failed (${problems.length}):\n` + problems.map((p) => `  - ${p}`).join("\n"));
  console.error(`\nreferences/versions.json is the single source of truth. Run \`npm run sync:versions\` to fix mismatches;` +
    ` mark deliberate examples with ${ALLOW_MARKER}.`);
  process.exit(1);
}
console.log(`Versions OK: ${checked} literal(s) match references/versions.json`);
