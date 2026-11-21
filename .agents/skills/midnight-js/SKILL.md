---
name: midnight-js
description: The Midnight.js TypeScript SDK for building DApps on Midnight Network. Covers all provider setup, wallet SDK integration (HDWallet, WalletFacade, ShieldedWallet, UnshieldedWallet, DustWallet), contract deployment, circuit calls, private state management, DUST generation, and testkit usage. Use this skill whenever a user is wiring up providers, managing wallets in a Node.js or browser context, deploying or calling Compact contracts from TypeScript, handling DUST/fee flow, reading ledger state, or writing tests for Midnight DApps.
---

# Midnight.js Skill

Midnight.js is the TypeScript SDK for building DApps on Midnight Network — analogous to Web3.js for Ethereum.

> **Ledger 9 (Nov 2026).** This skill targets Midnight.js **5.0.x**, Wallet SDK **2.0.1** and `@midnightntwrk/ledger-v9` **1.0.2**. Mainnet moved to Ledger 9 on 6 Nov 2026 and no longer decodes Ledger 8 transactions; Midnight.js 4.x and Wallet SDK 1.x cannot transact there. The code below was type-checked against those packages on 21 Nov 2026, and the headless wallet was synced against public Preview.

**Primary references:**
- `docs.midnight.network/tutorials/counter/counter-cli` — official full implementation
- `github.com/midnightntwrk/example-counter` — reference repo (Node.js / headless wallet)
- `github.com/webisoftSoftware/1AM-starter-template` — browser wallet variant
- `node_modules/@midnightntwrk/*/README.md` — the package READMEs are current with each 5.x release
- `references/midnight-session.md` (this repo) — the verified browser + headless wiring

---

## 1) Package Map

Midnight.js, the Wallet SDK, ledger-v9 and the DApp Connector publish under **`@midnightntwrk`**. `compact-runtime` and `compact-js` are still published only under **`@midnight-ntwrk`**, because the compiler's generated code imports `@midnight-ntwrk/compact-runtime`.

| Package | Purpose |
|---|---|
| `@midnightntwrk/midnight-js-contracts` | `deployContract`, `findDeployedContract`, `submitCallTx` |
| `@midnightntwrk/midnight-js-types` | `MidnightProviders`, `MidnightConfig`, `createLedger9WalletProvider`, `createLedger9MidnightProvider`, `createProofProviderFromProvingProviders` |
| `@midnightntwrk/midnight-js-utils` | `networks.preview()` / `.preprod(token)` / `.mainnet(token)`, hex helpers |
| `@midnightntwrk/midnight-js-indexer-public-data-provider` | `indexerPublicDataProvider({ queryURL, subscriptionURL })` |
| `@midnightntwrk/midnight-js-fetch-zk-config-provider` | `FetchZkConfigProvider` (browser / CDN) |
| `@midnightntwrk/midnight-js-node-zk-config-provider` | `NodeZkConfigProvider` (Node.js / filesystem) |
| `@midnightntwrk/midnight-js-http-client-proof-provider` | `httpClientProofProvider({ url, zkConfigProvider })` |
| `@midnightntwrk/midnight-js-level-private-state-provider` | `levelPrivateStateProvider` (LevelDB in Node, IndexedDB in browsers) |
| `@midnightntwrk/midnight-js-dapp-connector-proof-provider` | `dappConnectorNetwork`, `dappConnectorProofProvider`, `dappConnectorWalletProviders` (browser wallets) |
| `@midnight-ntwrk/compact-runtime` | `ContractState`, `WitnessContext` |
| `@midnight-ntwrk/compact-js` | `CompiledContract`, `ProvableCircuitId` |
| `@midnightntwrk/ledger-v9` | `Transaction`, `CostModel`, `unshieldedToken`, `ZswapSecretKeys`, `DustSecretKey` |
| `@midnightntwrk/wallet-sdk-facade` | `WalletFacade` (`WalletFacade.init`), `WalletEntrySchema` |
| `@midnightntwrk/wallet-sdk-hd` | `WalletSeeds`, `HDWallet`, `generateRandomSeed`, `Roles` |
| `@midnightntwrk/wallet-sdk-shielded` | `ShieldedWallet` |
| `@midnightntwrk/wallet-sdk-unshielded-wallet` | `UnshieldedWallet`, `createKeystore`, `PublicKey` |
| `@midnightntwrk/wallet-sdk-dust-wallet` | `DustWallet` |
| `@midnightntwrk/wallet-sdk-abstractions` | `InMemoryTransactionHistoryStorage` |
| `@midnightntwrk/wallet-sdk-address-format` | `MidnightBech32m`, `UnshieldedAddress`, `ShieldedCoinPublicKey`, … |

