#!/usr/bin/env node
/** Copy the repo's skill content into packages/mcp/content so the published package is self-contained. */
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = join(PKG, "..", "..");
const OUT = join(PKG, "content");

if (!existsSync(join(REPO, "skills.json"))) {
  console.error("bundle-content: run from inside the Midnight-skills repo (skills.json not found)");
  process.exit(1);
}
rmSync(OUT, { recursive: true, force: true });
cpSync(join(REPO, "skills.json"), join(OUT, "skills.json"));
cpSync(join(REPO, "references"), join(OUT, "references"), { recursive: true });
cpSync(join(REPO, ".agents", "skills"), join(OUT, ".agents", "skills"), {
  recursive: true,
  filter: (src) => !/[\\/](node_modules|dist|\.next)([\\/]|$)/.test(src),
});
console.log(`Bundled skills.json, references/, .agents/skills/ into ${OUT}`);
