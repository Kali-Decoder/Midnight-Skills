---
name: multinetwork
description: Build a single Midnight dApp that deploys and runs across all networks (undeployed/local, preview, preprod, mainnet). Covers local Docker stack setup via midnight-local-dev, environment config, provider routing, wallet abstraction, proof server selection, ZK asset resolution, contract registry, and DUST flow differences per network. Use when a user wants to target multiple networks from one codebase, set up a local dev environment, or understand what changes between undeployed/preprod/preview/mainnet.
---

# Multi-Network Midnight Skill

This skill covers building a Midnight DApp that works across all four network targets from a single codebase. The key insight: networks differ in three ways — **endpoints**, **proof server** (local Docker vs ProofStation), and **DUST flow** (manual registration vs sponsored). Everything else is identical.

**Primary references:**
- `github.com/midnightntwrk/midnight-local-dev` — official local Docker stack + funding CLI
- `github.com/midnightntwrk/example-counter` — official reference DApp (standalone + preprod modes)

---

## 1) The Four Networks at a Glance

| Network | `networkId` | Use for | Proof server | DUST flow |
|---|---|---|---|---|
| `undeployed` | `'undeployed'` | Local dev, CI | Local Docker `:6300` | Manual registration (genesis wallet seeds funded) |
| `preview` | `'preview'` | Active development on testnet | 1AM ProofStation (`api-preview.1am.xyz`) | Sponsored — user pays 0 fees |
| `preprod` | `'preprod'` | Pre-release / integration testing | Local Docker `:6300` OR ProofStation | Manual registration (faucet → NIGHT → DUST) |
| `mainnet` | `'mainnet'` | Production | 1AM ProofStation (`api.1am.xyz`) | Sponsored — user pays 0 fees |

**Critical distinction:** On `preview` and `mainnet`, the 1AM wallet sponsors all fees via ProofStation — users need zero NIGHT or DUST. On `undeployed` and `preprod`, you must run your own proof server and manually register NIGHT UTXOs for DUST generation before transactions work.

---

## 2) Local Docker Stack (`undeployed`)

Running the `undeployed` network locally requires three Docker containers: a Midnight node, an indexer, and a proof server. **You cannot just run the proof server** — you need all three.

### Option A: Use `midnight-local-dev` (recommended)

The official tool at `github.com/midnightntwrk/midnight-local-dev` manages the full stack and handles genesis wallet funding:

```bash

git clone https://github.com/midnightntwrk/midnight-local-dev
cd midnight-local-dev
npm install
npm start

```

`npm start` will:
1. Detect if containers are already running (prompts to reuse or restart)
2. Pull and start all three containers via Docker Compose
3. Initialize the genesis master wallet (seed `0x00...01`) and register its DUST
4. Present a funding menu to transfer NIGHT and register DUST for your test accounts

Once running, connect your DApp to:

```
networkId:  undeployed
indexer:    http://localhost:8088/api/v3/graphql
indexerWS:  ws://localhost:8088/api/v3/graphql/ws
node:       http://localhost:9944
proofServer: http://localhost:6300
```

**Note:** The local indexer uses `/api/v3/graphql` (not v4 like testnet). Use the correct path.

### Option B: Docker Compose directly (no funding CLI)

```bash
# From midnight-local-dev repo root:
docker compose -f standalone.yml up -d

# Check all three services are healthy
docker compose -f standalone.yml ps

# View logs
docker compose -f standalone.yml logs -f

# Tear down
docker compose -f standalone.yml down
```

In this mode, you manage genesis wallet initialization and DUST registration yourself.

### Docker Image Versions (as of 2026)

| Service | Image | Version |
|---|---|---|
| Node | `midnightntwrk/midnight-node` | `0.21.0` |
| Indexer | `midnightntwrk/indexer-standalone` | `3.1.0` |
| Proof Server | `midnightntwrk/proof-server` | `7.0.0` |

### Lace wallet on `undeployed`

The Lace browser wallet auto-connects to the local stack when you select "Undeployed" in its network settings — it hardcodes `localhost:9944`, `localhost:8088`, and `localhost:6300`. No custom endpoint config needed.

### Funding test accounts locally