**Removed in 5.x:** `@midnight-ntwrk/midnight-js-network-id` (`setNetworkId` / `getNetworkId`) and `@midnight-ntwrk/ledger-v8`. `@midnightntwrk/wallet-sdk` 2.0.1 is a barrel that re-exports every wallet package; use it or the individual packages, not both.

---

## 2) Network Configuration

**There is no global network id any more.** `setNetworkId` was removed in Midnight.js 5. The network id travels in configuration:

- `providers.config = { networkId, ttlSeconds }` for every Midnight.js call
- `configuration.networkId` for `WalletFacade.init`
- `createKeystore(secret, networkId)` and `MidnightBech32m.parse(s).decode(Class, networkId)` take it explicitly

```typescript
import { networks, type MidnightNetwork } from '@midnightntwrk/midnight-js-utils';

const preview = networks.preview();                                   // Midnight-hosted
const preprod = networks.preprod(process.env.BLOCKFROST_PROJECT_ID!); // Blockfrost, token required
// → { networkId, indexer: { queryURL, subscriptionURL }, nodeURL, nodeWsURL }
```

**Network endpoints** (preprod and mainnet moved to Blockfrost when `indexer.{preprod,mainnet}.midnight.network` were retired on 9 Oct 2026; the old RPC hosts shut down on 18 Nov 2026):

| Network | Indexer HTTP | Indexer WS | Node RPC |
|---|---|---|---|
| `undeployed` (local) | `http://localhost:8088/api/v4/graphql` | `ws://localhost:8088/api/v4/graphql/ws` | `http://localhost:9944` |
| `preview` | `https://indexer.preview.midnight.network/api/v4/graphql` | `wss://indexer.preview.midnight.network/api/v4/graphql/ws` | `https://rpc.preview.midnight.network` |
| `preprod` | `https://midnight-preprod.blockfrost.io/api/v0?project_id=<token>` | `wss://midnight-preprod.blockfrost.io/api/v0/ws?project_id=<token>` | `https://rpc.midnight-preprod.blockfrost.io?project_id=<token>` |
| `mainnet` | `https://midnight-mainnet.blockfrost.io/api/v0?project_id=<token>` | `wss://midnight-mainnet.blockfrost.io/api/v0/ws?project_id=<token>` | `https://rpc.midnight-mainnet.blockfrost.io?project_id=<token>` |

Blockfrost tokens are per network (`nightpreprod…`, `nightmainnet…`). They sit in the URL, so strip them before logging, and proxy them through a backend for browser dApps. The proof server always runs locally (`http://localhost:6300`).

**Ledger 9 network state:** Preview relaunched as a **new chain** on 7 Nov 2026 (redeploy contracts, re-request tNIGHT, re-register DUST). Preprod upgraded in place on 9 Nov 2026 at block 3,348,434; DUST registrations not backed by cNIGHT were cleared, so register again.

---

## 3) Compiled Contract Setup

Pre-compile the contract once at module load, not on every deploy or call. Compile with `compact compile +0.36.1` (language `0.28.0`).

