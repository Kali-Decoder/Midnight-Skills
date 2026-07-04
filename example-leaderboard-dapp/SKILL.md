---
name: example-leaderboard-dapp
author: Kali-Decoder
description: >
  Build a privacy-preserving arcade leaderboard DApp on Midnight Network — players submit
  click-challenge scores with anonymous, public, or custom display names, and prove entry
  ownership via zero-knowledge proofs without revealing secret keys. Covers leaderboard.compact
  (Map, Counter, witnesses, persistentHash owner commitments), Next.js frontend, 1AM wallet
  integration, low-level deploy/call, indexer reads without wallet, and ZK asset hosting.
  Use for gamified on-chain rankings, pseudonymous competitions, score attestations, or
  teaching disclose()/witness patterns. Triggers: leaderboard dApp, privacy leaderboard,
  submit score, verify ownership, anonymous player name, ZK proof of ownership,
  persistentHash identity, arcade game on Midnight. Also use when extending locker-dapp or
  payment-dapp wallet/provider patterns to social or gaming flows.
---

# Midnight Network Leaderboard DApp

A **privacy-preserving leaderboard** where players submit scores on-chain with three display modes and prove they own an entry using `verifyOwnership` — a ZK circuit that checks `ownerCommitment(secretKey)` matches the stored `ownerHash` without revealing the secret.

