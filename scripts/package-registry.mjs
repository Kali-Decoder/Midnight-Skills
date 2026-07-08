#!/usr/bin/env node
/**
 * Build a portable registry bundle for the MIDSKILLS UI and other consumers.
 * Run: npm run package:registry
 */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { execSync } from "node:child_process";
import { loadRegistry, ROOT, validateRegistry } from "./registry-utils.mjs";

const OUT_DIR = join(ROOT, "dist", "registry");

const SKIP_DIR_NAMES = new Set(["node_modules", ".next", ".git", "dist", ".turbo"]);

function gitSha() {
  try {
    return execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
}

function copyTree(src, dest) {
  cpSync(src, dest, {
    recursive: true,
    filter: (source) => {
      const rel = relative(ROOT, source);
      if (!rel) return true;
      return !rel.split("/").some((part) => SKIP_DIR_NAMES.has(part));
    },
  });
}

function main() {
  const registry = loadRegistry();
  const errors = validateRegistry(registry);
  if (errors.length) {
    console.error("Cannot package invalid registry:\n" + errors.map((e) => `  - ${e}`).join("\n"));
    process.exit(1);
  }

  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  writeFileSync(join(OUT_DIR, "skills.json"), readFileSync(join(ROOT, "skills.json")));

  const copied = new Set();
  const queue = [".agents/skills/midnightskill/SKILL.md", "references", "templates"];

  for (const skill of registry.skills) {
    if (skill.path) {
      const folder = skill.path.replace(/\/SKILL\.md$/, "");
      queue.push(folder || skill.path);
    }
    if (skill.templatePath) queue.push(skill.templatePath);
  }

  for (const item of queue) {
    if (copied.has(item)) continue;
    const abs = join(ROOT, item);
    copyTree(abs, join(OUT_DIR, item));
    copied.add(item);
  }

  const version = process.env.REGISTRY_VERSION || process.env.GITHUB_REF_NAME || "dev";
  const manifest = {
    name: "midnight-skills-registry",
    version,
    commitSha: gitSha(),
    publishedAt: new Date().toISOString(),
    skillCount: registry.skills.length,
    site: registry.site ?? null,
  };

  writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  const distDir = join(ROOT, "dist");
  mkdirSync(distDir, { recursive: true });
  const archiveName = `midnight-skills-registry-${version}.tar.gz`;
  execSync(`tar -czf "${archiveName}" registry`, { cwd: distDir, stdio: "inherit" });

  console.log(`Packaged registry → ${relative(ROOT, OUT_DIR)}`);
  console.log(`Archive → dist/${archiveName}`);
}

main();
