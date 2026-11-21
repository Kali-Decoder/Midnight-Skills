---
name: example-counter
description: Generate a complete Midnight Network counter DApp from scratch — Compact smart contract, interactive CLI, wallet setup, DUST generation, deploy + interact loop, Docker configs for local/preprod/preview, and tests. Use when a user wants to build a full Midnight DApp, bootstrap a new project, understand the end-to-end lifecycle, or needs working boilerplate for wallet + contract + CLI. This skill produces the official midnightntwrk/example-counter reference implementation using yarn workspaces.
---

# Example Counter DApp Skill

This skill generates the complete, runnable `midnightntwrk/example-counter` reference DApp. It covers every file: Compact contract, TypeScript sources, entry points for each network, Docker compose files, test infrastructure, and all supporting config. It is based on the official implementation at `github.com/midnightntwrk/example-counter` (v2.1.1), **ported to Ledger 9** here (21 Nov 2026). Upstream had not published a Ledger 9 release at the time: its `main` still pins runtime 0.15 / Midnight.js 4 / `setNetworkId`. This port uses Compact 0.36.1, runtime 0.21.0, Midnight.js 5.0.2, Wallet SDK 2.0.1 and indexer API v4. The contract compiles and `api.ts` type-checks; the CLI has not been run against a live network.

**Primary references:**
- `github.com/midnightntwrk/example-counter` — official reference repo
- `docs.midnight.network/guides/deploy-mn-app` — official deploy guide
- `docs.midnight.network/guides/interact-with-mn-app` — official interact guide
- `docs.midnight.network/relnotes/support-matrix` — authoritative version compatibility matrix

**Package versions below are the Ledger 9.1 set (checked against npm and the support matrix on 21 Nov 2026).** Resolve the current tested set from the [support matrix](https://docs.midnight.network/relnotes/support-matrix) before pinning — see `references/volatile.md`. Never install `@latest`.

---

## 1) Project Structure

Generate this exact layout:

```
my-dapp/
├── package.json                    # Root workspace config
├── compose.yml                     # Docker: full local stack (root, localhost-only)
│
├── contract/
│   ├── package.json                # @midnight-ntwrk/counter-contract
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   ├── vitest.config.ts
│   ├── eslint.config.mjs
│   ├── .prettierrc
│   ├── .vscode/
│   │   ├── launch.json
│   │   └── tasks.json
│   └── src/
│       ├── counter.compact         # Compact smart contract
│       ├── index.ts                # Re-exports managed contract + witnesses
│       ├── witnesses.ts            # CounterPrivateState type + witnesses object
│       ├── managed/                # Compiled contract output (gitignored)
│       └── test/
│           ├── counter-simulator.ts
│           └── counter.test.ts
│
└── counter-cli/
    ├── package.json                # @midnight-ntwrk/counter-cli
    ├── tsconfig.json
    ├── tsconfig.build.json
    ├── vitest.config.ts
    ├── vitest.setup.ts
    ├── eslint.config.mjs
    ├── .prettierrc.json
    ├── proof-server.yml            # Docker: proof server only (preprod/preview)
    ├── standalone.yml              # Docker: full local stack (node + indexer + proof server)
    ├── standalone.env.example
    └── src/
        ├── index.ts                # Re-exports api + cli
        ├── cli.ts                  # Interactive CLI (wallet, deploy, join, increment)
        ├── api.ts                  # Core API (wallet creation, deploy, increment, providers)
        ├── config.ts               # Network configuration classes
        ├── common-types.ts         # Type definitions
        ├── logger-utils.ts         # Pino logger setup
        ├── preprod.ts              # Preprod entry point
        ├── preview.ts              # Preview entry point
        ├── standalone.ts           # Local entry point (with Docker lifecycle)
        ├── preprod-start-proof-server.ts
        ├── preview-start-proof-server.ts
        └── test/
            ├── commons.ts          # Test environment helpers
            └── counter.api.test.ts # API integration tests
```

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

## 3) Root `package.json`

```json
{
  "name": "example-counter",
  "version": "2.1.1-ledger9",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.0.0"
  },
  "workspaces": [
    "counter-cli",
    "contract"
  ],
  "scripts": {
    "test": "NODE_OPTIONS='--experimental-vm-modules' vitest run",
    "test:local": "MIDNIGHT_NETWORK=local yarn test",
    "env:up": "docker compose up -d --wait",
    "env:down": "docker compose down",
    "validate": "yarn env:up && yarn test:local; yarn env:down"
  },
  "dependencies": {
    "@midnight-ntwrk/compact-js": "3.0.2",
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
    "@midnightntwrk/wallet-sdk-abstractions": "3.0.0",
    "@midnightntwrk/wallet-sdk-address-format": "4.0.1",
    "@midnightntwrk/wallet-sdk-dust-wallet": "5.1.0",
    "@midnightntwrk/wallet-sdk-facade": "5.0.1",
    "@midnightntwrk/wallet-sdk-hd": "4.0.0",
    "@midnightntwrk/wallet-sdk-shielded": "4.0.1",
    "@midnightntwrk/wallet-sdk-unshielded-wallet": "4.0.1",
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
    "ts-node": "^10.9.2",
    "tsx": "^4.19.0",
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

## 4) Workspace Package: `contract/package.json`

```json
{
  "name": "@midnight-ntwrk/counter-contract",
  "version": "0.1.0",
  "license": "Apache-2.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "module": "dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "require": "./dist/index.js",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "compact": "compact compile src/counter.compact src/managed/counter",
    "test": "vitest run",
    "test:compile": "npm run compact && vitest run",
    "build": "rm -rf dist && tsc --project tsconfig.build.json && cp -Rf ./src/managed ./dist/managed && cp ./src/counter.compact ./dist",
    "lint": "eslint src",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  }
}
```

---

## 5) Workspace Package: `counter-cli/package.json`

```json
{
  "name": "@midnight-ntwrk/counter-cli",
  "version": "0.1.0",
  "license": "Apache-2.0",
  "private": true,
  "type": "module",
  "scripts": {
    "standalone": "docker compose -f standalone.yml pull && tsx src/standalone.ts",
    "test-api": "docker compose -f standalone.yml pull && DEBUG='testcontainers' vitest run",
    "build": "rm -rf dist && tsc --project tsconfig.build.json",
    "lint": "eslint src",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "preview": "tsx src/preview.ts",
    "preview-ps": "docker compose -f proof-server.yml pull && tsx src/preview-start-proof-server.ts",
    "preprod": "tsx src/preprod.ts",
    "preprod-ps": "docker compose -f proof-server.yml pull && tsx src/preprod-start-proof-server.ts"
  },
  "dependencies": {
    "@midnight-ntwrk/counter-contract": "*"
  }
}
```

---

## 6) `contract/src/counter.compact`

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

## 7) `contract/src/witnesses.ts`

```typescript
export type CounterPrivateState = {
  privateCounter: number;
};

