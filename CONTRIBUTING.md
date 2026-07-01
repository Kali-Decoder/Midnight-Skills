# Contributing to MIDSKILLS

Thank you for helping improve Midnight developer skills. This repo is a **knowledge package for AI agents** — skills are markdown files that LLMs fetch and follow. The website is secondary; quality and accuracy of `SKILL.md` files matter most.

## Ways to contribute

| Contribution | Where to work |
|--------------|---------------|
| **Add a new skill** | New folder + `SKILL.md` + `skills.json` entry |
| **Improve an existing skill** | Edit that skill's `SKILL.md` (fix errors, update versions, add gotchas) |
| **Add shared reference code** | `references/` (provider wiring, gotchas, version pins) |
| **Add a runnable template** | `templates/<name>/` + link via `templatePath` in `skills.json` |
| **Fix registry / site drift** | `skills.json` + `npm run sync:registry` |
| **Docs & typos** | `README.md`, `howto.html`, `CONTRIBUTING.md` |

Open a [GitHub issue](https://github.com/Kali-Decoder/Midnight-skills/issues) first if your skill is large, overlaps an existing skill, or you're unsure it fits.

---

## Contribution rules

### 1. Midnight-only scope

Skills must teach **building on Midnight Network** — Compact contracts, midnight-js, wallets, indexer, privacy patterns, or complete Midnight dApp workflows.

We generally **do not** accept:

- Generic React/Next.js tutorials with no Midnight-specific content
- Skills for other chains repurposed with Midnight mentions added
- Marketing copy, token pitches, or unrelated tooling
- Copied docs without synthesis into actionable agent instructions

### 2. Accuracy over volume

- Pin **real package versions** that work together (see `references/versions.json` and `testing/` skill)
- Prefer patterns verified on **preprod** (or state which network you tested)
- Document known bugs and workarounds (e.g. `deployContract()` hangs — use low-level tx APIs)
- Link to official sources (`docs.midnight.network`, Compact book) where appropriate

### 3. Written for agents, not humans only

Each skill should help an LLM **complete a task end-to-end**:

- Rich `description` in frontmatter with **trigger phrases** (when to use this skill)
- Numbered workflow (“do step 1, then 2…”)
- Copy-pasteable code blocks with correct imports
- Troubleshooting table for common errors
- “Related skills” section pointing to prerequisites and next steps

### 4. Single registry — no manual lists

**Never** hand-edit generated registry blocks in:

- `SKILL.md` / `AGENTS.md` / `CLAUDE.md` (between `<!-- SKILLS_REGISTRY:... -->` markers)
- `README.md` skills table
- `howto.html` skill grid
- `package.json` `"skills"` array

Always update `skills.json` and run `npm run sync:registry`.

### 5. No secrets in the repo

Do not commit `.env`, API keys, mnemonics, or private keys. Use placeholders in examples.

### 6. License

By contributing, you agree your contributions are licensed under the project's MIT License (see [README](README.md#license)).

---

## Adding a new skill (step by step)

### Step 1 — Pick an id and folder

- **Folder:** `your-skill-name/` (kebab-case, matches skill topic)
- **File:** `your-skill-name/SKILL.md`
- **Registry id:** same as folder name, lowercase, hyphens only (e.g. `example-locker-dapp`)
- **id must be unique** across `skills.json`

### Step 2 — Write `SKILL.md`

Start from this skeleton:

```markdown
---
name: your-skill-name
description: >
  One paragraph: what this skill does AND when an agent should use it.
  Include trigger phrases: "user asks about X", "errors like Y", "building Z on Midnight".
---

# Your Skill Title

One-sentence summary of the outcome.

**What this skill produces:** (files, commands, or artifacts)

**Primary references:** (other skills, docs, packages)

**Key architecture notes:** (3–6 bullets agents must not get wrong)

---

## Workflow

1. First step
2. Second step
3. ...

---

## 1) First major section

(content with code examples)

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| ... | ... | ... |

---

## Related Skills

| Task | Skill |
|------|-------|
| ... | `other-skill/` |
```

**Frontmatter rules:**

| Field | Required | Notes |
|-------|----------|-------|
| `name` | Yes | Matches folder name |
| `description` | Yes | Used by agents for skill selection — be explicit about triggers |

**Content rules:**

- Use `Uint<64>` for Unix timestamps, `BigInt` for token amounts in Stars
- For browser dApps with 1AM wallet, point to `references/midnight-session.md` instead of duplicating provider code
- For debugging, point to `references/gotchas.md`
- If the skill is a full dApp guide, include architecture diagram or tree
- Optional: add `disable-model-invocation: true` only if the skill should not be auto-invoked (rare; ask maintainers)

### Step 3 — Register in `skills.json`

Add an object to the `skills` array:

```json
{
  "id": "your-skill-name",
  "name": "Your Skill Display Name",
  "path": "your-skill-name/SKILL.md",
  "description": "Short description for README and site (1–2 sentences).",
  "enabled": true,
  "featured": false,
  "category": "foundation",
  "taskHint": "Short phrase for the router task table",
  "routerBullets": [
    "First bullet for router index.",
    "Second bullet."
  ]
}
```

**Registry fields:**

| Field | Default | Purpose |
|-------|---------|---------|
| `enabled` | `true` | `false` hides from site, router, and npm package list |
| `featured` | `false` | `true` shows on homepage featured grid |
| `category` | — | `foundation`, `wallet`, `sdk`, `domain`, `template`, `meta` |
| `taskHint` | — | Row in router “What to Fetch by Task” table |
| `routerBullets` | — | 1–2 bullets under skill heading in router |
| `listInRouter` | `true` | Set `false` for meta skills only |
| `listInPackage` | `true` | Set `false` to exclude from `npx skills` package list |
| `templatePath` | — | Optional path to runnable template (e.g. `templates/locker-dapp`) |

**Optional — learning path:** add your skill to a `learningPaths[].steps` entry if it fits an existing path. Ask maintainers if you want a new path.

### Step 4 — Sync the registry

```bash
npm run sync:registry
```

This updates router files, README table, howto grid, and `package.json`. The script **fails** if `SKILL.md` is missing or ids are duplicated.

### Step 5 — Verify locally

- Open `skill.html?name=your-skill-name` — skill loads in sidebar and renders
- Check homepage if `featured: true`
- Skim generated router section in `SKILL.md` for your entry

### Step 6 — Open a pull request

**PR title:** `Add skill: Your Skill Name` or `Update compact skill: fix deploy section`

**PR description should include:**

- What task the skill helps with
- Which Midnight network you tested on (if applicable)
- Link to related issue (if any)
- Checklist below

---

## PR checklist

- [ ] `your-skill-name/SKILL.md` exists with valid YAML frontmatter
- [ ] Entry added to `skills.json` with unique `id`
- [ ] `npm run sync:registry` run; committed synced files (`SKILL.md` router blocks, `README.md`, `howto.html`, `package.json`)
- [ ] No secrets or credentials in the diff
- [ ] Code examples use current Midnight SDK patterns (low-level deploy/call where required)
- [ ] Troubleshooting or gotchas section included for non-trivial skills
- [ ] Related skills cross-linked

---

## Skill categories (guidance)

| Category | Examples | Expectation |
|----------|----------|-------------|
| `foundation` | `why-midnight`, `compact`, `testing` | Conceptual or language reference |
| `wallet` | `1am-wallet`, `react-wallet-connector` | Browser or headless wallet integration |
| `sdk` | `midnight-js`, `indexer`, `multinetwork` | TypeScript SDK usage |
| `domain` | `nft`, `token-transfers`, `security` | Specific product patterns |
| `template` | `example-payment-dapp`, `example-locker-dapp` | End-to-end dApp build guides |

Template skills should be the most detailed — workflow, contract, frontend, deploy, and debug.

---

## Runnable templates (optional)

If your skill includes a **full project** users can clone and run:

1. Add code under `templates/<name>/`
2. Include `README.md` with `npm install` / compile / dev steps
3. Set `"templatePath": "templates/<name>"` in `skills.json`
4. Reuse `references/midnight-session.md` for provider wiring when applicable

See `templates/locker-dapp/` as the reference layout.

---

## Updating an existing skill

1. Edit only that skill's `SKILL.md` (and `references/` if shared code changed)
2. If display name, description, or visibility changed → update `skills.json`
3. Run `npm run sync:registry` only if `skills.json` changed
4. Do **not** reorder or manually edit other skills in generated files

---

## Review process

Maintainers will check:

1. **Scope** — fits Midnight Network developer tooling
2. **Accuracy** — versions, APIs, and patterns match current network behavior
3. **Agent usability** — triggers, workflow, troubleshooting present
4. **Registry hygiene** — `skills.json` + sync script output included
5. **Overlap** — not duplicating an existing skill without clear differentiation

Reviews may request changes or suggest merging into an existing skill.

---

## Questions?

- [Open an issue](https://github.com/Kali-Decoder/Midnight-skills/issues) for skill proposals
- Browse existing skills in [`skills.json`](skills.json) and [`skill.html`](skill.html) before writing
- Read [`testing/`](testing/SKILL.md) for toolchain version alignment

Thank you for making Midnight easier to build on.