```typescript
import path from 'node:path';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { Contract } from './managed/counter/contract/index.js'; // generated by the compiler
import { witnesses, type CounterPrivateState } from './witnesses';

export type CounterContract = Contract<CounterPrivateState>;

// Node.js: ZK assets from the filesystem
export const compiledContract = CompiledContract.make<CounterContract>('counter', Contract).pipe(
  CompiledContract.withWitnesses(witnesses), // or CompiledContract.withVacantWitnesses
  CompiledContract.withCompiledFileAssets(path.resolve('contract/src/managed/counter')),
);

// Browser: no node:path. Keys load through FetchZkConfigProvider; the path is only a label.
export const browserCompiledContract = CompiledContract.make<CounterContract>('counter', Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets('/zk/counter'),
);
```

Witnesses take `WitnessContext<Ledger, PrivateState>` (two type parameters since compact-runtime 0.21) and return a mutable `[PrivateState, value]` tuple.

---

## 4) Type Definitions (Important Pattern)

```typescript
import type { ProvableCircuitId } from '@midnight-ntwrk/compact-js';
import type { MidnightProviders } from '@midnightntwrk/midnight-js-types';
import type { DeployedContract, FoundContract } from '@midnightntwrk/midnight-js-contracts';

export type CounterCircuits = ProvableCircuitId<CounterContract>;   // was ImpureCircuitId
export const CounterPrivateStateId = 'counterPrivateState' as const;
export type CounterPrivateStateId = typeof CounterPrivateStateId;

export type CounterProviders = MidnightProviders<CounterCircuits, CounterPrivateStateId, CounterPrivateState>;
export type DeployedCounterContract = DeployedContract<CounterContract> | FoundContract<CounterContract>;
```

---

## 5) Wallet Setup (Node.js / Headless, Wallet SDK 2.x)

Wallet SDK 1.x wallets cannot transact on Ledger 9. In 2.x the facade is built with **`WalletFacade.init`** (the constructor is private) and started from **seeds**, not key objects. A seed derives each ledger version's keys, so the wallet can follow the chain across the fork.

```typescript
import { WebSocket } from 'ws';
import { WalletFacade, WalletEntrySchema } from '@midnightntwrk/wallet-sdk-facade';
import { ShieldedWallet } from '@midnightntwrk/wallet-sdk-shielded';
import { UnshieldedWallet, createKeystore, PublicKey } from '@midnightntwrk/wallet-sdk-unshielded-wallet';
import { DustWallet } from '@midnightntwrk/wallet-sdk-dust-wallet';
import { WalletSeeds, generateRandomSeed } from '@midnightntwrk/wallet-sdk-hd';
import { InMemoryTransactionHistoryStorage } from '@midnightntwrk/wallet-sdk-abstractions';
import type { MidnightNetwork } from '@midnightntwrk/midnight-js-utils';

// Node.js: GraphQL subscriptions need a global WebSocket (top of the entry file).
globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

export async function buildHeadlessWallet(network: MidnightNetwork, masterSeed: Uint8Array, proofServerUrl = 'http://localhost:6300') {
  // Account 0 / index 0 for Zswap, NightExternal and Dust — same keys HDWallet derives.
  const seeds = WalletSeeds.fromMasterSeed(masterSeed);

  const facade = await WalletFacade.init({
    configuration: {
      networkId: network.networkId,
      indexerClientConnection: { indexerHttpUrl: network.indexer.queryURL, indexerWsUrl: network.indexer.subscriptionURL },
      relayURL: new URL(network.nodeWsURL),          // must be ws:// or wss://
      provingServerUrl: new URL(proofServerUrl),     // or provers: { v9: { kind: 'wasm' } } for in-process proving
      costParameters: { feeBlocksMargin: 5 },
      txHistoryStorage: new InMemoryTransactionHistoryStorage(WalletEntrySchema),
      // forks: omitted → DefaultForkSchedule (ledger-v9 from the version a 2.x node reports)
    },
    shielded: (config) => ShieldedWallet(config).startWithSeed(seeds.shielded),
    unshielded: (config) =>
      UnshieldedWallet(config).startWithPublicKey(
        PublicKey.fromKeyStore(createKeystore({ kind: 'schnorr', secret: seeds.unshielded }, config.networkId)),
      ),
    dust: (config) => DustWallet(config).startWithSeed(seeds.dust),
  });

  await facade.start(seeds);
  const state = await facade.waitForSyncedState();
  return { facade, seeds, state };
}

const masterSeed = generateRandomSeed(); // Uint8Array — persist it (hex) to restore the wallet
```

