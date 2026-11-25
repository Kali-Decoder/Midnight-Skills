---
name: example-hello-world
description: Generate a complete Midnight Network hello-world DApp from scratch — Compact smart contract, headless Node.js tests with vitest, wallet setup using testkit-js FluentWalletBuilder, DUST generation, deploy and call transactions, and all supporting config. Use when a user wants to build a full Midnight DApp, bootstrap a new project, understand the end-to-end lifecycle, or needs working boilerplate for wallet + contract + tests. This skill produces all files needed to run on local devnet (Docker stack) using the official midnightntwrk/example-hello-world reference implementation.
---

# Example Hello World DApp Skill

This skill generates a complete, runnable Midnight DApp. It covers every file in the project: the Compact contract, TypeScript utilities, test script, Docker configs, and package setup. All code matches the official `midnightntwrk/example-hello-world` reference implementation.

**Primary references:**
- `github.com/midnightntwrk/example-hello-world` — official reference repo
- `docs.midnight.network/getting-started/hello-world` — official hello-world guide
- `docs.midnight.network/relnotes/support-matrix` — authoritative version compatibility matrix

**Package versions below are a dated snapshot (May 2026).** Resolve the current tested set from the [support matrix](https://docs.midnight.network/relnotes/support-matrix) before pinning — see `references/volatile.md`. Never install `@latest`.

**Key architecture notes:**
- Uses `@midnightntwrk/testkit-js` 5.0.2 `MidnightWalletProvider` (built on `FluentWalletBuilder`) for an era-aware, Wallet SDK 2.x wallet
- Uses `@midnightntwrk/midnight-js-contracts` `deployContract` and `submitCallTx`
- Compact pragma is `>= 0.28.0`; toolchain, runtime and Ledger 9 packages are the set in `references/versions.json`
- Indexer API paths use `/api/v4/graphql` for local devnet
- `MidnightWalletProvider` class wraps `WalletFacade` to implement `MidnightProvider` and `WalletProvider` interfaces
- `syncWallet` function provides detailed progress logging during wallet sync
- Test uses static seed (`ALICE_SEED`) for reproducible testing
- `privateStateStoreName` uses `Date.now()` for test isolation
- `NODE_OPTIONS='--experimental-vm-modules'` required for vitest with ESM

---

## 1) Project Structure

```
hello-world-local/
├── contracts/
│   ├── hello-world.compact          # Compact smart contract (you create this)
│   ├── index.ts                     # Barrel file for compiled contract exports (create manually)
│   └── managed/
│       └── hello-world/             # Compiler output (auto-generated, do not edit)
│           ├── compiler/
│           ├── contract/
│           ├── keys/
│           └── zkir/
├── src/
│   ├── config.ts                    # Network configuration
│   ├── wallet.ts                    # MidnightWalletProvider + syncWallet
│   ├── providers.ts                 # HelloWorldProviders builder
│   └── test/
│       └── hw.test.ts               # vitest tests (deploy + storeMessage)
├── compose.yml                      # Docker: full local stack
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

**The `contracts/managed/` directory is created by the Compact compiler — do not create or edit files inside it manually.**

---

## 2) Prerequisites

```bash
# Node.js 22+ required
node --version

# Docker required (local stack)
docker --version

# Install Compact compiler
curl --proto '=https' --tlsv1.2 -sSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
source $HOME/.local/bin/env
compact --version
```

---

## 3) `package.json`

```json
{
  "name": "hello-world-local",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.0.0"
  },
  "scripts": {
    "compile": "compact compile contracts/hello-world.compact managed/hello-world",
    "test": "NODE_OPTIONS='--experimental-vm-modules' vitest run",
    "test:local": "MIDNIGHT_NETWORK=local yarn test",
    "env:up": "docker compose up -d --wait",
    "env:down": "docker compose down",
    "validate": "yarn env:up && yarn test:local; yarn env:down"
  },
  "dependencies": {
    "@midnight-ntwrk/compact-runtime": "0.21.0",
    "@midnightntwrk/ledger-v9": "1.0.2",
    "@midnightntwrk/midnight-js-contracts": "5.0.2",
    "@midnightntwrk/midnight-js-http-client-proof-provider": "5.0.2",
    "@midnightntwrk/midnight-js-indexer-public-data-provider": "5.0.2",
    "@midnightntwrk/midnight-js-level-private-state-provider": "5.0.2",
    "@midnightntwrk/midnight-js-node-zk-config-provider": "5.0.2",
    "@midnightntwrk/midnight-js-types": "5.0.2",
    "@midnightntwrk/midnight-js-utils": "5.0.2",
    "@midnightntwrk/testkit-js": "5.0.2",
    "@midnightntwrk/wallet-sdk-facade": "5.0.1",
    "axios": "^1.15.0",
    "pino": "^9.0.0",
    "pino-pretty": "^13.0.0",
    "rxjs": "^7.8.2",
    "testcontainers": "^11.13.0",
    "ws": "^8.14.2"
  },
  "devDependencies": {
    "@midnightntwrk/midnight-js-compact": "5.0.2",
    "@types/node": "^22.0.0",
    "@types/ws": "^8.5.9",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  },
  "resolutions": {
    "@midnightntwrk/ledger-v9": "1.0.2",
    "@midnight-ntwrk/compact-runtime": "0.21.0"
  },
  "packageManager": "yarn@1.22.22"
}
```

---

## 4) `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["src/**/*.ts", "contract/**/*.ts"]
}
```

> ⚠️ **`"contract/**/*.ts"` is singular** — this matches the repo exactly and covers the compiler output path. Using `"contracts/**/*.ts"` (plural) will silently break TypeScript resolution of the compiled contract types.

---

## 5) `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 10 * 60_000,
    hookTimeout: 15 * 60_000,
    include: ['src/**/*.test.ts'],
    reporters: ['default'],
    sequence: { concurrent: false },
  },
});
```

---

## 6) `contracts/hello-world.compact`

Create this file manually — the compiler output in `managed/` is generated from it.

```compact
pragma language_version >= 0.28.0;

