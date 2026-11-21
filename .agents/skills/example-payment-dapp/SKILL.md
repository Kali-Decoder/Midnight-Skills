---
name: example-payment-dapp
description: >
  Use this skill whenever building, debugging, or extending a privacy-preserving
  payment dApp on the Midnight Network using the 1AM wallet, Compact smart contracts,
  and Next.js. Triggers include: any mention of Midnight Network, Compact contracts,
  tNIGHT tokens, 1AM wallet integration, ZK proving assets, midnight-js SDK, or
  deploying/calling circuits (deposit, withdraw). Also use when the user encounters
  errors like "Invalid character 'm' at position 0", Ledger 9 version-mismatch or EraMismatchError errors,
  balanceUnsealedTransaction failures, or WASM/WebSocket issues in Next.js with
  Midnight packages. Use this skill even for partial tasks like wiring a single
  provider, decoding ledger state, or debugging a stuck deploy transaction.
---

# Midnight Network Payment DApp

A privacy-preserving payment vault: users deposit/withdraw tNIGHT through a Compact
smart contract through the 1AM wallet (Ledger 9: Midnight.js 5.0.2, DApp Connector 4.1.0, Compact 0.36.1). The contract below compiles with 0.36.1, and the payment module type-checks against its generated types.

## Workflow

When helping the user, follow this sequence:

1. **Detect where they are**: Contract authoring → Provider setup → Deploy → Circuit calls → Indexer/state polling → UI
2. **Check for known gotchas first** (see `references/gotchas.md`) before writing any provider or circuit code
3. **Copy provider wiring** from `references/midnight-session.md` (canonical `lib/midnight.ts` for all browser dApps)
4. **Use `deployContract` / `findDeployedContract`** with providers typed to the contract. For a non-blocking UI, use `createUnprovenDeployTx` + `submitTxAsync`, but then you store private state and the signing key yourself (see `1am-wallet/` §8)
5. **No indexer patch**: the `offset: null` workaround is obsolete on indexer 4.4.101; use `indexerPublicDataProvider(network.indexer)`

---

## Architecture

```
Browser (Next.js)
├── app/payment/PaymentClient.tsx   ← client component (all UI + logic)
├── lib/midnight.ts                 ← wallet detection, session, providers (see references/midnight-session.md)
├── lib/payment.ts                  ← deploy, deposit, withdraw
└── public/zk/payment/             ← ZK proving assets (synced from contract build)

1AM Extension
├── detectWallet() → window.midnight['1am']
├── api.connect('preprod')
├── api.getConfiguration()          → { networkId, indexerUri, ... }
├── api.getUnshieldedAddress()
├── api.getShieldedAddresses()
├── api.balanceUnsealedTransaction(hex)
└── api.submitTransaction(hex)
```

**Transaction flow:**
1. Detect 1AM wallet → connect → create session with all providers
2. Deploy contract (low-level) → store address + private state
3. Deposit: call `receiveUnshielded` circuit → poll indexer for state update
4. Withdraw: call `sendUnshielded` circuit (owner only) → poll indexer

---

## Compact Contract

```compact
pragma language_version >= 0.28.0;
import CompactStandardLibrary;

export ledger balance: Uint<128>;
export ledger totalDeposited: Uint<128>;
export ledger totalWithdrawn: Uint<128>;
export ledger owner: Bytes<32>;

witness ownerKey(): Bytes<32>;

constructor() {
  balance = 0;
  totalDeposited = 0;
  totalWithdrawn = 0;
  owner = disclose(deriveKey(ownerKey()));
}

export circuit deposit(amount: Uint<128>): [] {
  receiveUnshielded(default<Bytes<32>>, disclose(amount));
  totalDeposited = disclose((totalDeposited + amount) as Uint<128>);
  balance = disclose((balance + amount) as Uint<128>);
}

export circuit withdraw(amount: Uint<128>, recipient: UserAddress): [] {
  assert(deriveKey(ownerKey()) == owner, "Only owner can withdraw");
  assert(balance >= amount, "Insufficient balance");
  sendUnshielded(
    default<Bytes<32>>,
    disclose(amount),
    right<ContractAddress, UserAddress>(disclose(recipient))
  );
  totalWithdrawn = disclose((totalWithdrawn + amount) as Uint<128>);
  balance = disclose((balance - amount) as Uint<128>);
}

pure circuit deriveKey(sk: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([pad(32, "payment:owner:v1"), sk]);
}
```