**Runnable template:** Copy `templates/leaderboard-dapp/` for a complete Next.js project (contract + UI). Run `npm install && npm run compact && npm run sync:assets && npm run dev` after installing the [1AM wallet](https://1am.dev).

**What this skill produces:**
- `contract/` — Compact leaderboard + TypeScript witnesses + compile scripts
- `app/leaderboard/` — Next.js client UI (click game, privacy mode picker, leaderboard table)
- `lib/midnight.ts` — wallet session + patched indexer provider (**copy from** `references/midnight-session.md` or `templates/leaderboard-dapp/lib/midnight.ts`)
- `lib/leaderboard.ts` — deploy, `submitScore`, `verifyOwnership`, ledger decode
- `lib/display-name.ts` — decode anonymous hash bytes to generated names ("Crimson Tiger")
- `public/zk/leaderboard/` — ZK proving assets synced from contract build

**Shared references** (canonical provider + troubleshooting — do not duplicate in prompts):
- `references/midnight-session.md` — `createConnectedSession`, indexer patch, deploy/call helpers
- `references/gotchas.md` — preprod deploy hangs, GraphQL `offset: null`, ZK asset paths
- `references/versions.json` — pinned `@midnight-ntwrk/*` versions

**Primary references:**
- `example-locker-dapp/` / `templates/locker-dapp/` — Next.js + 1AM pattern, low-level deploy/call
- `example-payment-dapp/` — provider wiring, indexer polling
- `compact/` — `disclose()`, witnesses, `persistentHash`, `Map`, `Counter`, `assert`
- `security/` — what is public on-chain vs private in witness data
- `indexer/` — read contract state without wallet connection

**Key architecture notes:**
- `scores` is a public `Map<Uint<64>, ScoreEntry>` — readable from the indexer by anyone
- `localSecretKey` witness returns a 32-byte secret from private state; never disclosed on-chain
- `ownerCommitment(sk)` uses `persistentHash` with domain separator `"leaderboard:owner:"`
- `useCustomName` boolean selects witness-fed name vs hash-based anonymous display name
- `verifyOwnership` is a proof-only circuit — no ledger writes; use for "prove this is my score"
- Persist secret key in `localStorage` so ownership proofs work after page refresh
- Use `createUnprovenDeployTx` + `submitTxAsync` — not `deployContract()` (hangs on preprod)
- Wrap `indexerPublicDataProvider` with patched `queryContractState` (GraphQL `offset: null` bug)
- Leaderboard table can load from indexer **without** wallet — only submit/verify need connection

---

## Workflow

When helping the user, follow this sequence:

1. **Contract** — `leaderboard.compact` compile + witnesses (`localSecretKey`, `getCustomName`)
2. **Providers** — `createConnectedSession` (from `references/midnight-session.md`)
3. **Deploy** — low-level deploy, persist private state + contract address
4. **Read state** — indexer GraphQL → `ContractState.deserialize` → `ledger()` → decode entries
5. **Submit score** — `submitScore(score, useCustomName)` with optional `setCustomName` beforehand
6. **Verify ownership** — `verifyOwnership(entryId)` for prize claims or "yours" badges
7. **UI** — click game, privacy mode selector, leaderboard table with prove button

---

## 1) Project Structure

```
leaderboard-dapp/
├── package.json
├── next.config.mjs
├── lib/
│   ├── isomorphic-ws-fix.mjs
│   ├── midnight.ts                 # session, patched provider, hex helpers
│   ├── leaderboard.ts              # deploy, submitScore, verifyOwnership, decode
│   └── display-name.ts             # anonymous name generator
├── app/
│   ├── layout.tsx
│   └── leaderboard/
│       └── LeaderboardClient.tsx   # game + wallet + leaderboard UI
├── contract/
│   ├── package.json
│   └── src/
│       ├── leaderboard.compact
│       ├── witnesses.ts
│       ├── index.ts
│       └── managed/leaderboard/    # compiler output (gitignored)
├── scripts/
│   └── sync-zk-assets.mjs          # → public/zk/leaderboard/
└── public/zk/leaderboard/          # keys + zkir (gitignored until sync)
```

---

## 2) Compact Contract

`contract/src/leaderboard.compact`:

```compact
struct ScoreEntry {
  score: Uint<64>,
  displayName: Bytes<32>,
  ownerHash: Bytes<32>
}

export ledger scores: Map<Uint<64>, ScoreEntry>;
export ledger nextId: Counter;

witness localSecretKey(): Bytes<32>;
witness getCustomName(): Bytes<32>;

export circuit ownerCommitment(sk: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([pad(32, "leaderboard:owner:"), sk]);
}

export circuit submitScore(score: Uint<64>, useCustomName: Boolean): [] { /* ... */ }
export circuit verifyOwnership(targetEntryId: Uint<64>): [] { /* ... */ }
```

**Privacy design:**
- **Anonymous mode** (`useCustomName = false`): `displayName = persistentHash(sk)` — UI decodes to generated name
- **Public / Custom mode** (`useCustomName = true`): `displayName = getCustomName()` witness — app feeds address or user name
- **Ownership**: `ownerHash = ownerCommitment(sk)` stored on every entry; `verifyOwnership` re-derives and compares

Compile:

```bash
cd contract && npm run compact && cd ..
npm run sync:assets
```

---

## 3) Witnesses

`contract/src/witnesses.ts`:

```typescript
export type LeaderboardPrivateState = { secretKey: Uint8Array };

export const witnesses = {
  localSecretKey: (ctx) => [ctx.privateState, ctx.privateState.secretKey] as const,
  getCustomName: (ctx) => [ctx.privateState, customName] as const,
};

export const setCustomName = (name: string) => { /* encode to Bytes<32> */ };
```

Call `setCustomName(name)` in TypeScript **before** `submitScore` when using public or custom display modes.

---

## 4) TypeScript Integration

`lib/leaderboard.ts` mirrors the locker-dapp pattern:

| Function | Purpose |
|----------|---------|
| `getOrCreateSecretKey()` | Persist 32-byte secret in `localStorage` |
| `deployLeaderboard(session)` | `createUnprovenDeployTx` + `submitTxAsync` |
| `submitScore(session, addr, score, customName?)` | `submitCallTxAsync` → `submitScore` circuit |
| `verifyOwnership(session, addr, entryId)` | `submitCallTxAsync` → `verifyOwnership` circuit |
| `fetchLeaderboardState(queryUrl, addr)` | Indexer poll + `decodeLeaderboardState` |

ZK asset path: `/zk/leaderboard` (synced to `public/zk/leaderboard/`).

---

## 5) Browser UI

`LeaderboardClient.tsx` flow:

1. **Connect** — `detectWallet()` → `wallet.connect('preprod')` → `createConnectedSession(api, ZK_PATH)`
2. **Deploy / Join** — deploy new contract or paste existing 64-char hex address
3. **Play** — 10-second click challenge
4. **Submit** — pick Anonymous / Public / Custom, then `submitScore`
5. **Leaderboard** — auto-refresh from indexer every 15s (no wallet required to read)
6. **Prove** — `verifyOwnership(entryId)` marks entry as yours in UI

Indexer-only reads mean spectators can watch the leaderboard without connecting a wallet.

---

## 6) Prerequisites

| Component | Version |
|-----------|---------|
| Compact compiler | 0.31.0 |
| Compact runtime | 0.16.0 |
| Ledger | 8.0.3 |
| midnight-js | 4.0.4 |
| proof server | 8.0.3 |

```bash
docker run -d -p 6300:6300 midnightntwrk/proof-server:8.0.3 -- \
  midnight-proof-server --network preprod
```

Wallet: 1AM extension on **Preprod**, proof server `http://localhost:6300`, tNIGHT + tDUST from faucet.

---

## 7) Compatibility Matrix

Pin versions from `references/versions.json`. Cross-check [docs.midnight.network support matrix](https://docs.midnight.network/relnotes/support-matrix) before upgrading.

---

## 8) Production Notes

- Deploy frontend to Vercel/Netlify; set `public/zk/leaderboard` assets in build step (`npm run sync:assets`)
- Store default contract address in env or `localStorage` for returning players
- `verifyOwnership` does not mutate ledger — safe for repeated "prove mine" UX
- For mainnet, update network ID, indexer URLs, and proof server config via wallet `getConfiguration()`

---

## Quick Commands

```bash
cd templates/leaderboard-dapp
npm install
npm run compact
npm run sync:assets
npm run dev
```

Open http://localhost:3000 → Connect 1AM → Deploy New → play → submit → refresh leaderboard.
