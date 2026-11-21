---
name: multinetwork
description: Build a single Midnight dApp that deploys and runs across all networks (undeployed/local, preview, preprod, mainnet). Covers local Docker stack setup via midnight-local-dev, environment config, provider routing, wallet abstraction, proof server selection, ZK asset resolution, contract registry, and DUST flow differences per network. Use when a user wants to target multiple networks from one codebase, set up a local dev environment, or understand what changes between undeployed/preprod/preview/mainnet.
---

# Multi-Network Midnight Skill

This skill covers building a Midnight DApp that works across all four network targets from a single codebase. Networks differ in three ways: **endpoints** (and whether they need a Blockfrost token), **funding** (genesis wallet vs faucet vs real NIGHT), and **where proving runs**. Everything else, including the code, is identical.

> **Ledger 9 (Nov 2026).** All four networks run Ledger 9 and need Midnight.js **5.0.x**, Wallet SDK **2.0.1**, `@midnightntwrk/ledger-v9` **1.0.2**, Compact **0.36.1**, proof server **9.0.2**, indexer **4.4.101**. There is no `setNetworkId` any more: the network id lives in each configuration object. Network ids and endpoint paths did not change in the upgrade, but preprod/mainnet indexer + RPC moved to **Blockfrost** in Oct/Nov 2026.

**Primary references:**
- `github.com/midnightntwrk/midnight-local-dev` — official local Docker stack + funding CLI
- `github.com/midnightntwrk/example-counter` — official reference DApp
- `docs.midnight.network/guides/networks-and-environments` — endpoints, Blockfrost, faucets
- `references/midnight-session.md` (this repo) — the verified headless and browser wiring

---

## 1) The Four Networks at a Glance

| Network | `networkId` | Use for | Endpoints | Funding / DUST |
|---|---|---|---|---|
| `undeployed` | `'undeployed'` | Local dev, CI | `localhost` (no token) | Genesis wallet pre-funded; register NIGHT for DUST |
| `preview` | `'preview'` | Active development | Midnight-hosted (no token) | Faucet tNIGHT → register for DUST |
| `preprod` | `'preprod'` | Pre-release / integration | **Blockfrost** (`project_id` token) | Faucet tNIGHT → register for DUST |
| `mainnet` | `'mainnet'` | Production | **Blockfrost** (`project_id` token) | Real NIGHT → register for DUST (cNIGHT registrations carried over) |

**Proving:** the official model is a **local** proof server (`http://localhost:6300`, image `midnightntwrk/proof-server:9.0.2`) on every network. Blockfrost does not provide one. Alternatives: the Wallet SDK's in-process prover (`provers: { v9: { kind: 'wasm' } }`), or in the browser, the user's wallet proving through the DApp Connector. 1AM's hosted ProofStation (`https://api-preview.1am.xyz`, `https://api.1am.xyz`; `/health` responded on 21 Nov 2026) is a third-party option. 1AM has advertised sponsoring fees on preview/mainnet, but confirm the current policy with 1AM after the Preview relaunch and mainnet DUST reset before you build on it.

**Ledger 9 network events:**
- **Preview** relaunched as a **new chain** on 7 Nov 2026: old contracts, balances and registrations are gone. Redeploy, re-request tNIGHT, and re-register DUST.
- **Preprod** upgraded in place on 9 Nov 2026 (block 3,348,434). History and contracts carried over; DUST registrations not backed by cNIGHT were cleared.
- **Mainnet** moved to Ledger 9 on 6 Nov 2026 and no longer decodes Ledger 8 transactions. DUST state reset and replayed to full cap; generation parameters are unchanged.

---

## 2) Local Docker Stack (`undeployed`)

Running `undeployed` needs three containers: a node, an indexer and a proof server. **The proof server alone is not enough.**

### Option A: `midnight-local-dev` (recommended)

```bash
git clone https://github.com/midnightntwrk/midnight-local-dev
cd midnight-local-dev
npm install
npm start
```

