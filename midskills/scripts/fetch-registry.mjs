#!/usr/bin/env node
/**
 * Populate content/ from a local skills repo path or a GitHub release tarball.
 *
 * Usage:
 *   npm run fetch:registry                          # uses registry-version.txt
 *   npm run fetch:registry -- --local ../           # copy from monorepo parent
 *   npm run fetch:registry -- --release v1.0.0      # download GitHub release asset
 */
import { cpSync, createWriteStream, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { pipeline } from "node:stream/promises";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_DIR = join(ROOT, "content");
const CONFIG_PATH = join(ROOT, "registry.config.json");
const VERSION_PATH = join(ROOT, "registry-version.txt");

const SKIP_DIR_NAMES = new Set(["node_modules", ".next", ".git", "dist", ".turbo", "midskills", "content"]);

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`Missing ${relative(ROOT, CONFIG_PATH)}`);
  }
  return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
}

function readPinnedVersion() {
  if (!existsSync(VERSION_PATH)) return "local";
  return readFileSync(VERSION_PATH, "utf-8").trim() || "local";
}

function parseArgs(argv) {
  const args = { mode: null, value: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--local") {
      args.mode = "local";
      args.value = argv[i + 1] || process.env.REGISTRY_LOCAL_PATH || join(ROOT, "..");
      i += argv[i + 1] && !argv[i + 1].startsWith("--") ? 1 : 0;
    } else if (argv[i] === "--release") {
      args.mode = "release";
      args.value = argv[i + 1];
      if (!args.value) throw new Error("--release requires a version tag (e.g. v1.0.0)");
      i += 1;
    }
  }
  return args;
}

function copyTree(src, dest) {
  cpSync(src, dest, {
    recursive: true,
    filter: (source) => {
      const rel = relative(src, source);
      if (!rel) return true;
      return !rel.split(/[/\\]/).some((part) => SKIP_DIR_NAMES.has(part));
    },
  });
}

function loadSkillsManifest(sourceRoot) {
  const registryPath = join(sourceRoot, "skills.json");
  if (!existsSync(registryPath)) {
    throw new Error(`Missing skills.json in ${sourceRoot}`);
  }
  const registry = JSON.parse(readFileSync(registryPath, "utf-8"));
  if (!Array.isArray(registry.skills)) {
    throw new Error("skills.json: missing skills array");
  }
  return registry;
}

function copyFromLocal(sourceRoot) {
  const resolved = join(sourceRoot);
  if (!existsSync(resolved)) {
    throw new Error(`Local registry path does not exist: ${resolved}`);
  }

  const registry = loadSkillsManifest(resolved);
  rmSync(CONTENT_DIR, { recursive: true, force: true });
  mkdirSync(CONTENT_DIR, { recursive: true });

  const queue = ["skills.json", "SKILL.md", "references", "templates"];
  const copied = new Set();

  for (const skill of registry.skills) {
    if (skill.path) {
      const folder = skill.path.replace(/\/SKILL\.md$/, "");
      queue.push(folder || skill.path);
    }
    if (skill.templatePath) queue.push(skill.templatePath);
  }

  for (const item of queue) {
    if (copied.has(item)) continue;
    const abs = join(resolved, item);
    if (!existsSync(abs)) {
      throw new Error(`Missing registry path: ${item} (from ${resolved})`);
    }
    copyTree(abs, join(CONTENT_DIR, item));
    copied.add(item);
  }

  console.log(`Copied registry from ${resolved} → ${relative(ROOT, CONTENT_DIR)}/`);
}

async function downloadRelease(repository, version, assetPrefix) {
  const tag = version.startsWith("v") ? version : `v${version}`;
  const assetName = `${assetPrefix}-${tag}.tar.gz`;
  const url = `https://github.com/${repository}/releases/download/${tag}/${assetName}`;

  const tmpDir = join(ROOT, ".tmp-registry");
  const archivePath = join(tmpDir, assetName);
  mkdirSync(tmpDir, { recursive: true });

  console.log(`Downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download release asset (${response.status}): ${url}`);
  }

  await pipeline(response.body, createWriteStream(archivePath));

  rmSync(CONTENT_DIR, { recursive: true, force: true });
  mkdirSync(CONTENT_DIR, { recursive: true });

  execSync(`tar -xzf "${archivePath}" -C "${tmpDir}"`, { stdio: "inherit" });
  const extracted = join(tmpDir, "registry");
  if (!existsSync(join(extracted, "skills.json"))) {
    throw new Error(`Release archive did not contain registry/skills.json (${assetName})`);
  }

  copyTree(extracted, CONTENT_DIR);
  rmSync(tmpDir, { recursive: true, force: true });

  console.log(`Downloaded ${tag} → ${relative(ROOT, CONTENT_DIR)}/`);
}

async function main() {
  const config = loadConfig();
  const args = parseArgs(process.argv.slice(2));
  const pinned = readPinnedVersion();

  if (args.mode === "local") {
    copyFromLocal(args.value);
    return;
  }

  if (args.mode === "release") {
    await downloadRelease(config.repository, args.value, config.assetPrefix);
    return;
  }

  if (pinned === "local") {
    const localPath = process.env.REGISTRY_LOCAL_PATH || join(ROOT, "..");
    copyFromLocal(localPath);
    return;
  }

  await downloadRelease(config.repository, pinned, config.assetPrefix);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