```bash
# Option 1: Fund from a JSON file (gets NIGHT + DUST registered)
# accounts.json: { "accounts": [{ "name": "Alice", "mnemonic": "..." }] }
# (max 10 accounts, 50,000 NIGHT each)

# Option 2: Fund by Bech32 address (NIGHT only — DUST not registered)
# Use when you have a Lace address or DApp-generated address
```

Genesis master wallet seed: `0x0000000000000000000000000000000000000000000000000000000000000001`

---

## 3) Network Configuration

```typescript
// src/config/networks.ts
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

export type NetworkId = 'undeployed' | 'preview' | 'preprod' | 'mainnet';

// 'sponsored' = 1AM ProofStation pays fees (preview, mainnet)
// 'manual'    = you run a proof server, user registers NIGHT→DUST (undeployed, preprod)
export type DustMode = 'sponsored' | 'manual';

export interface NetworkConfig {
  networkId: NetworkId;
  indexerHttp: string;
  indexerWs: string;
  rpc: string;
  proofServerUrl: string;
  dustMode: DustMode;
  faucetUrl?: string;
}

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  undeployed: {
    networkId: 'undeployed',
    indexerHttp: 'http://localhost:8088/api/v3/graphql',  // NOTE: v3, not v4
    indexerWs:   'ws://localhost:8088/api/v3/graphql/ws',
    rpc:         'ws://localhost:9944',
    proofServerUrl: 'http://127.0.0.1:6300',
    dustMode: 'manual',
  },
  preview: {
    networkId: 'preview',
    indexerHttp: 'https://indexer.preview.midnight.network/api/v4/graphql',
    indexerWs:   'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
    rpc:         'wss://rpc.preview.midnight.network',
    proofServerUrl: 'https://api-preview.1am.xyz',  // 1AM ProofStation
    dustMode: 'sponsored',
  },
  preprod: {
    networkId: 'preprod',
    indexerHttp: 'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWs:   'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
    rpc:         'https://rpc.preprod.midnight.network',
    proofServerUrl: 'http://127.0.0.1:6300',  // local proof server (run via Docker)
    dustMode: 'manual',
    faucetUrl: 'https://faucet.preprod.midnight.network',
  },
  mainnet: {
    networkId: 'mainnet',
    indexerHttp: 'https://indexer.mainnet.midnight.network/api/v4/graphql',
    indexerWs:   'wss://indexer.mainnet.midnight.network/api/v4/graphql/ws',
    rpc:         'https://rpc.mainnet.midnight.network',
    proofServerUrl: 'https://api.1am.xyz',  // 1AM ProofStation
    dustMode: 'sponsored',
  },
};

export function getActiveNetwork(): NetworkConfig {
  const id = (
    process.env.NETWORK ||
    process.env.VITE_NETWORK ||
    'undeployed'
  ) as NetworkId;
  const config = NETWORKS[id];
  if (!config) throw new Error(`Unknown network: "${id}". Valid: ${Object.keys(NETWORKS).join(', ')}`);
  return config;
}

// Call this once at startup before any SDK operations
export function applyNetworkId(config: NetworkConfig) {
  setNetworkId(config.networkId);
}
```

---

## 4) Unified Provider Builder