export const witnesses = {};
```

---

## 8) `contract/src/index.ts`

```typescript
export * as Counter from "./managed/counter/contract/index.js";
export * from "./witnesses";
```

---

## 9) `counter-cli/src/config.ts`

Network configuration. Ledger 9 / Midnight.js 5: there is no `setNetworkId`, so each config carries its `networkId`. Preprod is served by Blockfrost.

```typescript
import path from 'node:path';

export const currentDir = path.resolve(new URL(import.meta.url).pathname, '..');

export const contractConfig = {
  privateStateStoreName: 'counter-private-state',
  zkConfigPath: path.resolve(currentDir, '..', '..', 'contract', 'src', 'managed', 'counter'),
};

export interface Config {
  readonly networkId: string;
  readonly logDir: string;
  indexer: string;
  indexerWS: string;
  node: string;
  proofServer: string;
  readonly faucet?: string;
}

export class StandaloneConfig implements Config {
  networkId = 'undeployed';
  logDir = path.resolve(currentDir, '..', 'logs', 'standalone', `${new Date().toISOString()}.log`);
  indexer = 'http://127.0.0.1:8088/api/v4/graphql';
  indexerWS = 'ws://127.0.0.1:8088/api/v4/graphql/ws';
  node = 'http://127.0.0.1:9944';
  proofServer = 'http://127.0.0.1:6300';
}

export class PreviewConfig implements Config {
  networkId = 'preview';
  logDir = path.resolve(currentDir, '..', 'logs', 'preview', `${new Date().toISOString()}.log`);
  indexer = 'https://indexer.preview.midnight.network/api/v4/graphql';
  indexerWS = 'wss://indexer.preview.midnight.network/api/v4/graphql/ws';
  node = 'https://rpc.preview.midnight.network';
  proofServer = 'http://127.0.0.1:6300';
  faucet = 'https://faucet.preview.midnight.network/';
}

const blockfrostToken = (): string => {
  const t = process.env.BLOCKFROST_PROJECT_ID;   // a preprod token (nightpreprod…)
  if (!t) throw new Error('Preprod is served by Blockfrost: set BLOCKFROST_PROJECT_ID');
  return t;
};

export class PreprodConfig implements Config {
  networkId = 'preprod';
  logDir = path.resolve(currentDir, '..', 'logs', 'preprod', `${new Date().toISOString()}.log`);
  indexer = `https://midnight-preprod.blockfrost.io/api/v0?project_id=${blockfrostToken()}`;
  indexerWS = `wss://midnight-preprod.blockfrost.io/api/v0/ws?project_id=${blockfrostToken()}`;
  node = `https://rpc.midnight-preprod.blockfrost.io?project_id=${blockfrostToken()}`;
  proofServer = 'http://127.0.0.1:6300';
  faucet = 'https://midnight-tmnight-preprod.nethermind.dev/';
}
```

**Note:** local and preview use indexer API **v4** (`/api/v4/graphql`). The old "all networks use v3, do not change to v4" advice is obsolete. `indexer.preprod.midnight.network` was retired on 9 Oct 2026 (HTTP 410), and `rpc.preprod.midnight.network` shut down on 18 Nov 2026. Blockfrost URLs contain your token, so don't log them.

---

## 10) `counter-cli/src/common-types.ts`

```typescript
import { Counter, type CounterPrivateState } from '@midnight-ntwrk/counter-contract';
import type { MidnightProviders } from '@midnightntwrk/midnight-js-types';
import type { DeployedContract, FoundContract } from '@midnightntwrk/midnight-js-contracts';
import type { ProvableCircuitId } from '@midnight-ntwrk/compact-js';

export type CounterCircuits = ProvableCircuitId<Counter.Contract<CounterPrivateState>>;

export const CounterPrivateStateId = 'counterPrivateState';

export type CounterProviders = MidnightProviders<CounterCircuits, typeof CounterPrivateStateId, CounterPrivateState>;

export type CounterContract = Counter.Contract<CounterPrivateState>;

export type DeployedCounterContract = DeployedContract<CounterContract> | FoundContract<CounterContract>;
```

---

## 11) `counter-cli/src/logger-utils.ts`

```typescript
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import pinoPretty from 'pino-pretty';
import pino from 'pino';
import { createWriteStream } from 'node:fs';