export ledger message: Opaque<"string">;

export circuit storeMessage(newMessage: Opaque<"string">): [] {
  message = disclose(newMessage);
}
```

Compile from the `contracts/` directory:

```bash
cd contracts
compact compile hello-world.compact managed/hello-world
cd ..
```

Expected output:
```
Compiling 1 circuits:
  circuit "storeMessage" (k=6, rows=26)
```

This generates `contracts/managed/hello-world/contract/index.js` (and keys, zkir, compiler dirs). **Always compile before running tests.**

---

## 7) `contracts/index.ts` (barrel file — create manually)

Create this file manually — it imports from the compiled contract output. The compiled contract module must exist (from running `compact compile`) for the imports to resolve.

```typescript
import { CompiledContract } from '@midnight-ntwrk/compact-js';   // not compact-runtime
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export {
  Contract,
  ledger,
  pureCircuits,
  type Ledger,
  type ImpureCircuits,
  type PureCircuits,
} from './managed/hello-world/contract/index.js';
import { Contract } from './managed/hello-world/contract/index.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const zkConfigPath = path.resolve(currentDir, 'managed', 'hello-world');

export type HelloWorldContract = Contract<undefined>;

export const CompiledHelloWorldContract = CompiledContract.make<HelloWorldContract>(
  'HelloWorldContract',
  Contract,
).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);
```

---

## 8) `src/config.ts`

```typescript
export type NetworkConfig = {
  networkId: string;
  indexer: string;
  indexerWS: string;
  node: string;
  nodeWS: string;
  proofServer: string;
  faucet: string;
};

export const LOCAL_CONFIG: NetworkConfig = {
  networkId: 'undeployed',
  indexer: 'http://127.0.0.1:8088/api/v4/graphql',
  indexerWS: 'ws://127.0.0.1:8088/api/v4/graphql/ws',
  node: 'http://127.0.0.1:9944',
  nodeWS: 'ws://127.0.0.1:9944',
  proofServer: 'http://127.0.0.1:6300',
  faucet: '',
};

export function getConfig(): NetworkConfig {
  const network = process.env['MIDNIGHT_NETWORK'] ?? 'local';
  if (network !== 'local') {
    throw new Error(
      `Unknown network: ${network}. This harness only supports 'local'.`,
    );
  }
  return LOCAL_CONFIG;
}
```

---

## 9) `src/wallet.ts`

testkit-js 5.x ships the wallet provider: `MidnightWalletProvider.build(logger, env, seed)` creates a Wallet SDK 2.x `WalletFacade` from the seed (via `FluentWalletBuilder`), and implements Midnight.js 5's era-aware `WalletProvider` + `MidnightProvider` (balancing, signing unshielded intents, submitting). Don't hand-roll one: the Ledger 8-era copy used `wallet.start(zswapKeys, dustKey)` and key-object balancing, which Wallet SDK 2.x no longer accepts.

```typescript
import { MidnightWalletProvider } from '@midnightntwrk/testkit-js';
import type { WalletFacade, FacadeState } from '@midnightntwrk/wallet-sdk-facade';
import type { Logger } from 'pino';

export { MidnightWalletProvider };

