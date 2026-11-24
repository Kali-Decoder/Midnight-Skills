# Counter DApp template (Ledger 9)

The Midnight counter reference DApp (`midnightntwrk/example-counter` v2.1.1), ported to Ledger 9 in this repo: Compact 0.36.1, `compact-runtime` 0.21.0, Midnight.js 5, Wallet SDK 2. Upstream `example-counter` was still on Ledger 8 when this port was made.

The walkthrough lives in `.agents/skills/example-counter/SKILL.md`. Versions come from `references/versions.json`.

## Quick start (preprod)

```bash
npm install
cd contract && npm run compact && npm run build && cd ..   # compact compile +0.36.1, then build dist/

# Terminal 1: proof server
cd counter-cli && docker compose -f proof-server.yml up

# Terminal 2: the CLI (preprod endpoints are Blockfrost)
export BLOCKFROST_PROJECT_ID=<your preprod project id>
cd counter-cli && npx tsx src/preprod.ts
```

Preview needs no token: `npx tsx src/preview.ts`. Local stack: `cd counter-cli && npm run standalone` (Docker, genesis wallet).

## Verified

- `contract`: compiles with `compact compile +0.36.1`, type-checks, `npm run build` succeeds
- `counter-cli`: type-checks against the installed Ledger 9 packages
- Not yet run against a live network

## Not included

The upstream test suites (`contract/src/test/*`, `counter-cli/src/test/*`) and the eslint/prettier/VS Code configs are not part of this port. The vitest configs are kept so tests can be added.