export const createLogger = async (logPath: string): Promise<pino.Logger> => {
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  const pretty: pinoPretty.PrettyStream = pinoPretty({ colorize: true, sync: true });
  const level =
    process.env.DEBUG_LEVEL !== undefined && process.env.DEBUG_LEVEL !== null && process.env.DEBUG_LEVEL !== ''
      ? process.env.DEBUG_LEVEL
      : 'info';
  return pino(
    { level, depthLimit: 20 },
    pino.multistream([
      { stream: pretty, level },
      { stream: createWriteStream(logPath), level },
    ]),
  );
};
```

---

## 12) `counter-cli/src/api.ts`

Core API — wallet creation (Wallet SDK 2.x), contract deploy/join, increment, DUST management. Ported to Ledger 9; type-checked against Midnight.js 5.0.2 / Wallet SDK 2.0.1.

```typescript
import { type ContractAddress, ContractState } from '@midnight-ntwrk/compact-runtime';
import { Counter, type CounterPrivateState, witnesses } from '@midnight-ntwrk/counter-contract';
import { unshieldedToken } from '@midnightntwrk/ledger-v9';
import { deployContract, findDeployedContract } from '@midnightntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnightntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnightntwrk/midnight-js-indexer-public-data-provider';
import { NodeZkConfigProvider } from '@midnightntwrk/midnight-js-node-zk-config-provider';
import { createLedger9MidnightProvider, createLedger9WalletProvider } from '@midnightntwrk/midnight-js-types';
import { InMemoryTransactionHistoryStorage } from '@midnightntwrk/wallet-sdk-abstractions';
import { WalletFacade, WalletEntrySchema, type FacadeState } from '@midnightntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnightntwrk/wallet-sdk-dust-wallet';
import { WalletSeeds, generateRandomSeed } from '@midnightntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnightntwrk/wallet-sdk-shielded';
import {
  createKeystore,
  PublicKey,
  UnshieldedWallet,
  type UnshieldedKeystore,
} from '@midnightntwrk/wallet-sdk-unshielded-wallet';
import { type Logger } from 'pino';
import * as Rx from 'rxjs';
import { WebSocket } from 'ws';
import {
  type CounterCircuits,
  type CounterContract,
  CounterPrivateStateId,
  type CounterProviders,
  type DeployedCounterContract,
} from './common-types';
import { type Config, contractConfig } from './config';
import { levelPrivateStateProvider } from '@midnightntwrk/midnight-js-level-private-state-provider';
import { assertIsContractAddress, toHex } from '@midnightntwrk/midnight-js-utils';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { Buffer } from 'buffer';
import {
  MidnightBech32m,
  ShieldedAddress,
  ShieldedCoinPublicKey,
  ShieldedEncryptionPublicKey,
} from '@midnightntwrk/wallet-sdk-address-format';

let logger: Logger;

globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

const counterCompiledContract = CompiledContract.make('counter', Counter.Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(contractConfig.zkConfigPath),
);

export interface WalletContext {
  wallet: WalletFacade;
  seeds: WalletSeeds;            // Wallet SDK 2.x starts from seeds, not key objects
  unshieldedKeystore: UnshieldedKeystore;
  networkId: string;
}

export const getCounterLedgerState = async (
  providers: CounterProviders,
  contractAddress: ContractAddress,
): Promise<bigint | null> => {
  assertIsContractAddress(contractAddress);
  logger.info('Checking contract ledger state...');
  const state = await providers.publicDataProvider
    .queryContractState(contractAddress)
    // Midnight.js 5 returns era-tagged bytes; decode with this app's own compact-runtime copy
    .then((read) => (read != null ? Counter.ledger(read.contractState.deserialize({ v9: ContractState }).data).round : null));
  logger.info(`Ledger state: ${state}`);
  return state;
};

export const counterContractInstance: CounterContract = new Counter.Contract(witnesses);

export const joinContract = async (
  providers: CounterProviders,
  contractAddress: string,
): Promise<DeployedCounterContract> => {
  const counterContract = await findDeployedContract(providers, {
    contractAddress,
    compiledContract: counterCompiledContract,
    privateStateId: 'counterPrivateState',
    initialPrivateState: { privateCounter: 0 },
  });
  logger.info(`Joined contract at address: ${counterContract.deployTxData.public.contractAddress}`);
  return counterContract;
};

export const deploy = async (
  providers: CounterProviders,
  privateState: CounterPrivateState,
): Promise<DeployedCounterContract> => {
  logger.info('Deploying counter contract...');
  const counterContract = await deployContract(providers, {
    compiledContract: counterCompiledContract,
    privateStateId: 'counterPrivateState',
    initialPrivateState: privateState,
  });
  logger.info(`Deployed contract at address: ${counterContract.deployTxData.public.contractAddress}`);
  return counterContract;
};

export const increment = async (counterContract: DeployedCounterContract) => {
  logger.info('Incrementing...');
  const finalizedTxData = await counterContract.callTx.increment();
  logger.info(`Transaction ${finalizedTxData.public.txId} added in block ${finalizedTxData.public.blockHeight}`);
  return finalizedTxData.public;
};

export const displayCounterValue = async (
  providers: CounterProviders,
  counterContract: DeployedCounterContract,
): Promise<{ counterValue: bigint | null; contractAddress: string }> => {
  const contractAddress = counterContract.deployTxData.public.contractAddress;
  const counterValue = await getCounterLedgerState(providers, contractAddress);
  if (counterValue === null) {
    logger.info(`There is no counter contract deployed at ${contractAddress}.`);
  } else {
    logger.info(`Current counter value: ${Number(counterValue)}`);
  }
  return { contractAddress, counterValue };
};

// Wallet SDK 2.x: signRecipe signs each part at its own stage, so the old
// signTransactionIntents ("Failed to clone intent") workaround is gone.
export const createWalletAndMidnightProvider = async (ctx: WalletContext) => {
  const state = await ctx.wallet.waitForSyncedState();
  const signSegment = (payload: Uint8Array) => Promise.resolve(ctx.unshieldedKeystore.signData(payload));
  const walletProvider = createLedger9WalletProvider({
    getCoinPublicKey: () => state.shielded.coinPublicKey.toHexString(),
    getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
    async balanceTx(tx, ttl) {
      const recipe = await ctx.wallet.balanceUnboundTransaction(ctx.wallet.adoptTransaction(tx.serialize(), 'Unbound'), {
        ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000),
      });
      return ctx.wallet.finalizeRecipe(await ctx.wallet.signRecipe(recipe, signSegment));
    },
  });
  const midnightProvider = createLedger9MidnightProvider((tx) =>
    ctx.wallet.submitTransaction(ctx.wallet.adoptTransaction(tx.serialize(), 'Finalized')),
  );
  return { walletProvider, midnightProvider };
};

