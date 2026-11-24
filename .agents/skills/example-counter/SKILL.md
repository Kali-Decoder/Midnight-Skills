---
name: example-counter
description: Generate a complete Midnight Network counter DApp from scratch — Compact smart contract, interactive CLI, wallet setup, DUST generation, deploy + interact loop, Docker configs for local/preprod/preview, and tests. Use when a user wants to build a full Midnight DApp, bootstrap a new project, understand the end-to-end lifecycle, or needs working boilerplate for wallet + contract + CLI. This skill produces the official midnightntwrk/example-counter reference implementation using yarn workspaces.
---

# Example Counter DApp Skill

This skill is the walkthrough for `templates/counter-dapp/`, the runnable `midnightntwrk/example-counter` reference DApp (v2.1.1) **ported to Ledger 9** in this repo (21 Nov 2026). Upstream had not published a Ledger 9 release at the time: its `main` still pins runtime 0.15 / Midnight.js 4 / `setNetworkId`. The template holds every source, config and Docker file; this page explains them. Do not retype the files from here: copy the template, then adapt it (§13).

**Get the template:**

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/Kali-Decoder/Midnight-Skills.git
cd Midnight-Skills && git sparse-checkout set templates/counter-dapp
cp -R templates/counter-dapp ../my-counter && cd ../my-counter
npm install
cd contract && npm run compact && npm run build && cd ..
```

Without a checkout, read any file at `https://raw.githubusercontent.com/Kali-Decoder/Midnight-Skills/main/templates/counter-dapp/<path>`.

**Verified:** the contract compiles with `compact compile +0.36.1`, `contract` type-checks and builds, and `counter-cli` type-checks against the installed Ledger 9 packages. The CLI has not been run against a live network.

**Primary references:**
- `github.com/midnightntwrk/example-counter` — official reference repo
- `docs.midnight.network/guides/deploy-mn-app` — official deploy guide
- `docs.midnight.network/guides/interact-with-mn-app` — official interact guide
- `docs.midnight.network/relnotes/support-matrix` — authoritative version compatibility matrix

