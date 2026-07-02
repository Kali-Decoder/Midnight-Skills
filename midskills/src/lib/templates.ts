import "server-only";
import fs from "fs";
import path from "path";
import { CATEGORY_LABELS } from "./constants";
import { parseFrontmatter } from "./parse-frontmatter";
import { inferDifficulty, loadRegistry, type RegistrySkill } from "./registry";
import { REPO_ROOT } from "./paths";
import { resolveSkillTags } from "./tags";
import type { TemplateListItem, TemplateProfile } from "./template-types";

export type { TemplateListItem, TemplateProfile } from "./template-types";

function listFiles(dir: string, prefix = ""): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
    if (entry.isDirectory()) out.push(...listFiles(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

function buildRunnableProfile(entry: RegistrySkill): TemplateProfile | null {
  if (!entry.templatePath) return null;
  const abs = path.join(REPO_ROOT, entry.templatePath);
  if (!fs.existsSync(abs)) return null;

  const readmePath = path.join(abs, "README.md");
  const slug = path.basename(entry.templatePath);
  const categoryKey = entry.category || "full-template";

  return {
    slug,
    name: entry.name.replace(/^Example /, "") + " Template",
    description: entry.description,
    skillId: entry.id,
    skillSlug: entry.id,
    path: entry.templatePath,
    readme: fs.existsSync(readmePath) ? fs.readFileSync(readmePath, "utf-8") : "",
    files: listFiles(abs),
    category: CATEGORY_LABELS[categoryKey] || categoryKey,
    difficulty: inferDifficulty(entry.id, loadRegistry()),
    tags: resolveSkillTags(entry),
    runnable: true,
    detailHref: `/templates/${slug}`,
  };
}

function buildSkillTemplateProfile(entry: RegistrySkill): TemplateProfile | null {
  const skillFile = path.join(REPO_ROOT, entry.path);
  if (!fs.existsSync(skillFile)) return null;

  const skillFolder = path.dirname(entry.path);
  const absFolder = path.join(REPO_ROOT, skillFolder);
  const skillMd = fs.readFileSync(skillFile, "utf-8");
  const { body } = parseFrontmatter(skillMd);
  const readmePath = path.join(absFolder, "README.md");
  const readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, "utf-8") : body;
  const categoryKey = entry.category || "full-template";

  return {
    slug: entry.id,
    name: entry.name,
    description: entry.description,
    skillId: entry.id,
    skillSlug: entry.id,
    path: skillFolder,
    readme,
    files: listFiles(absFolder),
    category: CATEGORY_LABELS[categoryKey] || categoryKey,
    difficulty: inferDifficulty(entry.id, loadRegistry()),
    tags: resolveSkillTags(entry),
    runnable: false,
    detailHref: `/browse/${entry.id}`,
  };
}

/** All full-fledged templates: runnable repos + skill-guided full dApp templates */
export function getTemplateProfiles(): TemplateProfile[] {
  const registry = loadRegistry();
  return registry.skills
    .filter((s) => s.enabled !== false && s.category === "full-template")
    .map((entry) => (entry.templatePath ? buildRunnableProfile(entry) : buildSkillTemplateProfile(entry)))
    .filter(Boolean) as TemplateProfile[];
}

export function getTemplateCount(): number {
  return loadRegistry().skills.filter(
    (s) => s.enabled !== false && s.category === "full-template",
  ).length;
}

export function toTemplateListItem(template: TemplateProfile): TemplateListItem {
  return {
    slug: template.slug,
    name: template.name,
    description: template.description,
    skillId: template.skillId,
    skillSlug: template.skillSlug,
    path: template.path,
    fileCount: template.files.length,
    keyFiles: template.files.slice(0, 3),
    category: template.category,
    difficulty: template.difficulty,
    tags: template.tags,
    runnable: template.runnable,
    detailHref: template.detailHref,
    readmePreview: template.readme.slice(0, 2000),
  };
}

/** For /api/templates and client listing — no multi‑MB markdown payloads */
export function getTemplateListItems(): TemplateListItem[] {
  return getTemplateProfiles().map(toTemplateListItem);
}

export function getRunnableTemplateProfiles(): TemplateProfile[] {
  return getTemplateProfiles().filter((t) => t.runnable);
}

export function getTemplateProfile(slug: string): TemplateProfile | null {
  return getRunnableTemplateProfiles().find((t) => t.slug === slug) ?? null;
}