export const waitForSync = (wallet: WalletFacade) =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(5_000),
      Rx.filter((state) => state.isSynced),
    ),
  );

export const waitForFunds = (wallet: WalletFacade): Promise<bigint> =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(10_000),
      Rx.filter((state) => state.isSynced),
      Rx.map((s) => s.unshielded.balances[unshieldedToken().raw] ?? 0n),
      Rx.filter((balance) => balance > 0n),
    ),
  );

// One configuration for WalletFacade.init (Wallet SDK 2.x); `forks` defaults to DefaultForkSchedule.
const buildWalletConfig = ({ networkId, indexer, indexerWS, node, proofServer }: Config) => ({
  networkId,
  indexerClientConnection: { indexerHttpUrl: indexer, indexerWsUrl: indexerWS },
  provingServerUrl: new URL(proofServer),
  relayURL: new URL(node.replace(/^http/, 'ws')),
  costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
  txHistoryStorage: new InMemoryTransactionHistoryStorage(WalletEntrySchema),
});

const formatBalance = (balance: bigint): string => balance.toLocaleString();

export const withStatus = async <T>(message: string, fn: () => Promise<T>): Promise<T> => {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r  ${frames[i++ % frames.length]} ${message}`);
  }, 80);
  try {
    const result = await fn();
    clearInterval(interval);
    process.stdout.write(`\r  ✓ ${message}\n`);
    return result;
  } catch (e) {
    clearInterval(interval);
    process.stdout.write(`\r  ✗ ${message}\n`);
    throw e;
  }
};

const registerForDustGeneration = async (
  wallet: WalletFacade,
  unshieldedKeystore: UnshieldedKeystore,
): Promise<void> => {
  const state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));

  if (state.dust.availableCoins.length > 0) {
    const dustBal = state.dust.balance(new Date());
    console.log(`  ✓ Dust tokens already available (${formatBalance(dustBal)} DUST)`);
    return;
  }

  const nightUtxos = state.unshielded.availableCoins.filter(
    (coin: any) => coin.meta?.registeredForDustGeneration !== true,
  );
  if (nightUtxos.length === 0) {
    await withStatus('Waiting for dust tokens to generate', () =>
      Rx.firstValueFrom(
        wallet.state().pipe(
          Rx.throttleTime(5_000),
          Rx.filter((s) => s.isSynced),
          Rx.filter((s) => s.dust.balance(new Date()) > 0n),
        ),
      ),
    );
    return;
  }

  await withStatus(`Registering ${nightUtxos.length} NIGHT UTXO(s) for dust generation`, async () => {
    const recipe = await wallet.registerNightUtxosForDustGeneration(
      nightUtxos,
      unshieldedKeystore.getPublicKey(),
      (payload) => Promise.resolve(unshieldedKeystore.signData(payload)),
    );
    const finalized = await wallet.finalizeRecipe(recipe);
    await wallet.submitTransaction(finalized);
  });

  await withStatus('Waiting for dust tokens to generate', () =>
    Rx.firstValueFrom(
      wallet.state().pipe(
        Rx.throttleTime(5_000),
        Rx.filter((s) => s.isSynced),
        Rx.filter((s) => s.dust.balance(new Date()) > 0n),
      ),
    ),
  );
};

const printWalletSummary = (state: FacadeState, unshieldedKeystore: UnshieldedKeystore, networkId: string) => {
  const unshieldedBalance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;

  const coinPubKey = ShieldedCoinPublicKey.fromHexString(state.shielded.coinPublicKey.toHexString());
  const encPubKey = ShieldedEncryptionPublicKey.fromHexString(state.shielded.encryptionPublicKey.toHexString());
  const shieldedAddress = MidnightBech32m.encode(networkId, new ShieldedAddress(coinPubKey, encPubKey)).toString();

  const DIV = '──────────────────────────────────────────────────────────────';

  console.log(`
${DIV}
  Wallet Overview                            Network: ${networkId}
${DIV}

  Shielded (ZSwap)
  └─ Address: ${shieldedAddress}

  Unshielded
  ├─ Address: ${unshieldedKeystore.getBech32Address().asString()}
  └─ Balance: ${formatBalance(unshieldedBalance)} tNight

  Dust
  └─ Address: ${MidnightBech32m.encode(networkId, state.dust.address).toString()}

${DIV}`);
};

export const buildWalletAndWaitForFunds = async (config: Config, seed: string): Promise<WalletContext> => {
  console.log('');

  const { wallet, seeds, unshieldedKeystore } = await withStatus('Building wallet', async () => {
    const seeds = WalletSeeds.fromMasterSeed(Buffer.from(seed, 'hex'));   // account 0 / index 0, as before
    const unshieldedKeystore = createKeystore({ kind: 'schnorr', secret: seeds.unshielded }, config.networkId);
    const wallet = await WalletFacade.init({
      configuration: buildWalletConfig(config),
      shielded: (cfg) => ShieldedWallet(cfg).startWithSeed(seeds.shielded),
      unshielded: (cfg) => UnshieldedWallet(cfg).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
      dust: (cfg) => DustWallet(cfg).startWithSeed(seeds.dust),
    });
    await wallet.start(seeds);
    return { wallet, seeds, unshieldedKeystore };
  });

  const DIV = '──────────────────────────────────────────────────────────────';
  console.log(`
${DIV}
  Wallet Overview                            Network: ${config.networkId}
${DIV}
  Unshielded Address (send tNight here):
  ${unshieldedKeystore.getBech32Address().asString()}
${config.faucet ? `
  Fund your wallet with tNight from the faucet:
  ${config.faucet}` : ''}
${DIV}
`);

  const syncedState = await withStatus('Syncing with network', () => waitForSync(wallet));
  printWalletSummary(syncedState, unshieldedKeystore, config.networkId);

  const balance = syncedState.unshielded.balances[unshieldedToken().raw] ?? 0n;
  if (balance === 0n) {
    const fundedBalance = await withStatus('Waiting for incoming tokens', () => waitForFunds(wallet));
    console.log(`    Balance: ${formatBalance(fundedBalance)} tNight\n`);
  }

  await registerForDustGeneration(wallet, unshieldedKeystore);

  return { wallet, seeds, unshieldedKeystore, networkId: config.networkId };
};

export const buildFreshWallet = async (config: Config): Promise<WalletContext> => {
  const seed = toHex(Buffer.from(generateRandomSeed()));
  const DIV = '──────────────────────────────────────────────────────────────';
  console.log(`
${DIV}
  New Wallet Seed — save this before continuing
${DIV}
  ${seed}
${DIV}
`);
  return await buildWalletAndWaitForFunds(config, seed);
};

export const configureProviders = async (ctx: WalletContext, config: Config) => {
  const { walletProvider, midnightProvider } = await createWalletAndMidnightProvider(ctx);
  const zkConfigProvider = new NodeZkConfigProvider<CounterCircuits>(contractConfig.zkConfigPath);
  const accountId = walletProvider.getCoinPublicKey();
  const storagePassword = `${Buffer.from(accountId, 'hex').toString('base64')}!`;
  const providers: CounterProviders = {
    privateStateProvider: levelPrivateStateProvider<typeof CounterPrivateStateId>({
      privateStateStoreName: contractConfig.privateStateStoreName,
      accountId,
      privateStoragePasswordProvider: () => storagePassword,
    }),
    publicDataProvider: indexerPublicDataProvider({ queryURL: config.indexer, subscriptionURL: config.indexerWS }),
    zkConfigProvider,
    proofProvider: httpClientProofProvider({ url: config.proofServer, zkConfigProvider }),
    walletProvider,
    midnightProvider,
    config: { networkId: config.networkId, ttlSeconds: 30 * 60 },   // replaces setNetworkId
  };
  return providers;
};

export const getDustBalance = async (
  wallet: WalletFacade,
): Promise<{ available: bigint; pending: bigint; availableCoins: number; pendingCoins: number }> => {
  const state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  const available = state.dust.balance(new Date());
  const availableCoins = state.dust.availableCoins.length;
  const pendingCoins = state.dust.pendingCoins.length;
  const pending = state.dust.pendingCoins.reduce((sum, c) => sum + c.token.initialValue, 0n); // 2.x: DustFullInfo.token
  return { available, pending, availableCoins, pendingCoins };
};

export const monitorDustBalance = async (wallet: WalletFacade, stopSignal: Promise<void>): Promise<void> => {
  let stopped = false;
  void stopSignal.then(() => { stopped = true; });

  const sub = wallet
    .state()
    .pipe(
      Rx.throttleTime(5_000),
      Rx.filter((s) => s.isSynced),
    )
    .subscribe((state) => {
      if (stopped) return;

      const now = new Date();
      const available = state.dust.balance(now);
      const availableCoins = state.dust.availableCoins.length;
      const pendingCoins = state.dust.pendingCoins.length;

      const registeredNight = state.unshielded.availableCoins.filter(
        (coin: any) => coin.meta?.registeredForDustGeneration === true,
      ).length;
      const totalNight = state.unshielded.availableCoins.length;

      let status = '';
      if (pendingCoins > 0 && availableCoins === 0) {
        status = '⚠ booked by a pending tx (released on rejection, TTL or sync)';
      } else if (available > 0n) {
        status = '✓ ready to deploy';
      } else if (availableCoins > 0) {
        status = 'accruing...';
      } else if (registeredNight > 0) {
        status = 'waiting for generation...';
      } else {
        status = 'no NIGHT registered';
      }

      const time = now.toLocaleTimeString();
      console.log(
        `  [${time}] DUST: ${formatBalance(available)} (${availableCoins} coins, ${pendingCoins} pending) | NIGHT: ${totalNight} UTXOs, ${registeredNight} registered | ${status}`,
      );
    });

  await stopSignal;
  sub.unsubscribe();
};

export function setLogger(_logger: Logger) {
  logger = _logger;
}
```

**Key points:**
- `globalThis.WebSocket = WebSocket` is required for GraphQL subscriptions (wallet sync) in Node.js
- `WalletFacade.init()` with `WalletSeeds.fromMasterSeed(seed)`; the facade is started with the seeds (`wallet.start(seeds)`)
- Era-aware providers via `createLedger9WalletProvider` / `createLedger9MidnightProvider`; the old `signTransactionIntents` workaround is gone
- `providers.config = { networkId, ttlSeconds }` replaces `setNetworkId`
- DUST balance is `state.dust.balance(time)`; the registration signer returns a Promise (`SignSegment`)

---

## 13) `counter-cli/src/cli.ts`

Interactive CLI with wallet setup, deploy/join, and counter interaction menus. Supports Docker lifecycle via testcontainers.

```typescript
import { type WalletContext } from './api';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface, type Interface } from 'node:readline/promises';
import { type Logger } from 'pino';
import { type StartedDockerComposeEnvironment, type DockerComposeEnvironment } from 'testcontainers';
import { type CounterProviders, type DeployedCounterContract } from './common-types';
import { type Config, StandaloneConfig } from './config';
import * as api from './api';

let logger: Logger;

const GENESIS_MINT_WALLET_SEED = '0000000000000000000000000000000000000000000000000000000000000001';

const BANNER = `
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║              Midnight Counter Example                        ║
║              ─────────────────────                           ║
║              A privacy-preserving smart contract demo        ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`;

const DIVIDER = '──────────────────────────────────────────────────────────────';

const WALLET_MENU = `
${DIVIDER}
  Wallet Setup
${DIVIDER}
  [1] Create a new wallet
  [2] Restore wallet from seed
  [3] Exit
${'─'.repeat(62)}
> `;

const contractMenu = (dustBalance: string) => `
${DIVIDER}
  Contract Actions${dustBalance ? `                    DUST: ${dustBalance}` : ''}
${DIVIDER}
  [1] Deploy a new counter contract
  [2] Join an existing counter contract
  [3] Monitor DUST balance
  [4] Exit
${'─'.repeat(62)}
> `;

const counterMenu = (dustBalance: string) => `
${DIVIDER}
  Counter Actions${dustBalance ? `                     DUST: ${dustBalance}` : ''}
${DIVIDER}
  [1] Increment counter
  [2] Display current counter value
  [3] Exit
${'─'.repeat(62)}
> `;

const buildWalletFromSeed = async (config: Config, rli: Interface): Promise<WalletContext> => {
  const seed = await rli.question('Enter your wallet seed: ');
  return await api.buildWalletAndWaitForFunds(config, seed);
};

const buildWallet = async (config: Config, rli: Interface): Promise<WalletContext | null> => {
  if (config instanceof StandaloneConfig) {
    return await api.buildWalletAndWaitForFunds(config, GENESIS_MINT_WALLET_SEED);
  }

  while (true) {
    const choice = await rli.question(WALLET_MENU);
    switch (choice.trim()) {
      case '1':
        return await api.buildFreshWallet(config);
      case '2':
        return await buildWalletFromSeed(config, rli);
      case '3':
        return null;
      default:
        logger.error(`Invalid choice: ${choice}`);
    }
  }
};

const getDustLabel = async (wallet: api.WalletContext['wallet']): Promise<string> => {
  try {
    const dust = await api.getDustBalance(wallet);
    return dust.available.toLocaleString();
  } catch {
    return '';
  }
};

const joinContract = async (providers: CounterProviders, rli: Interface): Promise<DeployedCounterContract> => {
  const contractAddress = await rli.question('Enter the contract address (hex): ');
  return await api.joinContract(providers, contractAddress);
};

const startDustMonitor = async (wallet: api.WalletContext['wallet'], rli: Interface): Promise<void> => {
  console.log('');
  const stopPromise = rli.question('  Press Enter to return to menu...\n').then(() => {});
  await api.monitorDustBalance(wallet, stopPromise);
  console.log('');
};

const deployOrJoin = async (
  providers: CounterProviders,
  walletCtx: api.WalletContext,
  rli: Interface,
): Promise<DeployedCounterContract | null> => {
  while (true) {
    const dustLabel = await getDustLabel(walletCtx.wallet);
    const choice = await rli.question(contractMenu(dustLabel));
    switch (choice.trim()) {
      case '1':
        try {
          const contract = await api.withStatus('Deploying counter contract', () =>
            api.deploy(providers, { privateCounter: 0 }),
          );
          console.log(`  Contract deployed at: ${contract.deployTxData.public.contractAddress}\n`);
          return contract;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`\n  ✗ Deploy failed: ${msg}`);
          if (e instanceof Error && e.cause) {
            let cause: unknown = e.cause;
            let depth = 0;
            while (cause && depth < 5) {
              const causeMsg =
                cause instanceof Error
                  ? `${cause.message}\n      ${cause.stack?.split('\n').slice(1, 3).join('\n      ') ?? ''}`
                  : String(cause);
              console.log(`    cause: ${causeMsg}`);
              cause = cause instanceof Error ? cause.cause : undefined;
              depth++;
            }
          }
          if (msg.toLowerCase().includes('dust') || msg.toLowerCase().includes('no dust')) {
            console.log('    Insufficient DUST for transaction fees. Use option [3] to monitor your balance.');
          }
          console.log('');
        }
        break;
      case '2':
        try {
          return await joinContract(providers, rli);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`  ✗ Failed to join contract: ${msg}\n`);
        }
        break;
      case '3':
        await startDustMonitor(walletCtx.wallet, rli);
        break;
      case '4':
        return null;
      default:
        console.log(`  Invalid choice: ${choice}`);
    }
  }
};

const mainLoop = async (providers: CounterProviders, walletCtx: api.WalletContext, rli: Interface): Promise<void> => {
  const counterContract = await deployOrJoin(providers, walletCtx, rli);
  if (counterContract === null) {
    return;
  }

  while (true) {
    const dustLabel = await getDustLabel(walletCtx.wallet);
    const choice = await rli.question(counterMenu(dustLabel));
    switch (choice.trim()) {
      case '1':
        try {
          await api.withStatus('Incrementing counter', () => api.increment(counterContract));
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`  ✗ Increment failed: ${msg}\n`);
        }
        break;
      case '2':
        await api.displayCounterValue(providers, counterContract);
        break;
      case '3':
        return;
      default:
        console.log(`  Invalid choice: ${choice}`);
    }
  }
};

const mapContainerPort = (env: StartedDockerComposeEnvironment, url: string, containerName: string) => {
  const mappedUrl = new URL(url);
  const container = env.getContainer(containerName);
  mappedUrl.port = String(container.getFirstMappedPort());
  return mappedUrl.toString().replace(/\/+$/, '');
};

export const run = async (config: Config, _logger: Logger, dockerEnv?: DockerComposeEnvironment): Promise<void> => {
  logger = _logger;
  api.setLogger(_logger);

  console.log(BANNER);

  const rli = createInterface({ input, output, terminal: true });
  let env: StartedDockerComposeEnvironment | undefined;

  try {
    if (dockerEnv !== undefined) {
      env = await dockerEnv.up();
      if (config instanceof StandaloneConfig) {
        config.indexer = mapContainerPort(env, config.indexer, 'counter-indexer');
        config.indexerWS = mapContainerPort(env, config.indexerWS, 'counter-indexer');
        config.node = mapContainerPort(env, config.node, 'counter-node');
        config.proofServer = mapContainerPort(env, config.proofServer, 'counter-proof-server');
      }
    }

    const walletCtx = await buildWallet(config, rli);
    if (walletCtx === null) {
      return;
    }

    try {
      const providers = await api.withStatus('Configuring providers', () => api.configureProviders(walletCtx, config));
      console.log('');
      await mainLoop(providers, walletCtx, rli);
    } catch (e) {
      if (e instanceof Error) {
        logger.error(`Error: ${e.message}`);
        logger.debug(`${e.stack}`);
      } else {
        throw e;
      }
    } finally {
      try {
        await walletCtx.wallet.stop();
      } catch (e) {
        logger.error(`Error stopping wallet: ${e}`);
      }
    }
  } finally {
    rli.close();
    rli.removeAllListeners();

    if (env !== undefined) {
      try {
        await env.down();
      } catch (e) {
        logger.error(`Error shutting down docker environment: ${e}`);
      }
    }

    logger.info('Goodbye.');
  }
};
```

---

## 14) Entry Points

### `counter-cli/src/preprod.ts`

```typescript
import { createLogger } from './logger-utils.js';
import { run } from './cli.js';
import { PreprodConfig } from './config.js';

const config = new PreprodConfig();
const logger = await createLogger(config.logDir);
await run(config, logger);
```

### `counter-cli/src/preview.ts`

```typescript
import { createLogger } from './logger-utils.js';
import { run } from './cli.js';
import { PreviewConfig } from './config.js';

const config = new PreviewConfig();
const logger = await createLogger(config.logDir);
await run(config, logger);
```

### `counter-cli/src/standalone.ts`

```typescript
import { createLogger } from './logger-utils.js';
import path from 'node:path';
import { run } from './cli.js';
import { DockerComposeEnvironment, Wait } from 'testcontainers';
import { currentDir, StandaloneConfig } from './config.js';

const config = new StandaloneConfig();
const dockerEnv = new DockerComposeEnvironment(path.resolve(currentDir, '..'), 'standalone.yml')
  .withWaitStrategy('counter-proof-server', Wait.forLogMessage('Actix runtime found; starting in Actix runtime', 1))
  .withWaitStrategy('counter-indexer', Wait.forLogMessage(/starting indexing/, 1));
const logger = await createLogger(config.logDir);
await run(config, logger, dockerEnv);
```

### `counter-cli/src/preprod-start-proof-server.ts`

```typescript
import { createLogger } from './logger-utils.js';
import { run } from './cli.js';
import { currentDir, PreprodConfig } from './config.js';
import { DockerComposeEnvironment, Wait } from 'testcontainers';
import path from 'node:path';

const config = new PreprodConfig();
const dockerEnv = new DockerComposeEnvironment(path.resolve(currentDir, '..'), 'proof-server.yml').withWaitStrategy(
  'proof-server',
  Wait.forLogMessage('Actix runtime found; starting in Actix runtime', 1),
);
const logger = await createLogger(config.logDir);
await run(config, logger, dockerEnv);
```

### `counter-cli/src/preview-start-proof-server.ts`

```typescript
import { createLogger } from './logger-utils.js';
import { run } from './cli.js';
import { currentDir, PreviewConfig } from './config.js';
import { DockerComposeEnvironment, Wait } from 'testcontainers';
import path from 'node:path';

const config = new PreviewConfig();
const dockerEnv = new DockerComposeEnvironment(path.resolve(currentDir, '..'), 'proof-server.yml').withWaitStrategy(
  'proof-server',
  Wait.forLogMessage('Actix runtime found; starting in Actix runtime', 1),
);
const logger = await createLogger(config.logDir);
await run(config, logger, dockerEnv);
```

### `counter-cli/src/index.ts`

```typescript
export * from './api';
export * from './cli';
```

---

## 15) TypeScript Config

### `contract/tsconfig.json`

```json
{
  "include": ["src/**/*.ts"],
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "lib": ["ES2022"],
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "allowJs": true,
    "forceConsistentCasingInFileNames": true,
    "noImplicitAny": true,
    "strict": true,
    "isolatedModules": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  }
}
```

### `contract/tsconfig.build.json`

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["src/test/**/*.ts"],
  "compilerOptions": {
    "noEmit": false
  }
}
```

### `counter-cli/tsconfig.json`

```json
{
  "include": ["src/**/*.ts"],
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "lib": ["ES2022"],
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "allowJs": true,
    "forceConsistentCasingInFileNames": true,
    "noImplicitAny": true,
    "strict": true,
    "isolatedModules": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@contract/*": ["../../contract/src/*"]
    }
  }
}
```

### `counter-cli/tsconfig.build.json`

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["src/**/*.test.ts"],
  "compilerOptions": {
    "noEmit": false
  }
}
```

---

## 16) Docker Config Files

### Root `compose.yml` (full local stack, localhost-only bindings)

```yaml
services:
  proof-server:
    image: 'midnightntwrk/proof-server:9.0.2'
    command: ['midnight-proof-server', '-v']
    ports:
      - '127.0.0.1:6300:6300'
    environment:
      RUST_BACKTRACE: 'full'
    healthcheck:
      test: ['CMD-SHELL', 'echo > /dev/tcp/127.0.0.1/6300']
      interval: 10s
      timeout: 5s
      retries: 20
      start_period: 10s

  indexer:
    image: 'midnightntwrk/indexer-standalone:4.4.101'
    ports:
      - '127.0.0.1:8088:8088'
    environment:
      RUST_LOG: 'indexer=info,chain_indexer=info,indexer_api=info,wallet_indexer=info,indexer_common=info,fastrace_opentelemetry=off,info'
      APP__INFRA__NODE__URL: 'ws://node:9944'
      APP__APPLICATION__NETWORK_ID: 'undeployed'
      APP__INFRA__STORAGE__PASSWORD: 'indexer'
      APP__INFRA__PUB_SUB__PASSWORD: 'indexer'
      APP__INFRA__LEDGER_STATE_STORAGE__PASSWORD: 'indexer'
      APP__INFRA__SECRET: '303132333435363738393031323334353637383930313233343536373839303132'
    healthcheck:
      test: ['CMD-SHELL', 'cat /var/run/indexer-standalone/running']
      interval: 10s
      timeout: 5s
      retries: 20
      start_period: 10s
    depends_on:
      node:
        condition: service_healthy

  node:
    image: 'midnightntwrk/midnight-node:2.1.101'
    ports:
      - '127.0.0.1:9944:9944'
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:9944/health']
      interval: 2s
      timeout: 5s
      retries: 20
      start_period: 5s
    environment:
      CFG_PRESET: 'dev'
      SIDECHAIN_BLOCK_BENEFICIARY: '04bcf7ad3be7a5c790460be82a713af570f22e0f801f6659ab8e84a52be6969e'
