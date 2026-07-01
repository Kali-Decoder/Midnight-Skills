#!/usr/bin/env node
/**
 * Sync skill registry from skills.json into router docs, README, howto, and package.json.
 * Run: node scripts/sync-skill-registry.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY_PATH = join(ROOT, 'skills.json');

function loadRegistry() {
  const raw = readFileSync(REGISTRY_PATH, 'utf-8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data.skills)) throw new Error('skills.json: missing skills array');
  return data;
}

function enabledSkills(skills) {
  return skills.filter((s) => s.enabled !== false && s.listInRouter !== false);
}

function routerSkills(skills) {
  return enabledSkills(skills).filter((s) => s.id !== 'midnightskill');
}

function packageSkills(skills) {
  return skills.filter((s) => s.enabled !== false && s.listInPackage !== false && s.path.endsWith('/SKILL.md'));
}

function sortByName(a, b) {
  return a.name.localeCompare(b.name, 'en');
}

function replaceBlock(content, startMarker, endMarker, replacement) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Markers not found: ${startMarker}`);
  }
  return content.slice(0, start + startMarker.length) + '\n' + replacement + '\n' + content.slice(end);
}

function buildTaskTable(skills) {
  return routerSkills(skills)
    .filter((s) => s.taskHint)
    .map((s) => `| ${s.taskHint} | \`${s.id}/\` |`)
    .join('\n');
}

function buildRouterSections(skills) {
  return routerSkills(skills)
    .sort(sortByName)
    .map((s) => {
      const bullets = (s.routerBullets || [s.description]).map((b) => `- ${b}`).join('\n');
      return `### [${s.name}](/${s.path})\n${bullets}`;
    })
    .join('\n\n');
}

function buildReadmeTable(skills) {
  return routerSkills(skills)
    .sort(sortByName)
    .map((s) => `| [${s.name}](${s.path}) | ${s.description} |`)
    .join('\n');
}

function buildHowtoGrid(skills) {
  return routerSkills(skills)
    .sort(sortByName)
    .map(
      (s) =>
        `      <div class="dir-item">\n        <a href="skill.html?name=${s.id}">${s.name}</a>\n        <div class="dir-desc">${s.description}</div>\n      </div>`,
    )
    .join('\n');
}

function validatePaths(skills) {
  const errors = [];
  for (const s of skills) {
    if (!existsSync(join(ROOT, s.path))) {
      errors.push(`Missing file: ${s.path} (skill id: ${s.id})`);
    }
  }
  const ids = skills.map((s) => s.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) errors.push(`Duplicate skill ids: ${[...new Set(dupes)].join(', ')}`);
  if (errors.length) {
    console.error('Validation failed:\n' + errors.map((e) => `  - ${e}`).join('\n'));
    process.exit(1);
  }
}

function syncPackageJson(packageSkillDirs) {
  const pkgPath = join(ROOT, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  pkg.skills = packageSkillDirs.map((s) => './' + s.path.replace(/\/SKILL\.md$/, ''));
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

function main() {
  const registry = loadRegistry();
  validatePaths(registry.skills);

  const routerFiles = ['SKILL.md', 'AGENTS.md', 'CLAUDE.md'];
  const taskTable = buildTaskTable(registry.skills);
  const routerSections = buildRouterSections(registry.skills);

  for (const file of routerFiles) {
    const filePath = join(ROOT, file);
    let content = readFileSync(filePath, 'utf-8');
    content = replaceBlock(content, '<!-- SKILLS_REGISTRY:TASK_TABLE -->', '<!-- /SKILLS_REGISTRY:TASK_TABLE -->', taskTable);
    content = replaceBlock(content, '<!-- SKILLS_REGISTRY:SECTIONS -->', '<!-- /SKILLS_REGISTRY:SECTIONS -->', routerSections);
    writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }

  const readmePath = join(ROOT, 'README.md');
  let readme = readFileSync(readmePath, 'utf-8');
  readme = replaceBlock(readme, '<!-- SKILLS_REGISTRY:README_TABLE -->', '<!-- /SKILLS_REGISTRY:README_TABLE -->', buildReadmeTable(registry.skills));
  writeFileSync(readmePath, readme);
  console.log('Updated README.md');

  const howtoPath = join(ROOT, 'howto.html');
  let howto = readFileSync(howtoPath, 'utf-8');
  howto = replaceBlock(howto, '<!-- SKILLS_REGISTRY:HOWTO_GRID -->', '<!-- /SKILLS_REGISTRY:HOWTO_GRID -->', buildHowtoGrid(registry.skills));
  writeFileSync(howtoPath, howto);
  console.log('Updated howto.html');

  syncPackageJson(packageSkills(registry.skills));
  console.log('Updated package.json skills list');

  console.log(`\nRegistry OK: ${registry.skills.length} skills (${enabledSkills(registry.skills).length} enabled in UI)`);
}

main();