Compile: `cd contract && npm run compact` → output lands in `contract/src/managed/payment/`

---

## Provider Setup (Critical — Read Before Writing Any Code)

`lib/midnight.ts` is the canonical Ledger 9 session (`references/midnight-session.md`). Use it unchanged. The only per-app value is the ZK asset path (`/zk/payment`).

```ts
// lib/midnight.ts
import type { ConnectedAPI, InitialAPI } from '@midnightntwrk/dapp-connector-api';
import {
  dappConnectorNetwork,
  dappConnectorProofProvider,
  dappConnectorWalletProviders,
} from '@midnightntwrk/midnight-js-dapp-connector-proof-provider';
import { indexerPublicDataProvider } from '@midnightntwrk/midnight-js-indexer-public-data-provider';
import { FetchZkConfigProvider } from '@midnightntwrk/midnight-js-fetch-zk-config-provider';
import { levelPrivateStateProvider } from '@midnightntwrk/midnight-js-level-private-state-provider';
import type { MidnightProviders } from '@midnightntwrk/midnight-js-types';
import type { MidnightNetwork } from '@midnightntwrk/midnight-js-utils';
import { CostModel } from '@midnightntwrk/ledger-v9';
import { ContractState } from '@midnight-ntwrk/compact-runtime';
import { MidnightBech32m, ShieldedCoinPublicKey } from '@midnightntwrk/wallet-sdk-address-format';

export type ConnectedSession = {
  api: ConnectedAPI;
  /** Network id + endpoints, read from the wallet. There is no global setNetworkId any more. */
  network: MidnightNetwork;
  providers: MidnightProviders;
  unshieldedAddress: string;
  coinPublicKeyBytes: Uint8Array;
};

export function fromHex(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Uint8Array.from(h.match(/.{1,2}/g) ?? [], (b) => parseInt(b, 16));
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Demo-grade password for the encrypted IndexedDB private-state store: random, kept in localStorage.
 * Production apps should ask the user or derive it from wallet-held material.
 */
function demoStoragePassword(): Promise<string> {
  const k = 'midnight-private-storage-password';
  let pw = localStorage.getItem(k);
  if (!pw) {
    pw = `Mn-${crypto.randomUUID()}-${crypto.randomUUID()}`;
    localStorage.setItem(k, pw);
  }
  return Promise.resolve(pw);
}

export async function detectWallet(): Promise<InitialAPI> {
  const midnight = (window as unknown as { midnight?: Record<string, InitialAPI> }).midnight ?? {};
  const w = midnight['1am'] ?? Object.values(midnight)[0];
  if (!w) throw new Error('No Midnight wallet extension found');
  return w;
}

export async function createConnectedSession(api: ConnectedAPI, zkAssetPath: string): Promise<ConnectedSession> {
  const network = await dappConnectorNetwork(api);
  const [{ unshieldedAddress }, shielded] = await Promise.all([
    api.getUnshieldedAddress(),
    api.getShieldedAddresses(),
  ]);

  // zkAssetPath must serve compiler/ (contract-manifest.json, contract-info.json), keys/ and zkir/.
  const zkConfigProvider = new FetchZkConfigProvider<string>(
    new URL(zkAssetPath, window.location.origin).toString(),
    { fetchFunc: window.fetch.bind(window) },
  );
  const proofProvider = await dappConnectorProofProvider(api, zkConfigProvider, CostModel.initialCostModel());
  const { walletProvider, midnightProvider } = await dappConnectorWalletProviders(api);

  return {
    api,
    network,
    providers: {
      privateStateProvider: levelPrivateStateProvider({
        accountId: unshieldedAddress,
        privateStoragePasswordProvider: demoStoragePassword,
      }),
      publicDataProvider: indexerPublicDataProvider(network.indexer),
      zkConfigProvider,
      proofProvider,
      walletProvider,
      midnightProvider,
      config: { networkId: network.networkId, ttlSeconds: 3600 },
    },
    unshieldedAddress,
    // The connector returns keys in Bech32m, not hex.
    coinPublicKeyBytes: new Uint8Array(
      ShieldedCoinPublicKey.codec.decode(network.networkId, MidnightBech32m.parse(shielded.shieldedCoinPublicKey)).data,
    ),
  };
}

/** Latest on-chain state of a contract, decoded with this app's own compact-runtime copy. */
export async function queryLatestState(session: ConnectedSession, contractAddress: string) {
  const read = await session.providers.publicDataProvider.queryContractState(contractAddress);
  if (!read) return null;
  return read.contractState.deserialize({ v9: ContractState });
}
```

