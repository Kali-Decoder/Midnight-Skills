#!/usr/bin/env node
/**
 * Sync skill registry from skills.json into router docs, README, and package.json.
 * Run: npm run sync:registry
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  ROOT,
  loadRegistry,
  routerSkills,
  packageSkills,
  sortByName,
  validateRegistry,
  TRACKS,
  trackOf,
  communityUrls,
} from "./registry-utils.mjs";
import { buildVersionMatrix, loadErrors, validateErrors, buildErrorTables, ERRORS_PATH } from "./generated-skills.mjs";

function replaceBlock(content, startMarker, endMarker, replacement) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Markers not found: ${startMarker}`);
  }
  return content.slice(0, start + startMarker.length) + "\n" + replacement + "\n" + content.slice(end);
}

/** Router skills split by track, in TRACKS order, skipping empty tracks. */
function byTrack(skills) {
  const router = routerSkills(skills);
  return TRACKS.map((track) => ({ track, items: router.filter((s) => trackOf(s) === track.id) })).filter(
    (g) => g.items.length,
  );
}

function buildTaskTable(skills) {
  return byTrack(skills)
    .map(({ track, items }) => {
      const rows = items
        .filter((s) => s.taskHint)
        .map((s) => `| ${s.taskHint} | \`${s.id}/\` |`)
        .join("\n");
      return [
        `### ${track.title}`,
        ``,
        track.blurb,
        ``,
        `| I'm doing... | Fetch these skills |`,
        `|--------------|-------------------|`,
        rows,
      ].join("\n");
    })
    .join("\n\n");
}

function buildRouterSections(skills) {
  return byTrack(skills)
    .map(({ track, items }) => {
      const sections = items
        .sort(sortByName)
        .map((s) => {
          const bullets = (s.routerBullets || [s.description]).map((b) => `- ${b}`).join("\n");
          return `### [${s.name}](/${s.path})\n${bullets}`;
        })
        .join("\n\n");
      return `## Skills: ${track.title}\n\n${sections}`;
    })
    .join("\n\n");
}

const README_CATEGORY_ORDER = ["foundation", "wallet", "sdk", "domain", "full-template"];

const README_CATEGORY_META = {
  foundation: {
    title: "Foundation",
    subtitle: "Environment setup, privacy model, Compact language, and testing",
  },
  wallet: {
    title: "Wallet & Integration",
    subtitle: "1AM wallet and React connector flows",
  },
  sdk: {
    title: "SDK & Data",
    subtitle: "midnight-js, indexer, and security patterns",
  },
  domain: {
    title: "Domain & Tokens",
    subtitle: "NFTs, token transfers, and platform-specific guides",
  },
  "full-template": {
    title: "Full dApp Templates",
    subtitle: "End-to-end reference apps with contracts and frontends",
  },
};

function readmeGroup(title, subtitle, items) {
  items.sort(sortByName);
  const rows = items.map((s) => `| [${s.name}](${s.path}) | ${s.description} |`).join("\n");
  return [
    `<details>`,
    `<summary><strong>${title}</strong> — ${items.length} skill${items.length === 1 ? "" : "s"}${subtitle ? ` · ${subtitle}` : ""}</summary>`,
    ``,
    `| Skill | Description |`,
    `|-------|-------------|`,
    rows,
    ``,
    `</details>`,
  ].join("\n");
}

function buildReadmeTable(skills) {
  return byTrack(skills)
    .map(({ track, items }) => {
      let groups;
      if (track.groupTitle) {
        // A track with its own group title is listed as one group, whatever the skills' categories are.
        groups = [readmeGroup(track.groupTitle, track.groupSubtitle, items)];
      } else {
        const grouped = new Map();
        for (const skill of items) {
          const category = skill.category || "foundation";
          if (!grouped.has(category)) grouped.set(category, []);
          grouped.get(category).push(skill);
        }
        groups = README_CATEGORY_ORDER.filter((c) => grouped.get(c)?.length).map((category) => {
          const meta = README_CATEGORY_META[category] || { title: category, subtitle: "" };
          return readmeGroup(meta.title, meta.subtitle, grouped.get(category));
        });
      }
      return [`### ${track.title}`, ``, track.blurb, ``, groups.join("\n\n")].join("\n");
    })
    .join("\n\n");
}

function buildReadmeLearningPaths(registry) {
  const byId = new Map(registry.skills.map((s) => [s.id, s]));
  return (registry.learningPaths || [])
    .map((path) => {
      const steps = (path.steps || [])
        .map((step, index) => {
          const skill = byId.get(step.skillId);
          if (!skill) return `${index + 1}. **${step.skillId}** — ${step.summary}`;
          return `${index + 1}. **[${skill.name}](${skill.path})** — ${step.summary}`;
        })
        .join("\n");
      return `### ${path.title}\n\n${steps}`;
    })
    .join("\n\n");
}