`npm start` detects running containers, starts the stack via Docker Compose, initializes the genesis master wallet (seed `0x00...01`), and offers a funding menu (50,000 tNIGHT per account) that also registers DUST.

```
networkId:   undeployed
indexer:     http://localhost:8088/api/v4/graphql
indexerWS:   ws://localhost:8088/api/v4/graphql/ws
node:        http://localhost:9944
proofServer: http://localhost:6300
```

The local indexer uses **`/api/v4/graphql`**, the same path as preview. (Older skills said v3; indexer 4.4.101 serves v4, and the Wallet SDK READMEs use `localhost:8088/api/v4/graphql`.)

### Option B: Docker Compose directly

```bash
docker compose -f standalone.yml up -d      # from the midnight-local-dev repo root
docker compose -f standalone.yml ps
docker compose -f standalone.yml logs -f
docker compose -f standalone.yml down
```

### Docker Image Versions (Ledger 9.1 support matrix)

| Service | Image | Version |
|---|---|---|
| Node | `midnightntwrk/midnight-node` | `2.1.101` |
| Indexer | `midnightntwrk/indexer-standalone` | `4.4.101` |
| Proof Server | `midnightntwrk/proof-server` | `9.0.2` |

Indexer versions before 4.4.101 are incompatible with Ledger 9. If your local chain volume predates the upgrade, wipe it (`docker compose down -v`).

### Lace wallet on `undeployed`

Select "Undeployed" in Lace's network settings; it uses `localhost:9944`, `localhost:8088` and `localhost:6300`.

Genesis master wallet seed: `0x0000000000000000000000000000000000000000000000000000000000000001` (local only).

---

## 3) Network Configuration

```typescript
// src/config/networks.ts
import { networks, type MidnightNetwork } from '@midnightntwrk/midnight-js-utils';

export type NetworkName = 'undeployed' | 'preview' | 'preprod' | 'mainnet';

export interface NetworkConfig extends MidnightNetwork {
  proofServerUrl: string;
  faucetUrl?: string;
}

const local: MidnightNetwork = {
  networkId: 'undeployed',
  indexer: {
    queryURL: 'http://localhost:8088/api/v4/graphql',
    subscriptionURL: 'ws://localhost:8088/api/v4/graphql/ws',
  },
  nodeURL: 'http://localhost:9944',
  nodeWsURL: 'ws://localhost:9944',
};

function blockfrostToken(name: NetworkName): string {
  const token = process.env.BLOCKFROST_PROJECT_ID;   // per network: nightpreprod… / nightmainnet…
  if (!token) throw new Error(`${name} is served by Blockfrost: set BLOCKFROST_PROJECT_ID`);
  return token;
}

export function getNetwork(name: NetworkName): NetworkConfig {
  const proofServerUrl = process.env.PROOF_SERVER_URL ?? 'http://127.0.0.1:6300';
  switch (name) {
    case 'undeployed':
      return { ...local, proofServerUrl };
    case 'preview':
      return { ...networks.preview(), proofServerUrl, faucetUrl: 'https://faucet.preview.midnight.network/' };
    case 'preprod':
      return { ...networks.preprod(blockfrostToken(name)), proofServerUrl, faucetUrl: 'https://midnight-tmnight-preprod.nethermind.dev/' };
    case 'mainnet':
      return { ...networks.mainnet(blockfrostToken(name)), proofServerUrl };
  }
}

export function getActiveNetwork(): NetworkConfig {
  const name = (process.env.NETWORK || process.env.VITE_NETWORK || 'undeployed') as NetworkName;
  if (!['undeployed', 'preview', 'preprod', 'mainnet'].includes(name)) {
    throw new Error(`Unknown network: "${name}"`);
  }
  return getNetwork(name);
}
```

`networks.*()` returns `{ networkId, indexer: { queryURL, subscriptionURL }, nodeURL, nodeWsURL }`. Blockfrost URLs carry the token as `?project_id=…`, so strip it before logging. In a browser, never ship the token: proxy through a backend, or use the wallet's own endpoints (`dappConnectorNetwork(api)`).