```

### `counter-cli/proof-server.yml` (preprod/preview — proof server only)

```yaml
services:
  proof-server:
    image: 'midnightntwrk/proof-server:9.0.2'
    command: ['midnight-proof-server -v']
    ports:
      - '6300:6300'
    environment:
      RUST_BACKTRACE: 'full'
```

### `counter-cli/standalone.yml` (undeployed — full local stack with named containers)

```yaml
services:
  proof-server:
    container_name: 'counter-proof-server'
    image: 'midnightntwrk/proof-server:9.0.2'
    command: ['midnight-proof-server -v']
    ports:
      - '6300'
    environment:
      RUST_BACKTRACE: 'full'
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:6300/version']
      interval: 10s
      timeout: 5s
      retries: 20
      start_period: 10s

  indexer:
    container_name: 'counter-indexer'
    image: 'midnightntwrk/indexer-standalone:4.4.101'
    env_file: standalone.env.example
    ports:
      - '0:8088'
    environment:
      RUST_LOG: 'indexer=info,chain_indexer=info,indexer_api=info,wallet_indexer=info,indexer_common=info,fastrace_opentelemetry=off,info'
      APP__APPLICATION__NETWORK_ID: 'undeployed'
    healthcheck:
      test: ['CMD-SHELL', 'cat /var/run/indexer-standalone/running']
      interval: 10s
      timeout: 5s
      retries: 20
      start_period: 10s
    depends_on:
      node:
        condition: service_healthy

  node:
    image: 'midnightntwrk/midnight-node:2.1.101'
    container_name: 'counter-node'
    ports:
      - '9944'
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:9944/health']
      interval: 2s
      timeout: 5s
      retries: 20
      start_period: 20s
    environment:
      CFG_PRESET: 'dev'
      SIDECHAIN_BLOCK_BENEFICIARY: '04bcf7ad3be7a5c790460be82a713af570f22e0f801f6659ab8e84a52be6969e'