export async function syncWallet(logger: Logger, wallet: WalletFacade, timeout = 300_000): Promise<FacadeState> {
  logger.info('Syncing wallet...');
  const timer = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Wallet sync timeout after ${timeout}ms`)), timeout),
  );
  const state = await Promise.race([wallet.waitForSyncedState(), timer]);
  logger.info(`Wallet synced (protocol version ${String(state.activeProtocolVersion)})`);
  return state;
}
```

---

## 10) `src/providers.ts`

```typescript
import type { ProvableCircuitId } from '@midnight-ntwrk/compact-js';
import { type MidnightProviders } from '@midnightntwrk/midnight-js-types';
import { indexerPublicDataProvider } from '@midnightntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnightntwrk/midnight-js-http-client-proof-provider';
import { NodeZkConfigProvider } from '@midnightntwrk/midnight-js-node-zk-config-provider';
import { levelPrivateStateProvider } from '@midnightntwrk/midnight-js-level-private-state-provider';
import type { HelloWorldContract } from '../contracts/index.js';
import { type MidnightWalletProvider } from './wallet.js';
import { type NetworkConfig } from './config.js';

export type HelloWorldCircuits = ProvableCircuitId<HelloWorldContract>;
export type HelloWorldProviders = MidnightProviders<HelloWorldCircuits, string, undefined>;

export function buildProviders(wallet: MidnightWalletProvider, zkConfigPath: string, config: NetworkConfig): HelloWorldProviders {
  const zkConfigProvider = new NodeZkConfigProvider<HelloWorldCircuits>(zkConfigPath);
  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: `hello-world-${Date.now()}`,
      privateStoragePasswordProvider: () => 'xK9#mQ2$pL8@nR5!vW3*',
      accountId: wallet.unshieldedKeystore.getBech32Address().asString(),
    }),
    publicDataProvider: indexerPublicDataProvider({ queryURL: config.indexer, subscriptionURL: config.indexerWS }),
    zkConfigProvider,
    proofProvider: httpClientProofProvider({ url: config.proofServer, zkConfigProvider }),
    walletProvider: wallet,
    midnightProvider: wallet,
    config: { networkId: config.networkId, ttlSeconds: 3600 },   // replaces setNetworkId
  };
}
```

---

## 11) `src/test/hw.test.ts`

Full content: [references/hw-test.md](references/hw-test.md). It covers the full vitest suite that deploys and calls the contract on a local devnet. Open it when you reach this step.

---

## 12) `compose.yml`

Full content: [references/compose.md](references/compose.md). It covers the local devnet `compose.yml` (node, indexer, proof server). Open it when you reach this step.

---

## 13) First Run — Local Devnet

```bash
# 1. Install deps
yarn install

# 2. Compile contract (must run from contracts/ directory)
cd contracts
compact compile hello-world.compact managed/hello-world
cd ..

# 3. Start local stack
yarn env:up
# wait ~30 seconds for all services to become healthy

# 4. Run tests (new terminal)
yarn test:local
```

Expected output:
```
[12:46:12.694] INFO (22064): Wallet sync complete after 23 emissions
[12:46:12.703] INFO (22064): Providers initialized. Ready to test
[12:46:12.707] INFO (22064): Creating private state...
[12:46:32.347] INFO (22064): Setting the contract address...
[12:46:32.347] INFO (22064): Contract deployed at: bba6579743ae23b44301d4a9f8df30dbd5244d63a59d8fbc2c9fc7ea521a04f8
 ✓ src/test/hw.test.ts (2 tests) 39112ms
   ✓ Hello World Contract > Deploys the contract  19649ms
   ✓ Hello World Contract > Stores Hello World!   18184ms
```

---

## 14) Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `compact: command not found` | PATH not set | `source $HOME/.local/bin/env` |
| `Cannot find module '../../contracts/...'` | Contract not compiled yet | Run `compact compile` from `contracts/` first |
| `ETARGET No matching version found` | Version not in the tested set | Resolve current versions from the support matrix — see `references/volatile.md`. Do not install `@latest`. |
| `ECONNREFUSED 127.0.0.1:6300` | Proof server not running | `yarn env:up` |
| `NODE_OPTIONS` error in test | Missing experimental flag | Ensure `NODE_OPTIONS='--experimental-vm-modules'` in test script |
| `Wallet sync timeout` | Docker services not healthy | Verify `yarn env:up` finished — all 3 containers must be healthy |
| `v4/graphql` 404 | Old indexer URL | Local devnet uses `/api/v4/graphql` — correct in `config.ts` |
| `FluentWalletBuilder is not a function` | Wrong testkit-js import | Import from `@midnightntwrk/testkit-js` |
| `levelPrivateStateProvider` options error | Missing required fields | Must pass `privateStateStoreName`, `walletProvider`, `privateStoragePasswordProvider` (strong password, min 16 chars, no sequential patterns), and `accountId` |
| TS: `Cannot find module` for contracts | Wrong `tsconfig.json` include | Must be `"contract/**/*.ts"` (singular), not `"contracts/**/*.ts"` |
| `submitCallTx` not found | Wrong import | Import from `@midnightntwrk/midnight-js-contracts` |
| Old contract address fails after recompile | Verifier key changed | Redeploy — compiled keys change when contract source changes |

---

## 15) Adapting This Template

1. Replace `contracts/hello-world.compact` with your contract
2. Compile: `cd contracts && compact compile your-contract.compact managed/your-contract`
3. Update `contracts/index.ts`:
   - Change import paths to `./managed/your-contract/contract/index.js`
   - Update `zkConfigPath` to `managed/your-contract`
   - Update `CompiledContract.make()` name and `Contract` reference
4. In `src/providers.ts`:
   - Update `HelloWorldCircuits` type to your circuit names
   - Update `privateStateStoreName` prefix to avoid LevelDB collisions
5. In `src/test/hw.test.ts`:
   - Replace `submitCallTx` args with your circuit calls
   - Replace `ledger()` with your contract's `ledger()` function
   - If your contract has witnesses, add `privateStateId` + `initialPrivateState` to `deployContract` and type the providers with your private-state type
6. Update `src/config.ts` if targeting non-local networks