On a chain with Ledger 8 history (Preprod), a **new** wallet can skip the old DUST history with `DustWallet({ ...config, skipLedgerV8DustHistory: true })`; shielded and unshielded wallets still read it.

### Wallet Sync (RxJS)

```typescript
import * as Rx from 'rxjs';
import { unshieldedToken } from '@midnightntwrk/ledger-v9';

const synced = await facade.waitForSyncedState();     // or wallet.state().pipe(Rx.filter((s) => s.isSynced))

const night = await Rx.firstValueFrom(
  facade.state().pipe(
    Rx.throttleTime(10_000),
    Rx.filter((s) => s.isSynced),
    Rx.map((s) => s.unshielded.balances[unshieldedToken().raw] ?? 0n),
    Rx.filter((balance) => balance > 0n),
  ),
);
```

`state.activeProtocolVersion` tells you which ledger version the three wallets are acting at (Preview reports `2001100`).

---

## 6) DUST Generation

NIGHT generates DUST only after its UTXOs are registered on-chain. DUST is the non-transferable fee resource. This works on every network; on mainnet, cNIGHT-backed registrations carried over the Ledger 9 upgrade. Parameters are unchanged: cap 5 DUST per NIGHT, 10^15 Specks per DUST, about 1 week to cap, 3 h grace.

```typescript
const keystore = createKeystore({ kind: 'schnorr', secret: seeds.unshielded }, network.networkId);
const signSegment = (payload: Uint8Array) => Promise.resolve(keystore.signData(payload));

const state = await facade.waitForSyncedState();
if (state.dust.balance(new Date()) > 0n) return;      // Wallet SDK 2.x: balance(time), not walletBalance

const nightUtxos = state.unshielded.availableCoins.filter((c) => c.meta?.registeredForDustGeneration !== true);
if (nightUtxos.length > 0) {
  const recipe = await facade.registerNightUtxosForDustGeneration(nightUtxos, keystore.getPublicKey(), signSegment);
  await facade.submitTransaction(await facade.finalizeRecipe(recipe));
}

await Rx.firstValueFrom(
  facade.state().pipe(Rx.throttleTime(5_000), Rx.filter((s) => s.isSynced && s.dust.balance(new Date()) > 0n)),
);
```

If registration fails with `InsufficientDustForFeeError` whose estimate is `Reachable`, wait with `facade.waitForGeneratedDust(nightUtxos, error.fee, { timeoutMs })` and retry. Preview: get tNIGHT from `https://faucet.preview.midnight.network/`. Preprod: `https://midnight-tmnight-preprod.nethermind.dev/`.

**DUST troubleshooting:**
- `pendingCoins > 0 && availableCoins === 0` → DUST booked by a pending transaction. In 2.x a submission the node provably rejected releases its bookings; otherwise they free when the TTL passes or on sync. Prefer waiting over restarting.
- NIGHT registered but DUST = 0 → still accruing; wait a few minutes.
- Balance gone after 7–9 Nov 2026 → Preview relaunch / Preprod DUST reset; register again.

---

## 7) Provider Configuration

Every provider set now carries **`config: { networkId, ttlSeconds }`**, and the wallet, proof and midnight providers are **era-aware** (they declare `supportedEras`). Build them with the `createLedger9*` helpers or the DApp Connector factories, not as plain objects.

### Node.js (self-hosted proof server)