Endpoint reference (unchanged by Ledger 9):

| Network | Indexer HTTP | Node RPC |
|---|---|---|
| `undeployed` | `http://localhost:8088/api/v4/graphql` | `http://localhost:9944` |
| `preview` | `https://indexer.preview.midnight.network/api/v4/graphql` | `https://rpc.preview.midnight.network` |
| `preprod` | `https://midnight-preprod.blockfrost.io/api/v0?project_id=<token>` | `https://rpc.midnight-preprod.blockfrost.io?project_id=<token>` |
| `mainnet` | `https://midnight-mainnet.blockfrost.io/api/v0?project_id=<token>` | `https://rpc.midnight-mainnet.blockfrost.io?project_id=<token>` |

`indexer.preprod.midnight.network` / `indexer.mainnet.midnight.network` return **410 `ENDPOINT_DECOMMISSIONED`** (retired 9 Oct 2026); `rpc.preprod/mainnet.midnight.network` shut down on 18 Nov 2026.

---

## 4) Headless Wallet (Node.js, all networks)

Wallet SDK 2.x: `WalletFacade.init` (the constructor is private), started from seeds. The same code works on every network. Only the `NetworkConfig` changes.

```typescript
// src/config/wallet.ts
import { WebSocket } from 'ws';
import { WalletFacade, WalletEntrySchema } from '@midnightntwrk/wallet-sdk-facade';
import { ShieldedWallet } from '@midnightntwrk/wallet-sdk-shielded';
import { UnshieldedWallet, createKeystore, PublicKey } from '@midnightntwrk/wallet-sdk-unshielded-wallet';
import { DustWallet } from '@midnightntwrk/wallet-sdk-dust-wallet';
import { WalletSeeds, generateRandomSeed } from '@midnightntwrk/wallet-sdk-hd';
import { InMemoryTransactionHistoryStorage } from '@midnightntwrk/wallet-sdk-abstractions';
import type { NetworkConfig } from './networks';

// Required in Node.js, before any wallet sync starts.
globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

export async function buildHeadlessWallet(network: NetworkConfig, seedHex?: string) {
  const masterSeed = seedHex ? Buffer.from(seedHex, 'hex') : generateRandomSeed();
  const seeds = WalletSeeds.fromMasterSeed(masterSeed);       // account 0 / index 0, as HDWallet derives
  const keystore = createKeystore({ kind: 'schnorr', secret: seeds.unshielded }, network.networkId);

  const facade = await WalletFacade.init({
    configuration: {
      networkId: network.networkId,
      indexerClientConnection: { indexerHttpUrl: network.indexer.queryURL, indexerWsUrl: network.indexer.subscriptionURL },
      relayURL: new URL(network.nodeWsURL),                   // ws:// or wss://
      provingServerUrl: new URL(network.proofServerUrl),      // or provers: { v9: { kind: 'wasm' } }
      costParameters: { feeBlocksMargin: 5 },
      txHistoryStorage: new InMemoryTransactionHistoryStorage(WalletEntrySchema),
    },
    shielded: (config) => ShieldedWallet(config).startWithSeed(seeds.shielded),
    unshielded: (config) => UnshieldedWallet(config).startWithPublicKey(PublicKey.fromKeyStore(keystore)),
    dust: (config) => DustWallet(config).startWithSeed(seeds.dust),
  });

  await facade.start(seeds);
  const state = await facade.waitForSyncedState();
  return {
    facade,
    seeds,
    keystore,
    state,
    seedHex: Buffer.from(masterSeed).toString('hex'),
    unshieldedAddress: keystore.getBech32Address().asString(),
  };
}
```

On preprod (which has Ledger 8 history), a brand-new wallet can pass `skipLedgerV8DustHistory: true` to `DustWallet` to start faster.

---

## 5) DUST Flow (same on every network)