function syncPackageJson(packageSkillDirs, site) {
  const pkgPath = join(ROOT, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  pkg.skills = packageSkillDirs.map((s) => "./" + s.path.replace(/\/SKILL\.md$/, ""));
  if (site) {
    pkg.description = site.description;
    pkg.homepage = site.url;
    pkg.repository = site.repository;
    pkg.license = site.license;
    pkg.keywords = site.keywords || pkg.keywords;
  }
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

function authorLabel(authors) {
  return (authors || []).map((a) => a.name).join(", ");
}

/** Skill folders shipped in the Claude plugin: the router plus every packaged skill. */
function pluginSkillDirs(skills) {
  const router = skills.find((s) => s.id === "midnightskill" && s.enabled !== false);
  const dirs = [router, ...packageSkills(skills)].filter(Boolean).map((s) => "./" + s.path.replace(/\/SKILL\.md$/, ""));
  return [...new Set(dirs)];
}

/**
 * Regenerate .claude-plugin/plugin.json from skills.json + package.json (version).
 * Hooks are not listed: Claude Code loads hooks/hooks.json from the plugin root by default,
 * and declaring the default path again is reported as a duplicate.
 */
function syncPluginMetadata(registry) {
  const site = registry.site;
  const version = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")).version;
  const pluginPath = join(ROOT, ".claude-plugin", "plugin.json");
  const plugin = {
    name: "midnight-skills",
    version,
    description: site.description,
    author: {
      name: authorLabel(site.authors),
      url: (site.authors || [])[0]?.url,
    },
    homepage: site.url,
    repository: site.repository,
    license: site.license,
    keywords: site.keywords || [],
    skills: pluginSkillDirs(registry.skills),
  };
  writeFileSync(pluginPath, JSON.stringify(plugin, null, 2) + "\n");
  console.log(`Updated .claude-plugin/plugin.json (${plugin.skills.length} skills, v${version})`);

  const marketplacePath = join(ROOT, ".claude-plugin", "marketplace.json");
  if (existsSync(marketplacePath)) {
    const marketplace = JSON.parse(readFileSync(marketplacePath, "utf-8"));
    marketplace.metadata = marketplace.metadata || {};
    marketplace.metadata.description = site.description;
    marketplace.metadata.version = version;
    if (marketplace.plugins?.[0]) {
      marketplace.plugins[0].description = site.description;
      marketplace.plugins[0].version = version;
      marketplace.plugins[0].author = { name: authorLabel(site.authors) };
    }
    writeFileSync(marketplacePath, JSON.stringify(marketplace, null, 2) + "\n");
    console.log("Updated .claude-plugin/marketplace.json");
  }
}

function buildCommunityBlock(registry) {
  const community = registry.community || {};
  const items = [...(community.skills || [])].sort(sortByName);
  const intro = community.description ? community.description + "\n\n" : "";
  if (!items.length) {
    return intro + "_No community skills yet. Be the first: see [Community skills](CONTRIBUTING.md#community-skills)._";
  }
  const rows = items
    .map((c) => {
      const { blob } = communityUrls(c);
      return `| [${c.name}](${blob}) | ${c.description} | ${c.author} | \`${c.commit.slice(0, 7)}\` |`;
    })
    .join("\n");
  return intro + ["| Skill | Description | Author | Pinned commit |", "|-------|-------------|--------|---------------|", rows].join("\n");
}

function buildArchitectureBlock(site) {
  return [
    `- **Registry:** \`skills.json\` — single source of truth for skills, learning paths, and site metadata`,
    `- **Content:** Skill folders, \`references/\`, and \`templates/\` in this repository`,
    `- **CI:** GitHub Actions validate on PR; publish a versioned registry bundle on release tags`,
    `- **UI:** [${site.name}](${site.url}) Next.js app (separate repo) consumes the published registry at build time`,
    `- **Agents:** Install skill folders via npm package or fetch from GitHub`,
  ].join("\n");
}

function buildRegistryBlock() {
  return [
    "1. Edit `skills.json` and skill folders",
    "2. Run `npm run validate:registry`",
    "3. Run `npm run sync:registry` to update router docs and `package.json`",
    "4. Open a PR — CI validates the registry",
    "5. Tag `v*` on `main` to publish `midnight-skills-registry-<version>.tar.gz` as a GitHub Release asset",
  ].join("\n");
}

function main() {
  // Generated skills first, so the registry validation below sees their SKILL.md files.
  buildVersionMatrix();
  console.log("Updated midnight-version-matrix (SKILL.md, versions.json) and midnight-doctor/pins.json");

  const registry = loadRegistry();
  const errors = validateRegistry(registry);
  const errorData = loadErrors();
  errors.push(...validateErrors(errorData, new Set(registry.skills.map((s) => s.id))));
  if (errors.length) {
    console.error("Validation failed:\n" + errors.map((e) => `  - ${e}`).join("\n"));
    process.exit(1);
  }

  const routerFiles = ["SKILL.md", "AGENTS.md", "CLAUDE.md", "llms.txt"];
  const taskTable = buildTaskTable(registry.skills);
  const routerSections = buildRouterSections(registry.skills);

  for (const file of routerFiles) {
    const locations = file === "SKILL.md"
      ? [join(ROOT, file), join(ROOT, ".agents/skills/midnightskill", file)]
      : [join(ROOT, file)];
    for (const filePath of locations) {
      if (!existsSync(filePath)) continue;
      let content = readFileSync(filePath, "utf-8");
      // Skip router files that don't opt in with markers (e.g. graft's AGENTS.md).
      if (!content.includes("<!-- SKILLS_REGISTRY:TASK_TABLE -->")) continue;
      content = replaceBlock(content, "<!-- SKILLS_REGISTRY:TASK_TABLE -->", "<!-- /SKILLS_REGISTRY:TASK_TABLE -->", taskTable);
      content = replaceBlock(content, "<!-- SKILLS_REGISTRY:SECTIONS -->", "<!-- /SKILLS_REGISTRY:SECTIONS -->", routerSections);
      writeFileSync(filePath, content);
      console.log(`Updated ${filePath}`);
    }
  }

  const errorsSkill = join(ERRORS_PATH, "..", "SKILL.md");
  writeFileSync(
    errorsSkill,
    replaceBlock(readFileSync(errorsSkill, "utf-8"), "<!-- SKILLS_REGISTRY:ERRORS -->", "<!-- /SKILLS_REGISTRY:ERRORS -->", buildErrorTables(errorData, registry.skills)),
  );
  console.log(`Updated midnight-common-errors tables (${errorData.errors.length} errors)`);

  const readmePath = join(ROOT, "README.md");
  let readme = readFileSync(readmePath, "utf-8");
  readme = replaceBlock(readme, "<!-- SKILLS_REGISTRY:README_TABLE -->", "<!-- /SKILLS_REGISTRY:README_TABLE -->", buildReadmeTable(registry.skills));
  readme = replaceBlock(
    readme,
    "<!-- SKILLS_REGISTRY:LEARNING_PATHS -->",
    "<!-- /SKILLS_REGISTRY:LEARNING_PATHS -->",
    buildReadmeLearningPaths(registry),
  );
  if (registry.site) {
    readme = replaceBlock(
      readme,
      "<!-- SKILLS_REGISTRY:ARCHITECTURE -->",
      "<!-- /SKILLS_REGISTRY:ARCHITECTURE -->",
      buildArchitectureBlock(registry.site),
    );
    readme = replaceBlock(
      readme,
      "<!-- SKILLS_REGISTRY:REGISTRY -->",
      "<!-- /SKILLS_REGISTRY:REGISTRY -->",
      buildRegistryBlock(),
    );
  }
  readme = replaceBlock(readme, "<!-- SKILLS_REGISTRY:COMMUNITY -->", "<!-- /SKILLS_REGISTRY:COMMUNITY -->", buildCommunityBlock(registry));
  writeFileSync(readmePath, readme);
  console.log("Updated README.md");

  syncPackageJson(packageSkills(registry.skills), registry.site);
  console.log("Updated package.json skills list");

  // midskills-mcp is versioned with the skills it serves.
  const mcpPkgPath = join(ROOT, "packages", "mcp", "package.json");
  if (existsSync(mcpPkgPath)) {
    const rootVersion = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")).version;
    const mcpPkg = JSON.parse(readFileSync(mcpPkgPath, "utf-8"));
    if (mcpPkg.version !== rootVersion) {
      mcpPkg.version = rootVersion;
      writeFileSync(mcpPkgPath, JSON.stringify(mcpPkg, null, 2) + "\n");
    }
    console.log(`midskills-mcp version ${rootVersion}`);
  }

  if (registry.site) {
    syncPluginMetadata(registry);
  }

  console.log(`\nRegistry OK: ${registry.skills.length} skills`);
}

main();
