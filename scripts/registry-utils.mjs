import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const REGISTRY_PATH = join(ROOT, "skills.json");

export function loadRegistry() {
  const raw = readFileSync(REGISTRY_PATH, "utf-8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data.skills)) throw new Error("skills.json: missing skills array");
  return data;
}

export function enabledSkills(skills) {
  return skills.filter((s) => s.enabled !== false && s.listInRouter !== false);
}

export function routerSkills(skills) {
  return enabledSkills(skills).filter((s) => s.id !== "midnightskill");
}

export function packageSkills(skills) {
  return skills.filter((s) => s.enabled !== false && s.listInPackage !== false && s.path.endsWith("/SKILL.md"));
}

/**
 * Audience tracks for the router and README. A skill's `track` defaults to "build".
 * Kept separate from `category`, which the MIDSKILLS UI uses for its fixed filter pills.
 */
export const TRACKS = [
  {
    id: "build",
    title: "Build a dApp",
    blurb: "Everything you need to write, test, and ship a Midnight dApp: setup, Compact, wallets, SDK, and full templates.",
  },
  {
    id: "protocol",
    title: "Protocol internals",
    blurb:
      "How the Midnight node works under the hood (consensus, storage, networking, runtime, RPC, transactions). For node operators and the protocol-curious. You do not need these to build a dApp.",
    groupTitle: "Node architecture",
    groupSubtitle: "Consensus, cryptography, runtime, P2P, RPC, storage, and transactions",
  },
];

export function trackOf(skill) {
  return skill.track || "build";
}

export function sortByName(a, b) {
  return a.name.localeCompare(b.name, "en");
}

export function validateRegistry(registry) {
  const errors = [];
  const skills = registry.skills;

  for (const s of skills) {
    if (!s.id?.trim()) errors.push(`Skill missing id (path: ${s.path ?? "unknown"})`);
    if (!s.path?.trim()) errors.push(`Skill missing path (id: ${s.id ?? "unknown"})`);
    if (s.path && !existsSync(join(ROOT, s.path))) {
      errors.push(`Missing file: ${s.path} (skill id: ${s.id})`);
    }
    if (s.track !== undefined && !TRACKS.some((t) => t.id === s.track)) {
      errors.push(`Unknown track "${s.track}" (skill id: ${s.id}); expected one of ${TRACKS.map((t) => t.id).join(", ")}`);
    }
    if (s.templatePath && !existsSync(join(ROOT, s.templatePath))) {
      errors.push(`Missing templatePath: ${s.templatePath} (skill id: ${s.id})`);
    }
  }

  const community = registry.community?.skills ?? [];
  errors.push(...validateCommunity(community));

  const ids = [...skills, ...community].map((s) => s.id).filter(Boolean);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) errors.push(`Duplicate skill ids: ${[...new Set(dupes)].join(", ")}`);

  if (!registry.site?.name) errors.push("skills.json: missing site.name");
  if (!registry.site?.repository) errors.push("skills.json: missing site.repository");

  return errors;
}

export function collectRegistryPaths(registry) {
  const paths = new Set(["skills.json", "SKILL.md", "references"]);

  for (const skill of registry.skills) {
    if (skill.path) {
      paths.add(skill.path);
      const folder = skill.path.replace(/\/SKILL\.md$/, "");
      if (folder && folder !== "SKILL.md") paths.add(folder);
    }
    if (skill.templatePath) paths.add(skill.templatePath);
  }

  return [...paths].sort();
}

/** Community skills live in other repos and are pinned to one commit. They are listed, never bundled. */
export const COMMUNITY_REQUIRED = ["id", "name", "author", "repository", "commit", "path", "description", "license"];

export function validateCommunity(entries) {
  const errors = [];
  for (const c of entries) {
    const at = `community skill ${c.id ?? c.name ?? "(unnamed)"}`;
    for (const k of COMMUNITY_REQUIRED) if (!String(c[k] ?? "").trim()) errors.push(`${at}: missing ${k}`);
    if (c.id && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.id)) errors.push(`${at}: id must be kebab-case`);
    if (c.repository && !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(c.repository))
      errors.push(`${at}: repository must be https://github.com/<owner>/<repo>`);
    if (c.commit && !/^[0-9a-f]{40}$/.test(c.commit)) errors.push(`${at}: commit must be a full 40-character SHA, not a branch or tag`);
    if (c.path && (!c.path.endsWith("SKILL.md") || c.path.includes("..") || c.path.startsWith("/")))
      errors.push(`${at}: path must be a relative path to a SKILL.md inside the repository`);
  }
  return errors;
}

export function communityUrls(c) {
  const repo = c.repository.replace(/^https:\/\/github\.com\//, "");
  return {
    blob: `https://github.com/${repo}/blob/${c.commit}/${c.path}`,
    raw: `https://raw.githubusercontent.com/${repo}/${c.commit}/${c.path}`,
  };
}