```
undeployed → genesis NIGHT (or funding menu) → register UTXOs → wait for DUST
preview    → faucet tNIGHT                    → register UTXOs → wait for DUST
preprod    → faucet tNIGHT                    → register UTXOs → wait for DUST (re-register after 9 Nov 2026)
mainnet    → NIGHT                            → register UTXOs → wait for DUST (cNIGHT registrations replayed)
```

```typescript
// src/config/dust.ts
import * as Rx from 'rxjs';
import type { WalletFacade } from '@midnightntwrk/wallet-sdk-facade';
import type { createKeystore } from '@midnightntwrk/wallet-sdk-unshielded-wallet';

export async function ensureDust(facade: WalletFacade, keystore: ReturnType<typeof createKeystore>): Promise<void> {
  const signSegment = (payload: Uint8Array) => Promise.resolve(keystore.signData(payload));
  const state = await facade.waitForSyncedState();
  if (state.dust.balance(new Date()) > 0n) return;            // 2.x: balance(time), not walletBalance

  const unregistered = state.unshielded.availableCoins.filter((c) => c.meta?.registeredForDustGeneration !== true);
  if (unregistered.length > 0) {
    const recipe = await facade.registerNightUtxosForDustGeneration(unregistered, keystore.getPublicKey(), signSegment);
    await facade.submitTransaction(await facade.finalizeRecipe(recipe));
  }

  await Rx.firstValueFrom(
    facade.state().pipe(Rx.throttleTime(5_000), Rx.filter((s) => s.isSynced && s.dust.balance(new Date()) > 0n)),
  );
}
```

DUST parameters (unchanged by Ledger 9): cap 5 DUST per NIGHT, 10^15 Specks per DUST, about 1 week to cap, 3 h grace.

---

## 6) Provider Assembly

```typescript
// src/config/providers.ts
import { httpClientProofProvider } from '@midnightntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnightntwrk/midnight-js-indexer-public-data-provider';
import { NodeZkConfigProvider } from '@midnightntwrk/midnight-js-node-zk-config-provider';
import { levelPrivateStateProvider } from '@midnightntwrk/midnight-js-level-private-state-provider';
import {
  createLedger9MidnightProvider, createLedger9WalletProvider, type MidnightProviders,
} from '@midnightntwrk/midnight-js-types';
import type { NetworkConfig } from './networks';
import type { buildHeadlessWallet } from './wallet';

export function assembleProviders(
  network: NetworkConfig,
  wallet: Awaited<ReturnType<typeof buildHeadlessWallet>>,
  zkConfigPath: string,
  privateStoragePassword: string,
): MidnightProviders {
  const { facade, keystore, state } = wallet;
  const signSegment = (payload: Uint8Array) => Promise.resolve(keystore.signData(payload));
  const zkConfigProvider = new NodeZkConfigProvider<string>(zkConfigPath);

  return {
    privateStateProvider: levelPrivateStateProvider({
      accountId: wallet.unshieldedAddress,
      privateStoragePasswordProvider: async () => privateStoragePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(network.indexer),
    zkConfigProvider,
    proofProvider: httpClientProofProvider({ url: network.proofServerUrl, zkConfigProvider }),
    walletProvider: createLedger9WalletProvider({
      getCoinPublicKey: () => state.shielded.coinPublicKey.toHexString(),
      getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
      balanceTx: async (tx, ttl) => {
        const recipe = await facade.balanceUnboundTransaction(facade.adoptTransaction(tx.serialize(), 'Unbound'), {
          ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000),
        });
        return facade.finalizeRecipe(await facade.signRecipe(recipe, signSegment));
      },
    }),
    midnightProvider: createLedger9MidnightProvider((tx) =>
      facade.submitTransaction(facade.adoptTransaction(tx.serialize(), 'Finalized')),
    ),
    config: { networkId: network.networkId, ttlSeconds: 3600 },
  };
}
```

Wallet SDK 2.x `signRecipe` signs each part at its own stage. The old `signTransactionIntents` ("Failed to clone intent") workaround is **not needed**.