```typescript
// src/config/providers.ts
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import type { NetworkConfig } from './networks';

// ── ZK Config Provider ──────────────────────────────────────────────────────

// Node.js: load ZK assets from filesystem
export function makeNodeZkConfigProvider(zkConfigPath: string) {
  const { NodeZkConfigProvider } = require('@midnight-ntwrk/midnight-js-node-zk-config-provider');
  const path = require('path');
  return new NodeZkConfigProvider(path.resolve(zkConfigPath));
}

// Browser: load ZK assets via fetch from CDN or public/
export function makeFetchZkConfigProvider(zkAssetBasePath: string) {
  const { FetchZkConfigProvider } = require('@midnight-ntwrk/midnight-js-fetch-zk-config-provider');
  return new FetchZkConfigProvider(
    new URL(zkAssetBasePath, window.location.origin).toString(),
    window.fetch.bind(window),
  );
}

// ── Proof Provider ───────────────────────────────────────────────────────────

// Node.js / self-hosted: points at local Docker proof server or ProofStation URL
// For ProofStation (preview/mainnet headless), pass the 1AM endpoint + API key
export function makeHttpProofProvider(proofServerUrl: string, zkConfigProvider: any) {
  const { httpClientProofProvider } = require('@midnight-ntwrk/midnight-js-http-client-proof-provider');
  return httpClientProofProvider(new URL(proofServerUrl), zkConfigProvider);
}

// Browser + 1AM wallet: proving handled by the wallet extension (no proof server needed)
export function make1AMProofProvider(provingProvider: any) {
  const { createProofProvider } = require('@midnight-ntwrk/midnight-js-types');
  return createProofProvider(provingProvider);
}

// ── Public Data Provider ─────────────────────────────────────────────────────

export function makePublicDataProvider(network: NetworkConfig) {
  return indexerPublicDataProvider(network.indexerHttp, network.indexerWs);
}

// ── Private State Provider ───────────────────────────────────────────────────

// Node.js: persistent LevelDB store (survives restarts)
export function makeLevelPrivateStateProvider(storeName: string, walletProvider: any) {
  const { levelPrivateStateProvider } = require('@midnight-ntwrk/midnight-js-level-private-state-provider');
  return levelPrivateStateProvider({ privateStateStoreName: storeName, walletProvider });
}

// Browser: in-memory (lost on page refresh — acceptable for browser DApps)
export function makeInMemoryPrivateStateProvider() {
  let scope = '';
  const stateStore = new Map<string, unknown>();
  const signingKeyStore = new Map<string, unknown>();
  const key = (id: string) => `${scope}:${id}`;
  return {
    setContractAddress(address: string) { scope = address; },
    async set(id: string, state: unknown) { stateStore.set(key(id), state); },
    async get(id: string) { return stateStore.get(key(id)) ?? null; },
    async remove(id: string) { stateStore.delete(key(id)); },
    async clear() { stateStore.clear(); },
    async setSigningKey(addr: string, k: unknown) { signingKeyStore.set(addr, k); },
    async getSigningKey(addr: string) { return signingKeyStore.get(addr) ?? null; },
    async removeSigningKey(addr: string) { signingKeyStore.delete(addr); },
    async clearSigningKeys() { signingKeyStore.clear(); },
    async exportPrivateStates(): Promise<never> { throw new Error('Not implemented'); },
    async importPrivateStates(): Promise<never> { throw new Error('Not implemented'); },
    async exportSigningKeys(): Promise<never> { throw new Error('Not implemented'); },
    async importSigningKeys(): Promise<never> { throw new Error('Not implemented'); },
  };
}
```

---

## 5) WalletProvider & MidnightProvider (Node.js headless, all networks)

This bridge is identical across all networks. The `signTransactionIntents` workaround is required on all networks — it's a wallet SDK bug, not network-specific.

```typescript
// src/config/wallet-provider.ts
import * as Rx from 'rxjs';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import type { WalletProvider, MidnightProvider } from '@midnight-ntwrk/midnight-js-types';

/**
 * Workaround for wallet SDK bug: signRecipe hardcodes 'pre-proof' marker,
 * but proven (UnboundTransaction) intents contain 'proof' data → "Failed to clone intent".
 * Call with proofMarker='proof' for baseTransaction, 'pre-proof' for balancingTransaction.
 */
function signTransactionIntents(
  tx: { intents?: Map<number, any> },
  signFn: (payload: Uint8Array) => ledger.Signature,
  proofMarker: 'proof' | 'pre-proof',
): void {
  if (!tx.intents || tx.intents.size === 0) return;

  for (const segment of tx.intents.keys()) {
    const intent = tx.intents.get(segment);
    if (!intent) continue;

    const cloned = ledger.Intent.deserialize<
      ledger.SignatureEnabled, ledger.Proofish, ledger.PreBinding
    >('signature', proofMarker, 'pre-binding', intent.serialize());

    const signature = signFn(cloned.signatureData(segment));

    if (cloned.fallibleUnshieldedOffer) {
      const sigs = cloned.fallibleUnshieldedOffer.inputs.map(
        (_: ledger.UtxoSpend, i: number) =>
          cloned.fallibleUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.fallibleUnshieldedOffer = cloned.fallibleUnshieldedOffer.addSignatures(sigs);
    }
    if (cloned.guaranteedUnshieldedOffer) {
      const sigs = cloned.guaranteedUnshieldedOffer.inputs.map(
        (_: ledger.UtxoSpend, i: number) =>
          cloned.guaranteedUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.guaranteedUnshieldedOffer = cloned.guaranteedUnshieldedOffer.addSignatures(sigs);
    }

    tx.intents.set(segment, cloned);
  }
}

export async function makeWalletAndMidnightProvider(
  walletFacade: any,
  shieldedSecretKeys: ledger.ZswapSecretKeys,
  dustSecretKey: ledger.DustSecretKey,
  unshieldedKeystore: any,
): Promise<WalletProvider & MidnightProvider> {
  // state() is an Observable — must subscribe, not access as property
  const state = await Rx.firstValueFrom(
    walletFacade.state().pipe(Rx.filter((s: any) => s.isSynced)),
  );

  const signFn = (payload: Uint8Array) => unshieldedKeystore.signData(payload);

  return {
    getCoinPublicKey() {
      return state.shielded.coinPublicKey.toHexString();
    },
    getEncryptionPublicKey() {
      return state.shielded.encryptionPublicKey.toHexString();
    },
    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await walletFacade.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys, dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );

      // Apply signTransactionIntents workaround on both tx parts
      signTransactionIntents(recipe.baseTransaction, signFn, 'proof');
      if (recipe.balancingTransaction) {
        signTransactionIntents(recipe.balancingTransaction, signFn, 'pre-proof');
      }

      return walletFacade.finalizeRecipe(recipe);
    },
    async submitTx(tx: any) {
      return walletFacade.submitTransaction(tx) as any;
    },
  };
}
```

