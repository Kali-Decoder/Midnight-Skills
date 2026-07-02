# MIDSKILLS Platform

Next.js marketplace UI for Midnight Network skills — WalrusSkills-style structure, powered by the parent repo's `skills.json` registry.

## Run locally

```bash
cd midskills
npm install
npm run dev
```

Open http://localhost:3000

## Structure (mirrors WalrusSkills)

| Route | Purpose |
|-------|---------|
| `/` | Landing — hero, stats, learning paths |
| `/browse` | Skills marketplace with search + filters |
| `/browse/[slug]` | Skill detail (SKILL.md rendered) |
| `/templates` | Runnable dApp templates |
| `/templates/[slug]` | Template detail + quick start |
| `/knowledge` | Shared references (`references/`) |
| `/paths` | Curated learning paths |
| `/get-started` | Install skills for AI agents |
| `/guide` | Contributor / usage guide |

Data is read from `../skills.json`, skill folders, `../templates/`, and `../references/`.