**Package versions below are the Ledger 9.1 set (checked against npm and the support matrix on 21 Nov 2026).** Resolve the current tested set from the [support matrix](https://docs.midnight.network/relnotes/support-matrix) before pinning — see `references/volatile.md`. Never install `@latest`.

---

## 1) Project Structure

```
templates/counter-dapp/
├── package.json                    # npm/yarn workspaces: contract, counter-cli
├── package-lock.json
├── compose.yml                     # Docker: full local stack (localhost-only)
├── contract/
│   ├── package.json                # @midnight-ntwrk/counter-contract (exports dist/)
│   ├── tsconfig.json, tsconfig.build.json, vitest.config.ts
│   └── src/
│       ├── counter.compact         # the contract
│       ├── witnesses.ts            # CounterPrivateState + witnesses
│       ├── index.ts                # re-exports managed contract + witnesses
│       └── managed/                # compiler output (gitignored)
└── counter-cli/
    ├── package.json                # @midnight-ntwrk/counter-cli
    ├── tsconfig.json, tsconfig.build.json, vitest.config.ts, vitest.setup.ts
    ├── proof-server.yml            # Docker: proof server only (preprod/preview)
    ├── standalone.yml              # Docker: node + indexer + proof server
    ├── standalone.env.example
    └── src/
        ├── api.ts                  # wallet, providers, deploy/join, increment, DUST
        ├── cli.ts                  # interactive menus
        ├── config.ts               # network config classes
        ├── common-types.ts, logger-utils.ts, index.ts
        └── preprod.ts, preview.ts, standalone.ts, *-start-proof-server.ts
```

Not included: upstream's test suites (`contract/src/test/*`, `counter-cli/src/test/*`) and its eslint/prettier/VS Code configs. The vitest configs are kept so tests can be added.

---

## 2) Prerequisites

```bash
# Node.js 22.15+ required
node --version

# Yarn 1.x (classic) required
yarn --version

# Docker required (proof server + optional local stack)
docker --version

# Install Compact compiler
curl --proto '=https' --tlsv1.2 -sSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
source $HOME/.local/bin/env
compact update 0.36.1
compact compile --version
```

---

## 3) Template Files

| File | Role |
|---|---|
| `package.json` | Root workspace (`contract`, `counter-cli`); scripts `test`, `test:local`, `env:up`/`env:down`, `validate`; pins the shared Ledger 9 packages |
| `contract/package.json` | `compact` (`compact compile +0.36.1 src/counter.compact src/managed/counter`), `build` (tsc + copies `managed/` into `dist/`), `typecheck`. `main`/`types` point at `dist/`, so **build the contract before running the CLI** |
| `counter-cli/package.json` | `preprod`, `preview`, `standalone`, `*-ps` (auto-start proof server), `typecheck`, `build` |
| `*/tsconfig*.json` | ESM, strict; `tsconfig.build.json` emits `dist/` |
| `compose.yml`, `counter-cli/standalone.yml` | Full local stack (node, indexer, proof server) on localhost |
| `counter-cli/proof-server.yml` | Proof server only, for preprod/preview |
| `counter-cli/standalone.env.example` | Copy to `standalone.env` for the local stack |

Image tags and package versions are the `references/versions.json` set.

---

## 4) `contract/src/counter.compact`

```compact
pragma language_version >= 0.28.0;

import CompactStandardLibrary;

export ledger round: Counter;

export circuit increment(): [] {
  round.increment(1);
}
```

Compile it:

```bash
# From the contract/ directory
cd contract && npm run compact
```

Expected output (exact `k`/`rows` depend on the toolchain; 0.36.x emits ZKIR v3):
```
Compiling 1 circuits:
  circuit "increment" ...
```

---

### `contract/src/witnesses.ts`

```typescript
export type CounterPrivateState = {
  privateCounter: number;
};

export const witnesses = {};
```

---

### `contract/src/index.ts`

```typescript
export * as Counter from "./managed/counter/contract/index.js";
export * from "./witnesses";
```

---

## 5) `counter-cli/src/config.ts`

Network configuration. Ledger 9 / Midnight.js 5: there is no `setNetworkId`, so each config carries its `networkId`. Preprod is served by Blockfrost.

`Config` is implemented by `StandaloneConfig` (local Docker stack, `undeployed`), `PreviewConfig` and `PreprodConfig`. Each carries `networkId`, `logDir`, indexer HTTP/WS URLs, node URL, proof server URL and an optional faucet. `contractConfig` holds the `privateStateStoreName` for the LevelDB private-state provider and the `zkConfigPath` of the compiled contract (`contract/src/managed/counter`).

**Note:** local and preview use indexer API **v4** (`/api/v4/graphql`). The old "all networks use v3, do not change to v4" advice is obsolete. `indexer.preprod.midnight.network` was retired on 9 Oct 2026 (HTTP 410), and `rpc.preprod.midnight.network` shut down on 18 Nov 2026. Blockfrost URLs contain your token, so don't log them.

---

## 6) `counter-cli/src/api.ts`

Core API — wallet creation (Wallet SDK 2.x), contract deploy/join, increment, DUST management. Ported to Ledger 9; type-checked against Midnight.js 5.0.2 / Wallet SDK 2.0.1.

| Export | What it does |
|---|---|
| `buildWalletAndWaitForFunds(config, seed)` / `buildFreshWallet(config)` | `WalletFacade` from a seed (or a new one), sync, wait for funds, register NIGHT for DUST |
| `createWalletAndMidnightProvider(ctx)` | Era-aware wallet and midnight providers from the facade |
| `configureProviders(ctx, config)` | Full `MidnightProviders`: LevelDB private state, indexer, node ZK config, HTTP proof provider, `config: { networkId, ttlSeconds }` |
| `deploy(providers, privateState)` / `joinContract(providers, address)` | `deployContract` / `findDeployedContract` with `counterCompiledContract` |
| `increment(contract)` | `callTx.increment()` |
| `getCounterLedgerState(providers, address)` / `displayCounterValue(...)` | Read and decode the ledger with `Counter.ledger(contractState.data)` |
| `waitForSync`, `waitForFunds`, `getDustBalance`, `monitorDustBalance` | Wallet and DUST helpers |
| `withStatus`, `setLogger` | CLI progress output and logging |

**Key points:**
- `globalThis.WebSocket = WebSocket` is required for GraphQL subscriptions (wallet sync) in Node.js
- `WalletFacade.init()` with `WalletSeeds.fromMasterSeed(seed)`; the facade is started with the seeds (`wallet.start(seeds)`)
- Era-aware providers via `createLedger9WalletProvider` / `createLedger9MidnightProvider`; the old `signTransactionIntents` workaround is gone
- `providers.config = { networkId, ttlSeconds }` replaces `setNetworkId`
- DUST balance is `state.dust.balance(time)`; the registration signer returns a Promise (`SignSegment`)

---

## 7) `counter-cli/src/cli.ts`

Interactive CLI with wallet setup, deploy/join, and counter interaction menus. Supports Docker lifecycle via testcontainers. `run(config, logger, dockerEnv?)` drives three menus: wallet (create, restore from seed), contract (deploy, join by address), and counter (increment, read). Entry points pick the config and call `run`.

---

## 8) Entry Points (`counter-cli/src/`)

| File | Network | Notes |
|---|---|---|
| `preprod.ts` | preprod | Blockfrost endpoints: export `BLOCKFROST_PROJECT_ID` first |
| `preview.ts` | preview | No token needed |
| `standalone.ts` | undeployed (local) | Starts `standalone.yml` through testcontainers; uses the genesis wallet |
| `preprod-start-proof-server.ts`, `preview-start-proof-server.ts` | preprod / preview | Also start `proof-server.yml` |
| `index.ts` | n/a | Re-exports `api` and `cli` |

---

---

## 9) First Run — Preprod

```bash
# 1. Install deps
yarn

# 2. Compile and build the contract (the CLI imports its dist/)
cd contract && npm run compact && npm run build && cd ..
# → circuit "increment" (compiled by `compact compile +0.36.1`)

# 3. Start proof server (keep this terminal open)
cd counter-cli && docker compose -f proof-server.yml pull && docker compose -f proof-server.yml up

# 4. In another terminal, run the CLI (preprod endpoints are Blockfrost: export a preprod token first)
export BLOCKFROST_PROJECT_ID=nightpreprod...
cd counter-cli && tsx src/preprod.ts
# or with auto-started proof server:
cd counter-cli && yarn preprod-ps
```

**Faucet:** `https://midnight-tmnight-preprod.nethermind.dev/` (preprod) or `https://faucet.preview.midnight.network/` (preview, `tsx src/preview.ts`, no token needed). Preprod cleared non-cNIGHT DUST registrations on 9 Nov 2026, so wallets register again on first run.

The CLI will:
1. Present a wallet menu — choose [1] to create a new wallet
2. Save the seed phrase shown
3. Wait for sync, then display the unshielded address
4. Prompt you to fund via the faucet (paste the address)
5. Wait for funds and register NIGHT UTXOs for DUST generation
6. Enter the contract menu — choose [1] to deploy
7. After deployment, enter the counter menu — choose [1] to increment, [2] to read

---

## 10) First Run — Local (standalone)

```bash
# 1. Start full local stack with testcontainers (auto-managed)
cd counter-cli && yarn standalone

# 2. This will:
#    - Pull Docker images
#    - Start node + indexer + proof server
#    - Use the genesis wallet (pre-funded)
#    - Deploy contract and enter the interaction loop
```

**Note:** Standalone mode uses the genesis mint wallet seed (`0000...0001`) automatically. No faucet needed.

---

## 11) Running Tests

The template keeps the vitest configs but not upstream's test files. After adding tests:

```bash
# Contract unit tests (from contract/ directory)
cd contract && npm run test:compile

# API integration tests against the local stack (from counter-cli/ directory)
cd counter-cli && yarn test-api

# Full validation (from root)
yarn validate
```

---

## 12) Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `compact: command not found` | PATH not set | `source $HOME/.local/bin/env` |
| `ETARGET No matching version found` | Version not in the tested set | Resolve current versions from the support matrix — see `references/volatile.md`. Do not install `@latest`. |
| `ECONNREFUSED 127.0.0.1:6300` | Proof server not running | Start proof server: `docker compose -f proof-server.yml up` |
| `WalletFacade.init is not a function` | Old WalletFacade usage | Use `WalletFacade.init()` static factory, not `new WalletFacade()` |
| `MidnightBech32m.encode is not a function` | Missing address-format import | Import from `@midnightntwrk/wallet-sdk-address-format` |
| `Failed to clone intent` | Wallet SDK 1.x signing bug | Gone in Wallet SDK 2.x (`signRecipe` signs per stage); upgrade instead of patching |
| DUST = 0 after failed deploy | DUST coins locked | Restart the process — `wallet.stop()` then rerun |
| 0 balance after faucet | Wallet not synced yet | Wait for sync; check unshielded address was used |
| `Cannot find module` | Contract not compiled or not built | `cd contract && npm run compact && npm run build` (the CLI imports `dist/`) |
| `prove: no SRS params for k=6` | Circuit too small for prover | Add dummy ledger fields to increase circuit size |
| Old address fails after recompile | Verifier key changed | Redeploy contract |

---

## 13) Adapting This Template

Copy `templates/counter-dapp/` first and get it running unchanged. Then, to replace the counter with your own contract:

1. Replace `contract/src/counter.compact` with your contract
2. Run `cd contract && npm run compact && npm run build`
3. Update `contract/src/witnesses.ts` with your private state type
4. Update `contract/src/index.ts` to export your contract symbols
5. In `counter-cli/src/common-types.ts` — update type aliases for your circuits
6. In `counter-cli/src/api.ts`:
   - Update imports to use your contract package
   - Update `counterCompiledContract` with your contract reference
   - Update `counterContractInstance`, `deploy`, `joinContract` as needed
   - Replace `increment` with your circuit calls
   - Replace `Counter.ledger(contractState.data)` with your ledger field
7. Rename `privateStateStoreName` in `config.ts` (`contractConfig`) to avoid LevelDB collisions
8. Replace the private-state password before production: `configureProviders` derives it from the wallet's coin **public** key, so anyone who knows that key can reproduce it. Ask the user for a password or derive it from secret wallet material
