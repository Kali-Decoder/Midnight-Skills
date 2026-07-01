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

function syncPackageJson(packageSkillDirs, site) {
  const pkgPath = join(ROOT, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  pkg.skills = packageSkillDirs.map((s) => './' + s.path.replace(/\/SKILL\.md$/, ''));
  if (site) {
    pkg.description = site.description;
    pkg.homepage = site.url;
    pkg.repository = site.repository;
    pkg.license = site.license;
    pkg.keywords = site.keywords || pkg.keywords;
  }
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

function authorLabel(authors) {
  return (authors || []).map((a) => a.name).join(', ');
}

function buildMetaJs(site) {
  const keywords = [
    'Midnight Network',
    'Compact',
    'zk-SNARKs',
    'privacy blockchain',
    'AI agents',
    'knowledge skills',
    'dApp',
    'web3',
    'confidential computing',
  ].join(', ');

  return `/**
 * Site metadata helper — SITE object synced from skills.json via npm run sync:registry
 */
(function () {
  const SITE = ${JSON.stringify(
    {
      name: site.name,
      tagline: site.tagline,
      description: site.description,
      url: site.url,
      repository: site.repository,
      license: site.license,
      themeColor: site.themeColor,
      ogImage: site.ogImage,
      keywords,
      authors: authorLabel(site.authors),
    },
    null,
    2,
  ).replace(/\n/g, '\n  ')};

  function upsertMeta(name, content, isProperty) {
    if (!content) return;
    const attr = isProperty ? 'property' : 'name';
    let el = document.head.querySelector('meta[' + attr + '="' + name + '"]');
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  function setLink(rel, href) {
    if (!href) return;
    let el = document.head.querySelector('link[rel="' + rel + '"]');
    if (!el) {
      el = document.createElement('link');
      el.rel = rel;
      document.head.appendChild(el);
    }
    el.href = href;
  }

  function buildTitle(pageTitle, kind) {
    if (kind === 'home' || !pageTitle) {
      return SITE.name + ' — ' + SITE.tagline;
    }
    return pageTitle + ' — ' + SITE.name;
  }

  function buildCanonical(path) {
    const base = SITE.url.replace(/\\/$/, '');
    if (!path || path === '/') return base + '/';
    return base + (path.startsWith('/') ? path : '/' + path);
  }

  window.SiteMeta = {
    site: SITE,
    apply(opts) {
      const kind = opts.kind || '';
      const title = buildTitle(opts.title, kind);
      const desc = opts.description || SITE.description;
      const type = opts.type || 'website';
      const canonical = buildCanonical(opts.path);

      document.title = title;
      upsertMeta('description', desc, false);
      upsertMeta('og:title', title, true);
      upsertMeta('og:description', desc, true);
      upsertMeta('og:type', type, true);
      upsertMeta('og:url', canonical, true);
      upsertMeta('og:site_name', SITE.name, true);
      upsertMeta('og:image', buildCanonical(SITE.ogImage), true);
      upsertMeta('twitter:card', 'summary', false);
      upsertMeta('twitter:title', title, false);
      upsertMeta('twitter:description', desc, false);
      upsertMeta('twitter:image', buildCanonical(SITE.ogImage), false);
      setLink('canonical', canonical);
    },
    initFromBody() {
      const b = document.body;
      if (!b || b.dataset.siteMeta !== 'auto') return;
      this.apply({
        kind: b.dataset.pageKind || '',
        title: b.dataset.pageTitle || '',
        description: b.dataset.pageDescription || SITE.description,
        path: b.dataset.pagePath || window.location.pathname + window.location.search,
        type: b.dataset.pageType || 'website',
      });
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SiteMeta.initFromBody());
  } else {
    SiteMeta.initFromBody();
  }
})();
`;
}

function syncSiteArtifacts(site) {
  if (!site?.name || !site?.url) {
    throw new Error('skills.json: missing site.name or site.url');
  }

  writeFileSync(join(ROOT, 'site.json'), JSON.stringify(site, null, 2) + '\n');
  writeFileSync(join(ROOT, 'meta.js'), buildMetaJs(site));
  console.log('Updated site.json and meta.js');

  const pluginPath = join(ROOT, '.claude-plugin', 'plugin.json');
  if (existsSync(pluginPath)) {
    const plugin = JSON.parse(readFileSync(pluginPath, 'utf-8'));
    plugin.description = site.description;
    plugin.homepage = site.url;
    plugin.repository = site.repository;
    plugin.license = site.license;
    plugin.keywords = site.keywords || plugin.keywords;
    plugin.author = {
      name: authorLabel(site.authors),
      url: (site.authors || []).map((a) => a.url).join(', '),
    };
    writeFileSync(pluginPath, JSON.stringify(plugin, null, 2) + '\n');
    console.log('Updated .claude-plugin/plugin.json');
  }

  const marketplacePath = join(ROOT, '.claude-plugin', 'marketplace.json');
  if (existsSync(marketplacePath)) {
    const marketplace = JSON.parse(readFileSync(marketplacePath, 'utf-8'));
    marketplace.metadata = marketplace.metadata || {};
    marketplace.metadata.description = site.description;
    if (marketplace.plugins?.[0]) {
      marketplace.plugins[0].description = site.description;
      marketplace.plugins[0].author = { name: authorLabel(site.authors) };
    }
    writeFileSync(marketplacePath, JSON.stringify(marketplace, null, 2) + '\n');
    console.log('Updated .claude-plugin/marketplace.json');
  }
}

function buildArchitectureBlock(site) {
  return [
    `- **Site:** [${site.name}](${site.url}) — static HTML, CSS, and JavaScript`,
    '- **Hosting:** [Netlify](https://www.netlify.com) (static deploy + serverless functions in `netlify/functions/`)',
    '- **API:** `/api/*` → Netlify functions (skill fetch, analytics, stats); `api/` also supports Vercel-style deployment',
    '- **Database:** MongoDB (optional download tracking); Supabase (optional analytics)',
    '- **Skills:** Markdown files served statically and via `/api/skill`',
  ].join('\n');
}

function buildDeploymentBlock(site) {
  return [
    `The site deploys to **Netlify** at [${site.url.replace(/^https?:\/\//, '')}](${site.url}). Push to \`main\` to trigger a deploy.`,
    '',
    'Set environment variables in your Netlify project (Site settings → Environment variables). MongoDB and Supabase are optional — the static site and skill browser work without them.',
    '',
    'For Vercel-style hosting, the `api/` folder can be used instead; set the same environment variables there.',
  ].join('\n');
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
  if (registry.site) {
    readme = replaceBlock(
      readme,
      '<!-- SKILLS_REGISTRY:ARCHITECTURE -->',
      '<!-- /SKILLS_REGISTRY:ARCHITECTURE -->',
      buildArchitectureBlock(registry.site),
    );
    readme = replaceBlock(
      readme,
      '<!-- SKILLS_REGISTRY:DEPLOYMENT -->',
      '<!-- /SKILLS_REGISTRY:DEPLOYMENT -->',
      buildDeploymentBlock(registry.site),
    );
  }
  writeFileSync(readmePath, readme);
  console.log('Updated README.md');

  const howtoPath = join(ROOT, 'howto.html');
  let howto = readFileSync(howtoPath, 'utf-8');
  howto = replaceBlock(howto, '<!-- SKILLS_REGISTRY:HOWTO_GRID -->', '<!-- /SKILLS_REGISTRY:HOWTO_GRID -->', buildHowtoGrid(registry.skills));
  writeFileSync(howtoPath, howto);
  console.log('Updated howto.html');

  syncPackageJson(packageSkills(registry.skills), registry.site);
  console.log('Updated package.json skills list');

  if (registry.site) {
    syncSiteArtifacts(registry.site);
  }

  console.log(`\nRegistry OK: ${registry.skills.length} skills (${enabledSkills(registry.skills).length} enabled in UI)`);
}

main();