What changed from the Ledger 8 version: no `setNetworkId` (the network id is in `providers.config`), no hand-rolled `proveTx`/`balanceTx`/`submitTx` (the DApp Connector factories are era-aware), no patched indexer provider, `levelPrivateStateProvider` instead of the in-memory `setContractAddress()` store, and the coin public key decoded from the connector's **Bech32m** form.

---

## Deploy & Circuit Calls

```ts
// lib/payment.ts
import type { ProvableCircuitId } from '@midnight-ntwrk/compact-js';
import { deployContract, findDeployedContract } from '@midnightntwrk/midnight-js-contracts';
import type { MidnightProviders } from '@midnightntwrk/midnight-js-types';
import { CompiledPaymentContract, ledger, type PaymentContract, type PaymentPrivateState } from '../contract/src/index';
import { queryLatestState, type ConnectedSession } from './midnight';

const PRIVATE_STATE_ID = 'paymentPrivateState';
export const ZK_ASSET_PATH = '/zk/payment';

type PaymentProviders = MidnightProviders<ProvableCircuitId<PaymentContract>, typeof PRIVATE_STATE_ID, PaymentPrivateState>;
const providersFor = (s: ConnectedSession) => s.providers as unknown as PaymentProviders;

export async function deployPayment(session: ConnectedSession, ownerSecretKey: Uint8Array): Promise<string> {
  const deployed = await deployContract(providersFor(session), {
    compiledContract: CompiledPaymentContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: { ownerSecretKey },
  });
  return deployed.deployTxData.public.contractAddress;
}

const connect = (session: ConnectedSession, contractAddress: string) =>
  findDeployedContract(providersFor(session), {
    compiledContract: CompiledPaymentContract,
    contractAddress,
    privateStateId: PRIVATE_STATE_ID,
  });

export async function depositPayment(session: ConnectedSession, contractAddress: string, amount: bigint) {
  await (await connect(session, contractAddress)).callTx.deposit(amount);
}

export async function withdrawPayment(session: ConnectedSession, contractAddress: string, amount: bigint, recipient: Uint8Array) {
  await (await connect(session, contractAddress)).callTx.withdraw(amount, { bytes: recipient }); // UserAddress → { bytes }
}

export async function fetchPaymentState(session: ConnectedSession, contractAddress: string) {
  const state = await queryLatestState(session, contractAddress);
  if (!state) return null;
  const l = ledger(state.data);   // pass .data (ChargedState), not the ContractState
  return { balance: l.balance, totalDeposited: l.totalDeposited, totalWithdrawn: l.totalWithdrawn };
}
```

### Compiled Contract (`contract/src/index.ts`)

```ts
import { CompiledContract } from '@midnight-ntwrk/compact-js';   // not compact-runtime
import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import { Contract, type Ledger } from './managed/payment/contract/index.js';
export { ledger } from './managed/payment/contract/index.js';

export type PaymentPrivateState = { ownerSecretKey: Uint8Array };
export type PaymentContract = Contract<PaymentPrivateState>;

const witnesses = {
  ownerKey: ({ privateState }: WitnessContext<Ledger, PaymentPrivateState>): [PaymentPrivateState, Uint8Array] =>
    [privateState, privateState.ownerSecretKey],
};

// Browser bundle: no node:path. Keys load through the session's FetchZkConfigProvider.
export const CompiledPaymentContract = CompiledContract.make<PaymentContract>('payment', Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets('/zk/payment'),
);
```

