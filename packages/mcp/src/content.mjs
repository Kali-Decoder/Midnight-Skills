/**
 * Read-only access to the MIDSKILLS content: skills.json, skill folders, shared references,
 * version pins, and the common-errors table. Everything is resolved from one content root:
 *
 *   1. MIDSKILLS_ROOT (a checkout of the Midnight-skills repo)
 *   2. the repo itself, when running from packages/mcp in a checkout
 *   3. ../content     (bundled into the npm package at prepack)
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const VERSIONS_URL = process.env.MIDSKILLS_VERSIONS_URL || "https://midskills.sevryn.xyz/api/versions";

export function findRoot() {
  const repo = join(HERE, "..", "..", "..");
  const inRepo = existsSync(join(repo, "packages", "mcp", "src", "content.mjs")) && existsSync(join(repo, "skills.json"));
  // In a checkout, always serve the live repo files, never a stale bundle.
  const candidates = [process.env.MIDSKILLS_ROOT, inRepo ? repo : null, join(HERE, "..", "content")].filter(Boolean);
  for (const c of candidates) if (existsSync(join(c, "skills.json"))) return resolve(c);
  throw new Error(`midskills-mcp: no skills.json found (tried ${candidates.join(", ")}). Set MIDSKILLS_ROOT to a Midnight-skills checkout.`);
}

/** Resolve `rel` inside `base`, refusing anything that escapes it. */
function safeJoin(base, rel) {
  const p = resolve(base, normalize(rel));
  if (p !== base && !p.startsWith(base + sep)) throw new Error(`path escapes the content root: ${rel}`);
  return p;
}

function listMarkdown(dir, base = dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? listMarkdown(p, base) : e.endsWith(".md") || e.endsWith(".json") ? [relative(base, p)] : [];
  });
}

function stripFrontmatter(md) {
  return md.replace(/^---\n[\s\S]*?\n---\n?/, "");
}

export class Content {
  constructor(root = findRoot()) {
    this.root = root;
    this.registry = JSON.parse(readFileSync(join(root, "skills.json"), "utf8"));
    this.skills = this.registry.skills.filter((s) => s.enabled !== false);
    this.byId = new Map(this.skills.map((s) => [s.id, s]));
    // Also resolve by folder name and SKILL.md `name:`, which is what agents usually have.
    for (const s of this.skills) {
      const folder = s.path.replace(/\/SKILL\.md$/, "").split("/").pop();
      if (!this.byId.has(folder)) this.byId.set(folder, s);
      const name = this.#frontmatterName(s);
      if (name && !this.byId.has(name)) this.byId.set(name, s);
    }
  }

  #frontmatterName(s) {
    try {
      return readFileSync(join(this.root, s.path), "utf8").slice(0, 600).match(/^name:\s*["']?([\w.-]+)/m)?.[1];
    } catch {
      return undefined;
    }
  }

  summary(s) {
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      category: s.category,
      track: s.track || "build",
      tags: s.tags || [],
      ...(s.templatePath ? { templatePath: s.templatePath } : {}),
    };
  }

  list({ category, track } = {}) {
    return this.skills
      .filter((s) => s.id !== "midnightskill")
      .filter((s) => !category || s.category === category)
      .filter((s) => !track || (s.track || "build") === track)
      .map((s) => this.summary(s));
  }