---

## 6) DUST Flow Per Network

```
undeployed  →  manual:  register NIGHT UTXOs → wait for DUST to accrue
preview     →  sponsored: 1AM ProofStation pays all fees → user needs nothing
preprod     →  manual:  faucet NIGHT → register UTXOs → wait for DUST
mainnet     →  sponsored: 1AM ProofStation pays all fees → user needs nothing
```

```typescript
// src/config/dust.ts
import * as Rx from 'rxjs';
import type { NetworkConfig } from './networks';

export async function ensureDust(
  walletFacade: any,
  unshieldedKeystore: any,
  network: NetworkConfig,
): Promise<void> {
  // sponsored networks: 1AM pays fees — nothing to do
  if (network.dustMode === 'sponsored') return;

  const state = await Rx.firstValueFrom(
    walletFacade.state().pipe(Rx.filter((s: any) => s.isSynced)),
  );

  // already have DUST
  if (state.dust.availableCoins.length > 0) return;

  // find NIGHT UTXOs not yet registered for DUST generation
  const unregistered = state.unshielded.availableCoins.filter(
    (coin: any) => coin.meta?.registeredForDustGeneration !== true,
  );

  if (unregistered.length === 0) {
    // all UTXOs registered — just wait for DUST to accrue
    console.log('Waiting for DUST to generate (all UTXOs already registered)...');
  } else {
    // submit registration tx
    console.log(`Registering ${unregistered.length} NIGHT UTXO(s) for DUST generation...`);
    const recipe = await walletFacade.registerNightUtxosForDustGeneration(
      unregistered,
      unshieldedKeystore.getPublicKey(),
      (payload: Uint8Array) => unshieldedKeystore.signData(payload),
    );
    const finalized = await walletFacade.finalizeRecipe(recipe);
    await walletFacade.submitTransaction(finalized);
  }

  // wait for DUST balance > 0 (can take a few minutes on preprod)
  await Rx.firstValueFrom(
    walletFacade.state().pipe(
      Rx.throttleTime(5_000),
      Rx.filter((s: any) => s.isSynced),
      Rx.filter((s: any) => s.dust.walletBalance(new Date()) > 0n),
    ),
  );

  console.log('DUST available.');
}
```

---

## 7) Wallet Initialization (Node.js, all networks)