```typescript
import { httpClientProofProvider } from '@midnightntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnightntwrk/midnight-js-indexer-public-data-provider';
import { NodeZkConfigProvider } from '@midnightntwrk/midnight-js-node-zk-config-provider';
import { levelPrivateStateProvider } from '@midnightntwrk/midnight-js-level-private-state-provider';
import { createLedger9MidnightProvider, createLedger9WalletProvider } from '@midnightntwrk/midnight-js-types';

const { facade, seeds, state } = await buildHeadlessWallet(network, masterSeed);
const keystore = createKeystore({ kind: 'schnorr', secret: seeds.unshielded }, network.networkId);
const signSegment = (payload: Uint8Array) => Promise.resolve(keystore.signData(payload));

// midnight-js hands over era-tagged handles; the facade adopts the bytes at the version it acts at.
const walletProvider = createLedger9WalletProvider({
  getCoinPublicKey: () => state.shielded.coinPublicKey.toHexString(),
  getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
  balanceTx: async (tx, ttl) => {
    const recipe = await facade.balanceUnboundTransaction(facade.adoptTransaction(tx.serialize(), 'Unbound'), {
      ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000),
    });
    return facade.finalizeRecipe(await facade.signRecipe(recipe, signSegment));
  },
});
const midnightProvider = createLedger9MidnightProvider((tx) =>
  facade.submitTransaction(facade.adoptTransaction(tx.serialize(), 'Finalized')),
);

const zkConfigProvider = new NodeZkConfigProvider<CounterCircuits>(zkConfigPath);

const providers: CounterProviders = {
  privateStateProvider: levelPrivateStateProvider<CounterPrivateStateId>({
    accountId: keystore.getBech32Address().asString(),            // required: scopes the store per account
    privateStoragePasswordProvider: async () => process.env.PRIVATE_STORAGE_PASSWORD!, // ≥16 chars, 3 classes
  }),
  publicDataProvider: indexerPublicDataProvider(network.indexer),
  zkConfigProvider,
  proofProvider: httpClientProofProvider({ url: 'http://localhost:6300', zkConfigProvider }),
  walletProvider,
  midnightProvider,
  config: { networkId: network.networkId, ttlSeconds: 3600 },
};
```

`facade.signRecipe` signs the proven base transaction and the balancing transaction at their own stages. The old "Failed to clone intent" `signTransactionIntents` workaround is **not needed** with Wallet SDK 2.x.

### Browser (DApp Connector wallet: 1AM, Lace)

```typescript
import {
  dappConnectorNetwork, dappConnectorProofProvider, dappConnectorWalletProviders,
} from '@midnightntwrk/midnight-js-dapp-connector-proof-provider';
import { FetchZkConfigProvider } from '@midnightntwrk/midnight-js-fetch-zk-config-provider';
import { indexerPublicDataProvider } from '@midnightntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnightntwrk/midnight-js-level-private-state-provider';
import { CostModel } from '@midnightntwrk/ledger-v9';

const network = await dappConnectorNetwork(connectedAPI);   // the network + endpoints the user picked in the wallet
const { unshieldedAddress } = await connectedAPI.getUnshieldedAddress();
const zkConfigProvider = new FetchZkConfigProvider<string>(new URL('/zk/counter', location.origin).toString(), {
  fetchFunc: window.fetch.bind(window),
});
const { walletProvider, midnightProvider } = await dappConnectorWalletProviders(connectedAPI);

const providers = {
  privateStateProvider: levelPrivateStateProvider({ accountId: unshieldedAddress, privateStoragePasswordProvider }),
  publicDataProvider: indexerPublicDataProvider(network.indexer),
  zkConfigProvider,
  proofProvider: await dappConnectorProofProvider(connectedAPI, zkConfigProvider, CostModel.initialCostModel()),
  walletProvider,
  midnightProvider,
  config: { networkId: network.networkId, ttlSeconds: 3600 },
};
```

The full, build-verified file is in `references/midnight-session.md`. The connector takes no TTL, so the wallet chooses the expiry of the intents it adds.

---

## 8) Deploy & Call Contracts

### Deploy

```typescript
import { deployContract } from '@midnightntwrk/midnight-js-contracts';

const deployed = await deployContract(providers, {
  compiledContract,
  privateStateId: CounterPrivateStateId,
  initialPrivateState: { privateCounter: 0 },
  // args: [...] for constructor parameters
});
console.log('Contract address:', deployed.deployTxData.public.contractAddress);
```

`deployContract` builds, proves, balances, submits, waits for inclusion and stores the private state and signing key for you.

### Call a Circuit

