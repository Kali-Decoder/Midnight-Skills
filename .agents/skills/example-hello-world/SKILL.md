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

**Package versions in this skill match the official compatibility matrix (May 2026).** Always cross-check against the support matrix before pinning versions — Midnight packages update frequently and version mismatches cause `ETARGET` errors at install time.

**Key architecture notes:**
- Uses `@midnight-ntwrk/testkit-js` `FluentWalletBuilder` for wallet creation
- Uses `@midnight-ntwrk/midnight-js-contracts` `deployContract` and `submitCallTx`
- Compact pragma is `>= 0.23`
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
    "@midnight-ntwrk/compact-runtime": "0.16.0",
    "@midnight-ntwrk/ledger-v8": "8.0.3",
    "@midnight-ntwrk/midnight-js-contracts": "4.0.4",
    "@midnight-ntwrk/midnight-js-http-client-proof-provider": "4.0.4",
    "@midnight-ntwrk/midnight-js-indexer-public-data-provider": "4.0.4",
    "@midnight-ntwrk/midnight-js-level-private-state-provider": "4.0.4",
    "@midnight-ntwrk/midnight-js-network-id": "4.0.4",
    "@midnight-ntwrk/midnight-js-node-zk-config-provider": "4.0.4",
    "@midnight-ntwrk/midnight-js-types": "4.0.4",
    "@midnight-ntwrk/midnight-js-utils": "4.0.4",
    "@midnight-ntwrk/testkit-js": "4.0.4",
    "@midnight-ntwrk/wallet-sdk-facade": "3.0.0",
    "axios": "^1.15.0",
    "pino": "^9.0.0",
    "pino-pretty": "^13.0.0",
    "rxjs": "^7.8.2",
    "testcontainers": "^11.13.0",
    "ws": "^8.14.2"
  },
  "devDependencies": {
    "@midnight-ntwrk/midnight-js-compact": "4.0.4",
    "@types/node": "^22.0.0",
    "@types/ws": "^8.5.9",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  },
  "resolutions": {
    "@midnight-ntwrk/ledger-v8": "8.0.3",
    "@midnight-ntwrk/midnight-js-network-id": "4.0.4",
    "@midnight-ntwrk/compact-runtime": "0.16.0"
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
pragma language_version >= 0.23;

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
import { CompiledContract } from '@midnight-ntwrk/compact-runtime';
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

export const CompiledHelloWorldContract = CompiledContract.make(
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

```typescript
import {
  type CoinPublicKey,
  DustSecretKey,
  type EncPublicKey,
  type FinalizedTransaction,
  LedgerParameters,
  ZswapSecretKeys,
} from '@midnight-ntwrk/ledger-v8';
import {
  type MidnightProvider,
  type UnboundTransaction,
  type WalletProvider,
} from '@midnight-ntwrk/midnight-js-types';
import { ttlOneHour } from '@midnight-ntwrk/midnight-js-utils';
import { type WalletFacade, type FacadeState } from '@midnight-ntwrk/wallet-sdk-facade';
import {
  type DustWalletOptions,
  type EnvironmentConfiguration,
  FluentWalletBuilder,
} from '@midnight-ntwrk/testkit-js';
import * as Rx from 'rxjs';
import type { Logger } from 'pino';

export class MidnightWalletProvider implements MidnightProvider, WalletProvider {
  readonly wallet: WalletFacade;

  private constructor(
    private readonly logger: Logger,
    wallet: WalletFacade,
    private readonly zswapSecretKeys: ZswapSecretKeys,
    private readonly dustSecretKey: DustSecretKey,
  ) {
    this.wallet = wallet;
  }

  getCoinPublicKey(): CoinPublicKey {
    return this.zswapSecretKeys.coinPublicKey;
  }

  getEncryptionPublicKey(): EncPublicKey {
    return this.zswapSecretKeys.encryptionPublicKey;
  }

  async balanceTx(
    tx: UnboundTransaction,
    ttl: Date = ttlOneHour(),
  ): Promise<FinalizedTransaction> {
    const recipe = await this.wallet.balanceUnboundTransaction(
      tx,
      {
        shieldedSecretKeys: this.zswapSecretKeys,
        dustSecretKey: this.dustSecretKey,
      },
      { ttl },
    );
    return await this.wallet.finalizeRecipe(recipe);
  }

  submitTx(tx: FinalizedTransaction): Promise<string> {
    return this.wallet.submitTransaction(tx);
  }

  async start(): Promise<void> {
    this.logger.info('Starting wallet...');
    await this.wallet.start(this.zswapSecretKeys, this.dustSecretKey);
  }

  async stop(): Promise<void> {
    return this.wallet.stop();
  }

  static async build(
    logger: Logger,
    env: EnvironmentConfiguration,
    seed: string,
  ): Promise<MidnightWalletProvider> {
    const dustOptions: DustWalletOptions = {
      ledgerParams: LedgerParameters.initialParameters(),
      additionalFeeOverhead: 1_000n,
      feeBlocksMargin: 5,
    };

    const builder = FluentWalletBuilder.forEnvironment(env)
      .withDustOptions(dustOptions);

    // buildWithoutStarting() returns { wallet, seeds } — seeds contains
    // the derived key material. The cast reflects the documented testkit-js
    // pattern; verify against your installed version if you see type errors.
    const buildResult = await builder.withSeed(seed).buildWithoutStarting();
    const { wallet, seeds } = buildResult as {
      wallet: WalletFacade;
      seeds: {
        masterSeed: string;
        shielded: Uint8Array;
        dust: Uint8Array;
      };
    };

    logger.info(`Wallet built from seed: ${seeds.masterSeed.slice(0, 8)}...`);

    return new MidnightWalletProvider(
      logger,
      wallet,
      ZswapSecretKeys.fromSeed(seeds.shielded),
      DustSecretKey.fromSeed(seeds.dust),
    );
  }
}

function isProgressStrictlyComplete(progress: unknown): boolean {
  if (!progress || typeof progress !== 'object') {
    return false;
  }
  const candidate = progress as { isStrictlyComplete?: unknown };
  if (typeof candidate.isStrictlyComplete !== 'function') {
    return false;
  }
  return (candidate.isStrictlyComplete as () => boolean)();
}

export async function syncWallet(
  logger: Logger,
  wallet: WalletFacade,
  timeout = 300_000,
): Promise<FacadeState> {
  logger.info('Syncing wallet...');
  let emissionCount = 0;
  return Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.tap((state: FacadeState) => {
        emissionCount++;
        const shielded = isProgressStrictlyComplete(state.shielded.state.progress);
        const unshielded = isProgressStrictlyComplete(state.unshielded.progress);
        const dust = isProgressStrictlyComplete(state.dust.state.progress);
        logger.info(
          `Wallet sync [${emissionCount}]: shielded=${shielded}, unshielded=${unshielded}, dust=${dust}`,
        );
      }),
      Rx.filter(
        (state: FacadeState) =>
          isProgressStrictlyComplete(state.shielded.state.progress) &&
          isProgressStrictlyComplete(state.dust.state.progress) &&
          isProgressStrictlyComplete(state.unshielded.progress),
      ),
      Rx.tap(() => logger.info(`Wallet sync complete after ${emissionCount} emissions`)),
      Rx.timeout({
        each: timeout,
        with: () =>
          Rx.throwError(
            () => new Error(`Wallet sync timeout after ${timeout}ms (${emissionCount} emissions received)`),
          ),
      }),
      Rx.catchError((err) => {
        logger.error(`Wallet sync error: ${err}`);
        return Rx.throwError(() => err);
      }),
    ),
  );
}
```

---

## 10) `src/providers.ts`

```typescript
import { type MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { type MidnightWalletProvider } from './wallet.js';
import { type NetworkConfig } from './config.js';

export type HelloWorldCircuits = 'storeMessage';

export type HelloWorldProviders = MidnightProviders<any>;

export function buildProviders(
  wallet: MidnightWalletProvider,
  zkConfigPath: string,
  config: NetworkConfig,
): HelloWorldProviders {
  const zkConfigProvider = new NodeZkConfigProvider<HelloWorldCircuits>(zkConfigPath);

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: `hello-world-${Date.now()}`,
      walletProvider: wallet,
      privateStoragePasswordProvider: () => 'xK9#mQ2$pL8@nR5!vW3*',
      accountId: `test-account-${Date.now()}`,
    }),
    publicDataProvider: indexerPublicDataProvider(
      config.indexer,
      config.indexerWS,
    ),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(
      config.proofServer,
      zkConfigProvider,
    ),
    walletProvider: wallet,
    midnightProvider: wallet,
  };
}
```

---

## 11) `src/test/hw.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import {
  deployContract,
  submitCallTx,
} from '@midnight-ntwrk/midnight-js-contracts';
import type { ContractAddress } from '@midnight-ntwrk/compact-runtime';
import pino from 'pino';

import { getConfig } from '../config.js';
import { MidnightWalletProvider, syncWallet } from '../wallet.js';
import { buildProviders, type HelloWorldProviders } from '../providers.js';
import {
  CompiledHelloWorldContract,
  ledger,
  zkConfigPath,
} from '../../contracts/index.js';
import type { EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';

// Required for GraphQL subscriptions in Node.js
// @ts-expect-error WebSocket global assignment for apollo
globalThis.WebSocket = WebSocket;

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
  console.error('Promise:', promise);
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

const ALICE_SEED =
  '0000000000000000000000000000000000000000000000000000000000000001';
const ALICE_PRIVATE_STATE_ID = 'AlicePrivateHWState';

const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  transport: { target: 'pino-pretty' },
});

