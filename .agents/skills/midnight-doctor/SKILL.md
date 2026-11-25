---
name: midnight-doctor
description: Health-check a Midnight project and machine against the pinned, tested version set. Use before debugging any version-shaped error, after cloning a template, after upgrading a package or the Compact toolchain, or when the user says "check my setup", "doctor", "why won't this compile/deploy", "version mismatch", or "is my environment right". Read-only; reports FAIL/WARN with the exact fix.
---

# Midnight Doctor

One command that compares Node, the Compact devtools and toolchain, Docker images, the proof server, every `package.json` Midnight dependency, duplicate runtimes, and `pragma language_version` against the pins in `midnight-version-matrix`.

**What this skill produces:** a FAIL / WARN / OK report with one fix per finding. It never installs or edits anything.

## Workflow

1. Run the doctor from the project root (or pass the path):

   ```bash
   node <this-skill>/scripts/doctor.mjs            # current directory
   node <this-skill>/scripts/doctor.mjs ./my-dapp  # another project
   node <this-skill>/scripts/doctor.mjs --json     # for parsing
   ```

   `<this-skill>` is where this skill is installed, e.g. `.agents/skills/midnight-doctor` or `.claude/skills/midnight-doctor`. Node 18+ is enough to run it; it has no dependencies.

2. Read the `INFO [pins]` line first: it says which pin set was used.
   - Live: `https://midskills.sevryn.xyz/api/versions` (the current pins).
   - Bundled: `pins.json` next to this file, a copy of `references/versions.json` made at release time. Use `--offline` to force it, or `--pins <file-or-url>` to use another set.
3. Fix every **FAIL** before touching application code. Most "my code is wrong" reports are a FAIL here: a toolchain/runtime mismatch, a removed package, two scopes of Midnight.js, or two copies of `compact-runtime`.
4. Treat **WARN** as a decision for the user: ranges (`^`/`~`) instead of exact pins, packages without a tested pin, an older pragma, no proof server running.
5. Re-run until it reports `0 fail`. Then, if the original error persists, look it up in `midnight-common-errors`.

## What it checks

| Area | Check | Fails when |
|------|-------|-----------|
| `node` | Node.js version | older than 18 (warns below 22) |
| `compact` | `compact --version`, `compact compile --version` | toolchain differs from the pin, or `compact` is missing |
| `docker` | daemon, running proof-server / indexer / node images | a running Midnight image has a different tag than the pin |
| `proof-server` | something listening on `localhost:6300` | never fails, warns |
| `project` | each `package.json` (3 levels deep) | a removed package, a version off the pin, installed version off the pin, mixed `@midnight-ntwrk` / `@midnightntwrk` Midnight.js, several `compact-runtime` versions |
| `contracts` | `pragma language_version` in every `.compact` file | never fails, warns if it differs from the toolchain's language version |

## Exit codes

`0` no FAIL · `1` at least one FAIL · `2` the doctor could not load any pins.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `No pins: live endpoint unreachable` | You are offline and the bundled `pins.json` is missing (partial install). Pass `--pins` with a path to `references/versions.json` from this repo. |
| Live pins differ from what a skill shows | The live set is newer. Follow the live set and the support matrix; skills are synced to it on the next release. |
| A package you need "has no tested pin" | Do not pick a version yourself. Tell the user, and check the [support matrix](https://docs.midnight.network/relnotes/support-matrix). |

## Related skills

| Task | Skill |
|------|-------|
| See the full pinned set and install commands | `midnight-version-matrix/` |
| Decode an error message or code | `midnight-common-errors/` |
| Install missing tooling | `midnight-environment-setup/` |