```typescript
const result = await deployed.callTx.increment();
console.log('txId:', result.public.txId, 'block:', result.public.blockHeight);
```

Argument shapes follow the generated `contract/index.d.ts`: `Bytes<32>` is a plain `Uint8Array`, while `UserAddress` / `ZswapCoinPublicKey` are `{ bytes: Uint8Array }`.

### Join an Existing Contract

```typescript
import { findDeployedContract } from '@midnightntwrk/midnight-js-contracts';

const contract = await findDeployedContract(providers, {
  contractAddress: '09dbe05f...',
  compiledContract,
  privateStateId: CounterPrivateStateId,
  initialPrivateState: { privateCounter: 0 },
});
await contract.callTx.increment();
```

### Read Ledger State

```typescript
import { ContractState } from '@midnight-ntwrk/compact-runtime';
import { ledger } from './managed/counter/contract/index.js';

const read = await providers.publicDataProvider.queryContractState(contractAddress);
if (read === null) {
  console.log('Contract not found');
} else {
  // 5.x returns era-tagged bytes; decode with YOUR compact-runtime copy.
  const state = ledger(read.contractState.deserialize({ v9: ContractState }).data);
  console.log('Counter value:', state.round);
}
```

---

## 9) Ledger 9 Features

| Feature | Notes |
|---|---|
| Contract-to-contract calls (phase 1) | Unshielded only. Supply `providers.contractModuleProvider` so the framework can resolve a callee's address to its compiled module; without one, a cross-contract call fails naming the call. |
| Event emission | Unshielded only. Events are public. Read them with `getAllContractEvents` / the indexer `contractEvents` query (`MiscContractEvent { name payload }` and token events). |
| Native ECDSA (secp256k1) verification, Keccak | New stdlib primitives in Compact language 0.28.0 (see the `compact` skill) |
| ZKIR v3 | Produced by compiler 0.36.x. Old (0.31-era) build output must be recompiled. |

---

## 10) Private State

`PrivateStateProvider` is **per-contract** in 5.x: `provider.forContract(address).get(id)` / `.set(id, state)`, plus signing-key methods. The old `setContractAddress()` pattern is gone. Use `levelPrivateStateProvider` everywhere: LevelDB in Node, IndexedDB in the browser via `browser-level`. It needs `accountId` and a `privateStoragePasswordProvider` (password ≥16 chars, 3 character classes). Use one database per process or browser tab.

---

## 11) Testkit (Integration Testing)

```typescript
import { getTestEnvironment } from '@midnightntwrk/testkit-js';
import pino from 'pino';

const logger = pino({ level: 'info' });
let testEnvironment: ReturnType<typeof getTestEnvironment>;

beforeAll(async () => {
  testEnvironment = getTestEnvironment(logger);
  await testEnvironment.start();
});
afterAll(async () => testEnvironment.shutdown());

const walletProvider = await testEnvironment.getMidnightWalletProvider();
const [wallet1, wallet2] = await testEnvironment.startMidnightWalletProviders(2); // max 4 on local
```

**Environment selection (`MN_TEST_ENVIRONMENT`):** `undeployed` (default, local Docker), `preview`, `preprod`, `qanet`, or `env-var-remote`. There is no `devnet` value in testkit-js 5.x.

```bash
MN_TEST_ENVIRONMENT=preview yarn test

MN_TEST_ENVIRONMENT=env-var-remote \
MN_TEST_NETWORK_ID=undeployed \
MN_TEST_INDEXER=http://localhost:8088/api/v4/graphql \
MN_TEST_INDEXER_WS=ws://localhost:8088/api/v4/graphql/ws \
MN_TEST_NODE=http://localhost:9944 \
MN_TEST_FAUCET=<faucet-url> \
yarn test
```

---

## 12) Proof Server

```bash
docker run -p 6300:6300 midnightntwrk/proof-server:9.0.2 midnight-proof-server -v
# Wait for: "starting service... listening on: 0.0.0.0:6300"
```