describe('Hello World Contract', () => {
  let aliceWallet: MidnightWalletProvider;
  let aliceProviders: HelloWorldProviders;
  let contractAddress: ContractAddress;

  const config = getConfig();

  async function queryLedger(providers: HelloWorldProviders) {
    const state =
      await providers.publicDataProvider.queryContractState(contractAddress);
    expect(state).not.toBeNull();
    return ledger(state!.data);
  }

  beforeAll(async () => {
    setNetworkId(config.networkId);

    const envConfig: EnvironmentConfiguration = {
      walletNetworkId: config.networkId,
      networkId: config.networkId,
      indexer: config.indexer,
      indexerWS: config.indexerWS,
      node: config.node,
      nodeWS: config.nodeWS,
      faucet: config.faucet,
      proofServer: config.proofServer,
    };

    aliceWallet = await MidnightWalletProvider.build(logger, envConfig, ALICE_SEED);
    await aliceWallet.start();
    await syncWallet(logger, aliceWallet.wallet, 600_000);

    aliceProviders = buildProviders(aliceWallet, zkConfigPath, config);
    logger.info('Providers initialized. Ready to test!');
  });

  afterAll(async () => {
    if (aliceWallet) {
      logger.info('Stopping Alice wallet...');
      await aliceWallet.stop();
    }
  });

  it('Deploys the contract', async () => {
    logger.info('Creating private state...');

    const deployed: any = await (deployContract as any)(aliceProviders, {
      compiledContract: CompiledHelloWorldContract,
      privateStateId: ALICE_PRIVATE_STATE_ID,
      initialPrivateState: {},
      args: [],
    });

    logger.info('Setting the contract address...');
    contractAddress = deployed.deployTxData.public.contractAddress;
    logger.info(`Contract deployed at: ${contractAddress}`);
    expect(contractAddress).toBeDefined();
    expect(contractAddress.length).toBeGreaterThan(0);

    const state = await queryLedger(aliceProviders);
    expect(state.message).toEqual('');
  });

  it('Stores Hello World!', async () => {
    const message = 'Hello World!';

    await (submitCallTx as any)(aliceProviders, {
      compiledContract: CompiledHelloWorldContract,
      contractAddress,
      privateStateId: ALICE_PRIVATE_STATE_ID,
      circuitId: 'storeMessage',
      args: [message],
    });

    const state = await queryLedger(aliceProviders);
    expect(state.message).toEqual(message);
  });
});
```

---

## 12) `compose.yml`

```yaml
services:
  proof-server:
    image: 'midnightntwrk/proof-server:8.0.3'
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
    image: 'midnightntwrk/indexer-standalone:4.0.0'
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
    image: 'midnightntwrk/midnight-node:0.22.3'
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
| `ETARGET No matching version found` | Wrong package version | Use versions from this skill's `package.json` |
| `ECONNREFUSED 127.0.0.1:6300` | Proof server not running | `yarn env:up` |
| `NODE_OPTIONS` error in test | Missing experimental flag | Ensure `NODE_OPTIONS='--experimental-vm-modules'` in test script |
| `Wallet sync timeout` | Docker services not healthy | Verify `yarn env:up` finished — all 3 containers must be healthy |
| `v4/graphql` 404 | Old indexer URL | Local devnet uses `/api/v4/graphql` — correct in `config.ts` |
| `FluentWalletBuilder is not a function` | Wrong testkit-js import | Import from `@midnight-ntwrk/testkit-js` |
| `levelPrivateStateProvider` options error | Missing required fields | Must pass `privateStateStoreName`, `walletProvider`, `privateStoragePasswordProvider` (strong password, min 16 chars, no sequential patterns), and `accountId` |
| TS: `Cannot find module` for contracts | Wrong `tsconfig.json` include | Must be `"contract/**/*.ts"` (singular), not `"contracts/**/*.ts"` |
| `submitCallTx` not found | Wrong import | Import from `@midnight-ntwrk/midnight-js-contracts` |
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
   - Update `ALICE_PRIVATE_STATE_ID` and `initialPrivateState` shape
6. Update `src/config.ts` if targeting non-local networks