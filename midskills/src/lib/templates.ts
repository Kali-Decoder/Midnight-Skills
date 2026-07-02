import fs from "fs";
import path from "path";
import { CATEGORY_LABELS } from "./constants";
import { inferDifficulty, loadRegistry } from "./registry";
import { REPO_ROOT } from "./paths";
import { resolveSkillTags } from "./tags";
import type { TemplateProfile } from "./template-types";

export type { TemplateProfile } from "./template-types";

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

export function getTemplateProfiles(): TemplateProfile[] {
  const registry = loadRegistry();
  return registry.skills
    .filter((s) => s.enabled !== false && s.templatePath)
    .map((s) => {
      const abs = path.join(REPO_ROOT, s.templatePath!);
      const readmePath = path.join(abs, "README.md");
      const categoryKey = s.category || "domain";
      return {
        slug: path.basename(s.templatePath!),
        name: s.name.replace(/^Example /, "") + " Template",
        description: s.description,
        skillId: s.id,
        skillSlug: s.id,
        path: s.templatePath!,
        readme: fs.existsSync(readmePath) ? fs.readFileSync(readmePath, "utf-8") : "",
        files: listFiles(abs),
        category: CATEGORY_LABELS[categoryKey] || categoryKey,
        difficulty: inferDifficulty(s.id, registry),
        tags: resolveSkillTags(s),
      };
    });
}

export function getTemplateProfile(slug: string): TemplateProfile | null {
  return getTemplateProfiles().find((t) => t.slug === slug) ?? null;
}
