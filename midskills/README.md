# MIDSKILLS Platform

Private Next.js marketplace UI for Midnight Network skills. Skill content is **not** stored in this repo — it is fetched at build/dev time from the public [Midnight-skills](https://github.com/Kali-Decoder/Midnight-skills) registry.

## Prerequisites

- Node.js >= 22
- pnpm (recommended) or npm

## Quick start

```bash
pnpm install
cp .env.example .env   # add GitHub OAuth, SESSION_SECRET, MongoDB
pnpm dev
```

`predev` runs `fetch:registry` automatically and populates `content/` from the pinned registry.

Open http://localhost:3000

## Registry pin

`registry-version.txt` controls which skills snapshot the UI uses:

| Value | Behavior |
|-------|----------|
| `local` | Copy from `../` (monorepo) or `REGISTRY_LOCAL_PATH` |
| `v1.0.0` | Download `midnight-skills-registry-v1.0.0.tar.gz` from GitHub Releases |
| `main` | CI checks out the skills repo at that ref (see workflow) |

Change the pin when you want the UI to pick up new skills.

```bash
pnpm fetch:registry                         # use registry-version.txt
pnpm fetch:registry -- --local ../skills    # copy from a local clone
pnpm fetch:registry -- --release v1.0.0     # download a release tarball
```

`content/` is gitignored — never commit skill files into this repo.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_CLIENT_ID` | Yes (auth) | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | Yes (auth) | GitHub OAuth app secret |
| `SESSION_SECRET` | Yes (auth) | Long random string for session cookies |
| `APP_BASE_URL` | Yes | `http://localhost:3000` locally |
| `MONGODB_URI` | No | Community users / sign-in persistence |
| `MONGODB_DB` | No | Database name (default: `midskills`) |
| `REGISTRY_LOCAL_PATH` | No | Override path when `registry-version.txt` is `local` |

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Splash + GitHub sign-in |
| `/home` | Marketplace landing |
| `/browse` | Skills marketplace |
| `/browse/[slug]` | Skill detail |
| `/templates` | Runnable dApp templates |
| `/knowledge` | Shared references |
| `/paths` | Learning paths |
| `/get-started` | Install skills for AI agents |
| `/contribute` | Contributor guide |

## Deploy (private repo)

1. Publish a registry release in the public skills repo (`git tag v1.0.0 && git push origin v1.0.0`)
2. Set `registry-version.txt` to `v1.0.0` in this repo
3. Configure host env vars (`GITHUB_*`, `SESSION_SECRET`, `MONGODB_*`, `APP_BASE_URL`)
4. CI checks out the skills repo, runs `fetch:registry`, then `pnpm build`

## Related repos

| Repo | Visibility | Role |
|------|------------|------|
| [Midnight-skills](https://github.com/Kali-Decoder/Midnight-skills) | Public | Skills content + registry releases |
| **midskills-platform** (this repo) | Private | Next.js UI + auth |
