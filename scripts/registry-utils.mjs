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
    if (s.templatePath && !existsSync(join(ROOT, s.templatePath))) {
      errors.push(`Missing templatePath: ${s.templatePath} (skill id: ${s.id})`);
    }
  }

  const ids = skills.map((s) => s.id).filter(Boolean);
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