```typescript
// src/config/wallet.ts
import * as Rx from 'rxjs';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { HDWallet, generateRandomSeed, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  UnshieldedWallet, createKeystore, PublicKey,
  InMemoryTransactionHistoryStorage,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { WebSocket } from 'ws';
import { Buffer } from 'buffer';
import { applyNetworkId, type NetworkConfig } from './networks';
import { ensureDust } from './dust';
import { makeWalletAndMidnightProvider } from './wallet-provider';

// Required: set WebSocket global before any wallet SDK imports
globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

export async function buildHeadlessWallet(network: NetworkConfig, seedHex?: string) {
  applyNetworkId(network);

  const seed = seedHex
    ? Buffer.from(seedHex, 'hex')
    : Buffer.from(generateRandomSeed());

  const hdWallet = HDWallet.fromSeed(seed);
  if (hdWallet.type !== 'seedOk') throw new Error('Invalid wallet seed');

  const derivationResult = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);

  if (derivationResult.type !== 'keysDerived') throw new Error('Key derivation failed');
  hdWallet.hdWallet.clear(); // wipe secret material from memory

  const keys = derivationResult.keys;
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], network.networkId);

  // relayURL must be WebSocket — convert http→ws, https→wss
  const relayURL = new URL(network.rpc.replace(/^https/, 'wss').replace(/^http(?!s)/, 'ws'));

  const shieldedWallet = ShieldedWallet({
    networkId: network.networkId,
    indexerClientConnection: { indexerHttpUrl: network.indexerHttp, indexerWsUrl: network.indexerWs },
    provingServerUrl: new URL(network.proofServerUrl),
    relayURL,
  }).startWithSecretKeys(shieldedSecretKeys);

  const unshieldedWallet = UnshieldedWallet({
    networkId: network.networkId,
    indexerClientConnection: { indexerHttpUrl: network.indexerHttp, indexerWsUrl: network.indexerWs },
    txHistoryStorage: new InMemoryTransactionHistoryStorage(),
  }).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore));

  const dustWallet = DustWallet({
    networkId: network.networkId,
    costParameters: {
      additionalFeeOverhead: 300_000_000_000_000n,
      feeBlocksMargin: 5,
    },
    indexerClientConnection: { indexerHttpUrl: network.indexerHttp, indexerWsUrl: network.indexerWs },
    provingServerUrl: new URL(network.proofServerUrl),
    relayURL,
  }).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust);

  const walletFacade = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);
  await walletFacade.start(shieldedSecretKeys, dustSecretKey);

  // Wait for sync
  await Rx.firstValueFrom(
    walletFacade.state().pipe(
      Rx.throttleTime(5_000),
      Rx.filter((s: any) => s.isSynced),
    ),
  );

  // Handle DUST based on network's dustMode
  await ensureDust(walletFacade, unshieldedKeystore, network);

  const walletProvider = await makeWalletAndMidnightProvider(
    walletFacade, shieldedSecretKeys, dustSecretKey, unshieldedKeystore,
  );

  return {
    walletFacade,
    shieldedSecretKeys,
    dustSecretKey,
    unshieldedKeystore,
    walletProvider,
    seedHex: Buffer.from(seed).toString('hex'),
    unshieldedAddress: unshieldedKeystore.getBech32Address(),
  };
}
```

---

## 8) Full Provider Assembly

```typescript
// src/config/providers-full.ts
import type { NetworkConfig } from './networks';
import {
  makeNodeZkConfigProvider, makeFetchZkConfigProvider,
  makeHttpProofProvider, make1AMProofProvider,
  makePublicDataProvider,
  makeLevelPrivateStateProvider, makeInMemoryPrivateStateProvider,
} from './providers';

export async function assembleProviders(
  network: NetworkConfig,
  zkConfigPath: string, // filesystem path (Node.js) or URL path (browser)
  walletContext: {
    walletProvider: any;
    midnightProvider?: any;
  },
  privateStateStoreName: string,
  proofProviderOverride?: any, // pass 1AM provingProvider for browser
) {
  const isBrowser = typeof window !== 'undefined';

  const zkConfigProvider = isBrowser
    ? makeFetchZkConfigProvider(zkConfigPath)
    : makeNodeZkConfigProvider(zkConfigPath);

  const proofProvider = proofProviderOverride
    ? make1AMProofProvider(proofProviderOverride)           // browser + 1AM
    : makeHttpProofProvider(network.proofServerUrl, zkConfigProvider); // Node.js

  const privateStateProvider = isBrowser
    ? makeInMemoryPrivateStateProvider()
    : makeLevelPrivateStateProvider(privateStateStoreName, walletContext.walletProvider);

  return {
    zkConfigProvider,
    publicDataProvider: makePublicDataProvider(network),
    proofProvider,
    privateStateProvider,
    walletProvider: walletContext.walletProvider,
    midnightProvider: walletContext.midnightProvider ?? walletContext.walletProvider,
  };
}
```

---

## 9) Contract Registry