```

### `counter-cli/standalone.env.example`

```
APP__INFRA__NODE__URL=ws://node:9944
APP__INFRA__STORAGE__PASSWORD=indexer
APP__INFRA__PUB_SUB__PASSWORD=indexer
APP__INFRA__LEDGER_STATE_STORAGE__PASSWORD=indexer
APP__INFRA__SECRET=303132333435363738393031323334353637383930313233343536373839303132
```

---

## 17) Test Infrastructure

### `contract/vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  mode: "node",
  test: {
    deps: { interopDefault: true },
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules"],
    root: ".",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        branches: 50,
        functions: 73,
        lines: 72,
        statements: -269,
      },
    },
    reporters: ["default", ["junit", { outputFile: "reports/report.xml" }]],
  },
  resolve: {
    extensions: [".ts", ".js"],
    conditions: ["import", "node", "default"],
  },
});
```

### `counter-cli/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  mode: 'node',
  test: {
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 1000 * 60 * 45,
    deps: { interopDefault: true },
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules'],
    root: '.',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        branches: 50,
        functions: 73,
        lines: 72,
        statements: -269,
      },
    },
    reporters: ["default", ["junit", { outputFile: "reports/report.xml" }]],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    conditions: ['import', 'node', 'default'],
  },
});
```

### `counter-cli/vitest.setup.ts`

```typescript
import protobuf from 'protobufjs';
import Long from 'long';

