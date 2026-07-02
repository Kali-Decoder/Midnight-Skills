import "server-only";
import fs from "fs";
import path from "path";
import { parseFrontmatter } from "./parse-frontmatter";
import { loadRegistry } from "./registry";
import { REPO_ROOT } from "./paths";
import type { KnowledgeArticle } from "./knowledge-types";

export type { KnowledgeArticle } from "./knowledge-types";

const REF_DIR = path.join(REPO_ROOT, "references");

export function getKnowledgeArticles(): KnowledgeArticle[] {
  if (!fs.existsSync(REF_DIR)) return [];
  const registry = loadRegistry();
  const defaultAuthor = registry.site?.authors?.[0]?.name ?? "MIDSKILLS";

  return fs
    .readdirSync(REF_DIR)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .map((file) => {
      const full = path.join(REF_DIR, file);
      const kbMd = fs.readFileSync(full, "utf-8");
      const slug = file.replace(/\.md$/, "");
      const { meta, body } = parseFrontmatter(kbMd);
      const title =
        (meta.title as string) ||
        (meta.name as string) ||
        slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const description =
        (meta.description as string) ||
        body.split("\n").find((l) => l.trim() && !l.startsWith("#"))?.trim().slice(0, 160) ||
        "";
      const tags = (meta.tags as string[]) || (meta.skills as string[]) || [];

      return {
        slug,
        title,
        description,
        body: kbMd.includes("---") ? body : kbMd,
        kbMd,
        path: `references/${file}`,
        meta: {
          category: (meta.category as string) || "Reference",
          author: (meta.author as string) || defaultAuthor,
          version: (meta.version as string) || "1.0.0",
          tags,
        },
      };
    });
}

export function getKnowledgeArticle(slug: string): KnowledgeArticle | null {
  return getKnowledgeArticles().find((a) => a.slug === slug) ?? null;
}
