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
} from "./registry-utils.mjs";

function replaceBlock(content, startMarker, endMarker, replacement) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Markers not found: ${startMarker}`);
  }
  return content.slice(0, start + startMarker.length) + "\n" + replacement + "\n" + content.slice(end);
}

function buildTaskTable(skills) {
  return routerSkills(skills)
    .filter((s) => s.taskHint)
    .map((s) => `| ${s.taskHint} | \`${s.id}/\` |`)
    .join("\n");
}

function buildRouterSections(skills) {
  return routerSkills(skills)
    .sort(sortByName)
    .map((s) => {
      const bullets = (s.routerBullets || [s.description]).map((b) => `- ${b}`).join("\n");
      return `### [${s.name}](/${s.path})\n${bullets}`;
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

function buildReadmeTable(skills) {
  const grouped = new Map();
  for (const skill of routerSkills(skills)) {
    const category = skill.category || "foundation";
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(skill);
  }

  const sections = [];
  for (const category of README_CATEGORY_ORDER) {
    const items = grouped.get(category);
    if (!items?.length) continue;
    items.sort(sortByName);
    const meta = README_CATEGORY_META[category] || { title: category, subtitle: "" };
    const rows = items
      .map((s) => `| [${s.name}](${s.path}) | ${s.description} |`)
      .join("\n");
    sections.push(
      [
        `<details>`,
        `<summary><strong>${meta.title}</strong> — ${items.length} skill${items.length === 1 ? "" : "s"}${meta.subtitle ? ` · ${meta.subtitle}` : ""}</summary>`,
        ``,
        `| Skill | Description |`,
        `|-------|-------------|`,
        rows,
        ``,
        `</details>`,
      ].join("\n"),
    );
  }

  return sections.join("\n\n");
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

function syncPluginMetadata(site) {
  const pluginPath = join(ROOT, ".claude-plugin", "plugin.json");
  if (existsSync(pluginPath)) {
    const plugin = JSON.parse(readFileSync(pluginPath, "utf-8"));
    plugin.description = site.description;
    plugin.homepage = site.url;
    plugin.repository = site.repository;
    plugin.license = site.license;
    plugin.keywords = site.keywords || plugin.keywords;
    plugin.author = {
      name: authorLabel(site.authors),
      url: (site.authors || []).map((a) => a.url).join(", "),
    };
    writeFileSync(pluginPath, JSON.stringify(plugin, null, 2) + "\n");
    console.log("Updated .claude-plugin/plugin.json");
  }

  const marketplacePath = join(ROOT, ".claude-plugin", "marketplace.json");
  if (existsSync(marketplacePath)) {
    const marketplace = JSON.parse(readFileSync(marketplacePath, "utf-8"));
    marketplace.metadata = marketplace.metadata || {};
    marketplace.metadata.description = site.description;
    if (marketplace.plugins?.[0]) {
      marketplace.plugins[0].description = site.description;
      marketplace.plugins[0].author = { name: authorLabel(site.authors) };
    }
    writeFileSync(marketplacePath, JSON.stringify(marketplace, null, 2) + "\n");
    console.log("Updated .claude-plugin/marketplace.json");
  }
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
  const registry = loadRegistry();
  const errors = validateRegistry(registry);
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
      content = replaceBlock(content, "<!-- SKILLS_REGISTRY:TASK_TABLE -->", "<!-- /SKILLS_REGISTRY:TASK_TABLE -->", taskTable);
      content = replaceBlock(content, "<!-- SKILLS_REGISTRY:SECTIONS -->", "<!-- /SKILLS_REGISTRY:SECTIONS -->", routerSections);
      writeFileSync(filePath, content);
      console.log(`Updated ${filePath}`);
    }
  }

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
  writeFileSync(readmePath, readme);
  console.log("Updated README.md");

  syncPackageJson(packageSkills(registry.skills), registry.site);
  console.log("Updated package.json skills list");

  if (registry.site) {
    syncPluginMetadata(registry.site);
  }

  console.log(`\nRegistry OK: ${registry.skills.length} skills`);
}

main();