  /** Simple scored search over id, name, tags, description, task hint, then the SKILL.md body. */
  search(query, limit = 8) {
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
    if (!terms.length) return [];
    const scored = this.skills
      .filter((s) => s.id !== "midnightskill")
      .map((s) => {
        const meta = [s.id, s.name, ...(s.tags || []), s.taskHint || ""].join(" ").toLowerCase();
        const desc = (s.description || "").toLowerCase();
        let body = "";
        try {
          body = readFileSync(join(this.root, s.path), "utf8").toLowerCase();
        } catch {
          /* missing file */
        }
        let score = 0;
        for (const t of terms) {
          if (meta.includes(t)) score += 5;
          if (desc.includes(t)) score += 3;
          if (body.includes(t)) score += Math.min(3, body.split(t).length - 1) * 0.5;
        }
        return { s, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return scored.map(({ s, score }) => ({ ...this.summary(s), score: Math.round(score * 10) / 10 }));
  }

  resolve(idOrName) {
    const s = this.byId.get(String(idOrName).replace(/^midnight-skills:/, "").replace(/\/$/, ""));
    if (!s) throw new Error(`unknown skill "${idOrName}". Use list_skills or search_skills to find ids.`);
    return s;
  }

  skillDir(s) {
    return join(this.root, dirname(s.path));
  }

  getSkill(idOrName) {
    const s = this.resolve(idOrName);
    const dir = this.skillDir(s);
    return {
      ...this.summary(s),
      path: s.path,
      references: listMarkdown(join(dir, "references")).map((r) => `references/${r}`),
      content: stripFrontmatter(readFileSync(join(this.root, s.path), "utf8")),
    };
  }

  /**
   * A file referenced from a skill (`references/x.md`) or a shared repo reference
   * (`references/versions.json`, `references/gotchas.md`) when no skill is given.
   */
  getReference(path, skill) {
    const base = skill ? this.skillDir(this.resolve(skill)) : this.root;
    const rel = path.replace(/^\.?\//, "");
    if (!/\.(md|json)$/.test(rel)) throw new Error("only .md and .json references can be read");
    if (!skill && !rel.startsWith("references/")) throw new Error("without a skill, path must start with references/");
    const p = safeJoin(base, rel);
    if (!existsSync(p)) throw new Error(`not found: ${rel}${skill ? ` in skill ${skill}` : ""}`);
    return readFileSync(p, "utf8");
  }

  bundledVersions() {
    return JSON.parse(readFileSync(join(this.root, "references", "versions.json"), "utf8"));
  }

  async versions({ live = true } = {}) {
    if (live) {
      try {
        const res = await fetch(VERSIONS_URL, { signal: AbortSignal.timeout(4000), headers: { accept: "application/json" } });
        if (res.ok) {
          const v = await res.json();
          if (v?.toolchain && v?.packages) return { source: VERSIONS_URL, live: true, versions: v };
        }
      } catch {
        /* fall back */
      }
    }
    return { source: "bundled references/versions.json", live: false, versions: this.bundledVersions() };
  }

  errors() {
    const p = join(this.root, ".agents", "skills", "midnight-common-errors", "errors.json");
    return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : { layers: [], errors: [] };
  }

  /** Match an error message or code against the table. Codes match exactly; text matches by shared fragments. */
  lookupError(text) {
    const { errors, layers } = this.errors();
    const q = text.toLowerCase();
    const code = q.match(/custom error:\s*(\d+)/)?.[1] ?? (/^\s*\d{3}\s*$/.test(q) ? q.trim() : undefined);
    const scored = errors
      .map((e) => {
        let score = 0;
        if (code && e.code === code) score += 100;
        // Each " / "-separated alternative in `match` is tried on its own
        for (const alt of e.match.toLowerCase().replace(/`/g, "").split(/\s+\/\s+/)) {
          const a = alt.replace(/\s*\(.*?\)\s*/g, " ").replace(/\b[xy]\b/g, "").trim();
          if (a.length > 3 && q.includes(a)) score += 50;
          else {
            const words = a.split(/[^a-z0-9_]+/).filter((w) => w.length > 3);
            const hit = words.filter((w) => q.includes(w)).length;
            if (words.length && hit / words.length >= 0.6) score += 10 * hit;
          }
        }
        return { e, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    const layerTitle = new Map(layers.map((l) => [l.id, l.title]));
    return scored.map(({ e }) => ({ ...e, layer: layerTitle.get(e.layer) || e.layer }));
  }
}