Proof server URL: `http://127.0.0.1:6300`. Pin the tag: a proof server is built against one ledger version, and `9.0.2` is the Ledger 9.1 build. For in-process proving instead, set `provers: { v9: { kind: 'wasm' } }` in the wallet configuration (key material from `https://srs.midnight.network/`, hash-checked).

**Mac ARM (Apple Silicon) fix:** If the proof server hangs, go to Docker Desktop → Settings → General → Virtual Machine Options → select **Docker VMM** → restart Docker.

---

## 13) Common Pitfalls

**Calling `setNetworkId`** → the package no longer exists in 5.x. Pass `networkId` through `providers.config` and the wallet configuration.

**Mixing scopes** (`@midnight-ntwrk/midnight-js-*` 5.0.1 with `@midnightntwrk/*` 5.0.2) → two copies of the ledger WASM, and decoded objects are refused across copies. Pick one scope for Midnight.js (prefer `@midnightntwrk`); keep `compact-runtime` / `compact-js` on `@midnight-ntwrk`.

**Plain-object providers** → era-aware interfaces need `supportedEras`. Use `createLedger9WalletProvider`, `createLedger9MidnightProvider`, `httpClientProofProvider` or the DApp Connector factories.

**`queryContractState(...).data` undefined** → decode with `read.contractState.deserialize({ v9: ContractState })` first.

**WebSocket not set globally in Node.js** → wallet sync subscriptions silently fail. Put `globalThis.WebSocket = WebSocket` at the top of your entry file.

**ZK assets not found / `EraMismatchError`** → the asset directory must contain `compiler/` (`contract-manifest.json`, `contract-info.json`) as well as `keys/` and `zkir/`.

**Wallet 0 balance after faucet** → wait for sync. If it's still 0, check that you used the unshielded address (`mn_addr_preview1...`, `mn_addr_preprod1...`), not the shielded one.

**`relayURL` must be WebSocket** → `https://` → `wss://`, `http://` → `ws://`.

**`CompiledContract.make` called on every deploy** → call it once at module load.

**Old contract address after recompile** → verifier keys change when the contract changes. Redeploy after any contract change, and after moving from compiler 0.31 to 0.36.x.

**Contract subscription misses history** → indexer 4.4.101 delivers only new actions when no offset is given. Midnight.js 5 passes an explicit offset itself; hand-written subscriptions should pass one (e.g. height 0).

---

## 14) Dependency Versions (Ledger 9.1 snapshot — re-check the matrix)

Snapshot checked against npm and the [support matrix](https://docs.midnight.network/relnotes/support-matrix) on 21 Nov 2026 (see `references/versions.json`, `references/volatile.md`). Never install `@latest`.

```json
{
  "@midnight-ntwrk/compact-runtime": "0.21.0",
  "@midnight-ntwrk/compact-js": "3.0.2",
  "@midnightntwrk/ledger-v9": "1.0.2",
  "@midnightntwrk/midnight-js-contracts": "5.0.2",
  "@midnightntwrk/midnight-js-types": "5.0.2",
  "@midnightntwrk/midnight-js-utils": "5.0.2",
  "@midnightntwrk/midnight-js-http-client-proof-provider": "5.0.2",
  "@midnightntwrk/midnight-js-indexer-public-data-provider": "5.0.2",
  "@midnightntwrk/midnight-js-level-private-state-provider": "5.0.2",
  "@midnightntwrk/midnight-js-node-zk-config-provider": "5.0.2",
  "@midnightntwrk/wallet-sdk-abstractions": "3.0.0",
  "@midnightntwrk/wallet-sdk-address-format": "4.0.1",
  "@midnightntwrk/wallet-sdk-dust-wallet": "5.1.0",
  "@midnightntwrk/wallet-sdk-facade": "5.0.1",
  "@midnightntwrk/wallet-sdk-hd": "4.0.0",
  "@midnightntwrk/wallet-sdk-shielded": "4.0.1",
  "@midnightntwrk/wallet-sdk-unshielded-wallet": "4.0.1"
}
```

Toolchain: Compact **0.36.1** (language 0.28.0), proof server **9.0.2**, indexer **4.4.101**, node **2.1.101**. Node.js **22+**.