```typescript
// src/config/registry.ts

// { contractName: { networkId: contractAddress } }
export type ContractRegistry = Record<string, Partial<Record<string, string>>>;

export const registry: ContractRegistry = {
  counter: {
    undeployed: '',      // fill after local deploy
    preview:    '',      // fill after preview deploy
    preprod:    '09dbe05f...',
    mainnet:    '',
  },
};

export function resolveAddress(
  contractName: string,
  networkId: string,
): string {
  const addr = registry[contractName]?.[networkId];
  if (!addr) throw new Error(
    `No address for contract "${contractName}" on network "${networkId}". Deploy first.`,
  );
  return addr;
}

export function saveAddress(contractName: string, networkId: string, address: string): void {
  if (!registry[contractName]) registry[contractName] = {};
  registry[contractName][networkId] = address;
  // In a real app, persist this to a JSON file or env variable
}
```

---

## 10) npm Scripts

```json
{
  "scripts": {
    "dev":              "VITE_NETWORK=undeployed vite",
    "dev:preview":      "VITE_NETWORK=preview vite",
    "dev:preprod":      "VITE_NETWORK=preprod vite",

    "deploy:local":     "NETWORK=undeployed npx tsx scripts/deploy.ts",
    "deploy:preview":   "NETWORK=preview npx tsx scripts/deploy.ts",
    "deploy:preprod":   "NETWORK=preprod npx tsx scripts/deploy.ts",
    "deploy:mainnet":   "NETWORK=mainnet npx tsx scripts/deploy.ts",

    "local:start":      "docker compose -f standalone.yml up -d",
    "local:stop":       "docker compose -f standalone.yml down",
    "local:logs":       "docker compose -f standalone.yml logs -f",
    "local:proof":      "docker run -d -p 6300:6300 midnightntwrk/proof-server:latest midnight-proof-server -v",

    "preprod:proof":    "docker compose -f proof-server.yml up"
  }
}
```

---

## 11) Vite Config

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [wasm(), topLevelAwait()],
  build: {
    target: 'esnext',
  },
  server: {            // proxy lives inside 'server', not at the top level
    allowedHosts: true,
    proxy: process.env.VITE_NETWORK === 'undeployed' ? {
      '/api': {
        target: 'http://localhost:8088',
        changeOrigin: true,
      },
    } : undefined,
  },
});
```

---

## 12) Common Pitfalls

**`undeployed` indexer uses `/api/v3/graphql`, not `/api/v4/`** — the local Docker indexer ships with v3. Using v4 will 404. All live networks (preview, preprod, mainnet) use v4.

**Three containers required for local dev, not just the proof server** — the node and indexer must also be running. Use `midnight-local-dev` or `docker compose -f standalone.yml up`.

**`walletFacade.state` is a method, not a property** — `walletFacade.state()` returns an Observable. Always use `Rx.firstValueFrom(walletFacade.state().pipe(...))` to read it. Accessing `.state` directly returns the function, not the state.

**`relayURL` must be WebSocket** — convert `https://` → `wss://`, `http://` → `ws://`. The wallet SDK rejects non-WS relay URLs silently or with a confusing error.

**`globalThis.WebSocket = WebSocket` must be at the top of the entry file** — before any `@midnight-ntwrk/wallet-sdk-*` imports. GraphQL subscriptions (wallet sync) will silently fail without it in Node.js.

**`signTransactionIntents` workaround required on all networks** — this is a wallet SDK bug, not environment-specific. Without it, `balanceTx` throws "Failed to clone intent" on headless wallets.

**DUST locked after a failed deploy** — restart the DApp to release locked DUST coins. Affects `undeployed` and `preprod` only; sponsored networks aren't affected.

**ProofStation API key for direct headless preprod access** — if calling `api-preprod.1am.xyz` directly (not via browser 1AM extension), you need `X-API-Key: pk_live_xxx` in headers. The `httpClientProofProvider` does not add this automatically — you'd need to wrap or fork it.

**Old contract addresses after recompile** — verifier keys change with every Compact contract change. Update the registry and redeploy for the affected network. Addresses from other networks are unaffected.

**`setNetworkId` called after SDK operations** — call it before building any providers or wallets. Use `applyNetworkId(network)` at the very top of your setup flow.

**Wallet seed in browser build** — never pass `WALLET_SEED` to Vite's env (it exposes it in the bundle). Headless wallet is Node.js only. Browser always uses the 1AM extension.