protobuf.util.Long = Long;
protobuf.configure();
```

---

## 18) First Run — Preprod

```bash
# 1. Install deps
yarn

# 2. Compile contract (from contract/ directory)
cd contract && npm run compact && cd ..
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

## 19) First Run — Local (standalone)

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

## 20) Running Tests

```bash
# Contract unit tests (from contract/ directory)
cd contract && npm run test:compile

# API integration tests (from counter-cli/ directory)
cd counter-cli && yarn test-api

# Full validation (from root)
yarn validate
```

---

## 21) Troubleshooting

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
| `Cannot find module` | Contract not compiled | `cd contract && npm run compact` |
| `prove: no SRS params for k=6` | Circuit too small for prover | Add dummy ledger fields to increase circuit size |
| Old address fails after recompile | Verifier key changed | Redeploy contract |

---

## 22) Adapting This Template

To replace the counter with your own contract:

1. Replace `contract/src/counter.compact` with your contract
2. Run `cd contract && npm run compact`
3. Update `contract/src/witnesses.ts` with your private state type
4. Update `contract/src/index.ts` to export your contract symbols
5. In `counter-cli/src/common-types.ts` — update type aliases for your circuits
6. In `counter-cli/src/api.ts`:
   - Update imports to use your contract package
   - Update `counterCompiledContract` with your contract reference
   - Update `counterContractInstance`, `deploy`, `joinContract` as needed
   - Replace `increment` with your circuit calls
   - Replace `Counter.ledger(contractState.data)` with your ledger field
7. Rename `privateStateStoreName` in `config.ts` to avoid LevelDB collisions