**Browser** builds don't use a headless wallet. They get the network, proof, wallet and midnight providers from the user's wallet via `@midnightntwrk/midnight-js-dapp-connector-proof-provider`. The network, including Blockfrost-backed endpoints, comes from whatever the user selected in the wallet. See `references/midnight-session.md`.

---

## 8) Contract Registry

```typescript
// src/config/registry.ts

// { contractName: { networkId: contractAddress } }
export type ContractRegistry = Record<string, Partial<Record<string, string>>>;

export const registry: ContractRegistry = {
  counter: {
    undeployed: '',      // fill after local deploy
    preview:    '',      // Preview relaunched 7 Nov 2026: pre-relaunch addresses are gone
    preprod:    '',      // Ledger 8 deployments carried over, but recompiled (0.36.x) contracts need a fresh deploy
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

## 9) npm Scripts

```json
{
  "scripts": {
    "dev":            "VITE_NETWORK=undeployed vite",
    "dev:preview":    "VITE_NETWORK=preview vite",
    "dev:preprod":    "VITE_NETWORK=preprod vite",

    "compact":        "compact compile +0.36.1 contract/src/counter.compact contract/src/managed/counter",
    "deploy:local":   "NETWORK=undeployed npx tsx scripts/deploy.ts",
    "deploy:preview": "NETWORK=preview npx tsx scripts/deploy.ts",
    "deploy:preprod": "NETWORK=preprod BLOCKFROST_PROJECT_ID=$BLOCKFROST_PREPROD npx tsx scripts/deploy.ts",
    "deploy:mainnet": "NETWORK=mainnet BLOCKFROST_PROJECT_ID=$BLOCKFROST_MAINNET npx tsx scripts/deploy.ts",

    "local:start":    "docker compose -f standalone.yml up -d",
    "local:stop":     "docker compose -f standalone.yml down",
    "local:logs":     "docker compose -f standalone.yml logs -f",
    "proof":          "docker run -d -p 6300:6300 midnightntwrk/proof-server:9.0.2 midnight-proof-server -v"
  }
}
```

---

## 10) Vite Config

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

## 11) Common Pitfalls

**Using the retired preprod/mainnet indexer hosts** → HTTP 410 `ENDPOINT_DECOMMISSIONED`. Use Blockfrost with a per-network `project_id` (a preprod token is rejected on mainnet and vice versa).

**`undeployed` indexer path** → `/api/v4/graphql`, the same as preview. `/api/v3` is the legacy path.

**Three containers required for local dev** → node 2.1.101 + indexer 4.4.101 + proof server 9.0.2. Wipe old chain volumes after upgrading images.

**`facade.state` is a method** → `facade.state()` returns an Observable; `facade.waitForSyncedState()` resolves once synced.

**`relayURL` must be WebSocket** → use `network.nodeWsURL`.

**`globalThis.WebSocket = WebSocket`** at the top of the Node entry file, or wallet sync silently stalls.

**Calling `setNetworkId`** → removed in Midnight.js 5. Pass `networkId` in `providers.config` and the wallet configuration.

**Stale balances/contracts on preview** → Preview relaunched on 7 Nov 2026. Redeploy, re-request tNIGHT and re-register DUST.

**No DUST on preprod** → re-register tNIGHT UTXOs; the 9 Nov 2026 upgrade cleared non-cNIGHT registrations.

**DUST booked by a pending tx** → Wallet SDK 2.x releases the bookings when the node provably rejected the submission, otherwise at TTL or sync. Wait rather than restart.

**ProofStation headless access** → calling `api-*.1am.xyz` directly needs 1AM's API key header, which `httpClientProofProvider` does not add.

**Old contract addresses after recompile** → moving from compiler 0.31 to 0.36.x changes verifier keys. Redeploy per network and update the registry.

**Wallet seed or Blockfrost token in a browser build** → never pass `WALLET_SEED` or `BLOCKFROST_PROJECT_ID` through Vite env; both end up in the bundle.