---

## Indexer & State

`deployContract` and `callTx` resolve once the transaction is indexed, so read state right after with `fetchPaymentState`. To wait for a specific change, poll `queryLatestState` (or use `publicDataProvider.watchForTxData(txId)` with the non-blocking API). Indexer endpoints come from the wallet: preview is `indexer.preview.midnight.network/api/v4/graphql`, and preprod/mainnet are Blockfrost.

---

## Next.js Configuration

### WebSocket shim (`lib/isomorphic-ws-fix.mjs`)

```js
export default globalThis.WebSocket;
export const WebSocket = globalThis.WebSocket;
```

### `next.config.mjs`

```js
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

export default {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, net: false, tls: false, child_process: false };
      config.resolve.alias = { ...config.resolve.alias, "isomorphic-ws": require.resolve("./lib/isomorphic-ws-fix.mjs") };
    }
    config.experiments = { ...config.experiments, asyncWebAssembly: true, topLevelAwait: true };
    return config;
  },
};
```

### package.json scripts and page

Next 15 builds with webpack by default: `{ "dev": "next dev", "build": "npm run sync:assets && next build" }`. Add `--webpack` only on Next 16; Next 15.5 rejects the flag. Load the client component from a `'use client'` page with `dynamic(() => import('./payment/PaymentClient'), { ssr: false })`, or `next build` fails while prerendering (`classic-level` native module).

---

## Token Units

| Unit | Conversion |
|---|---|
| 1 NIGHT | 1,000,000 Stars |
| 1 Star | 1 base unit (used in all transactions) |

Always use `BigInt` — Stars overflow JS `number` at realistic balances.

---

## Known Issues & Fixes

| Symptom | Cause | Fix |
|---|---|---|
| `Invalid character 'm' at position 0` | A Bech32m string was parsed as hex/bytes | Use `session.coinPublicKeyBytes` (decoded via `ShieldedCoinPublicKey.codec`) and pass `{ bytes }` for `UserAddress` args |
| Deploy feels slow | `deployContract` waits for indexing | Expected; for progress UI use the non-blocking API (`1am-wallet/` §8) |
| `Version mismatch: compiled code expects 0.21.0, runtime is 0.16.0` | Runtime older than toolchain | `compact-runtime@0.21.0`, `compact compile +0.36.1` |
| `EraMismatchError: artifact-era-undeclared` | `public/zk/payment/` lacks `compiler/` | Sync `compiler/`, `keys/`, `zkir/` |
| Wallet error `InsufficientFunds` | Not enough tNIGHT/DUST (DApp Connector 4.1.0) | Fund from the faucet and register for DUST (Preview relaunched 7 Nov 2026) |
| `setNetworkId` / `midnight-js-network-id` missing | Removed in Midnight.js 5 | Use `providers.config` from the session |
| `ledger()` fails with wrong type | Not decoded / wrong object | `ledger(read.contractState.deserialize({ v9: ContractState }).data)` (`queryLatestState` does it) |
| ZK asset 404 → cryptic SDK error | Assets not synced to public/ | Run `npm run sync:assets` before dev; verify URLs directly in browser |
| WASM / top-level-await errors | Missing webpack config or Turbopack | Add `asyncWebAssembly: true`, `topLevelAwait: true` (Next 16: `--webpack`) |
| Wrong wallet detected | Both Lace and 1AM present | Check `window.midnight['1am']` first; fall back to `window.midnight?.mnLace` |

---

## ZK Asset Hosting

Run `npm run sync:assets` to copy `contract/src/managed/payment/{compiler,keys,zkir}/` → `public/zk/payment/`. `compiler/contract-manifest.json` is required by Midnight.js 5.

**Before debugging any provider/SDK error**, open the asset URLs directly:
`http://localhost:3000/zk/payment/keys/deposit.prover` — a 404 here surfaces as a cryptic SDK error.

The `FetchZkConfigProvider` fetches from `/zk/payment/` at runtime. Next.js serves `public/` by default — no extra config needed.