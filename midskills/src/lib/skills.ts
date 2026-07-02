import "server-only";
import fs from "fs";
import path from "path";
import { CATEGORY_LABELS } from "./constants";
import { parseFrontmatter } from "./parse-frontmatter";
import { inferDifficulty, loadRegistry, type RegistrySkill } from "./registry";
import { REPO_ROOT } from "./paths";
import { resolveSkillTags } from "./tags";
import type { HeroSkillItem } from "./hero-skill-types";
import type { SkillProfile } from "./skill-types";

export type { SkillProfile } from "./skill-types";

function buildProfile(
  entry: RegistrySkill,
  skillMd: string,
  body: string,
  meta: Record<string, unknown>,
  readmeMd: string,
): SkillProfile {
  const registry = loadRegistry();
  const categoryKey = entry.category || "domain";
  const frontmatterSkills = (meta.skills as string[]) || [];
  const skills = resolveSkillTags(entry, frontmatterSkills);
  const defaultAuthor = registry.site?.authors?.[0]?.name ?? "MIDSKILLS";

  return {
    slug: entry.id,
    skillMd,
    readmeMd,
    rawPath: entry.path,
    folderName: path.dirname(entry.path),
    body,
    meta: {
      name: entry.name,
      description: entry.description,
      category: CATEGORY_LABELS[categoryKey] || categoryKey,
      difficulty: inferDifficulty(entry.id, registry),
      featured: Boolean(entry.featured),
      templatePath: entry.templatePath,
      taskHint: entry.taskHint,
      skills,
      author: (meta.author as string) || defaultAuthor,
      version: (meta.version as string) || "1.0.0",
      allowedTools: (meta["allowed-tools"] as string[]) || [],
    },
  };
}

function readSkillProfile(entry: RegistrySkill): SkillProfile | null {
  const filePath = path.join(REPO_ROOT, entry.path);
  if (!fs.existsSync(filePath)) return null;

  const skillMd = fs.readFileSync(filePath, "utf-8");
  const { meta, body } = parseFrontmatter(skillMd);
  const readmePath = path.join(path.dirname(filePath), "README.md");
  const readmeMd = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, "utf-8") : "";

  return buildProfile(entry, skillMd, body, meta, readmeMd);
}

export function getSkillProfiles(): SkillProfile[] {
  const registry = loadRegistry();
  return registry.skills
    .filter((s) => s.enabled !== false && s.listInRouter !== false && s.id !== "midnightskill")
    .map((entry) => readSkillProfile(entry))
    .filter(Boolean) as SkillProfile[];
}

export function getSkillProfile(slug: string): SkillProfile | null {
  const registry = loadRegistry();
  const entry = registry.skills.find((s) => s.id === slug);
  if (!entry || entry.enabled === false) return null;
  return readSkillProfile(entry);
}

export function getFeaturedHeroSkills(limit = 6): HeroSkillItem[] {
  return getSkillProfiles()
    .filter((p) => p.meta.featured)
    .slice(0, limit)
    .map((p) => ({
      slug: p.slug,
      name: p.meta.name,
      category: p.meta.category,
      difficulty: p.meta.difficulty,
      tag: p.meta.skills[0] ?? "Midnight",
    }));
}
