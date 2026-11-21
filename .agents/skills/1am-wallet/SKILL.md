---
name: 1am-wallet
description: Integrate the 1AM wallet for dust-free contract deployment and transaction flow on Midnight Network. Use this skill whenever a user is building a Midnight Network dApp, connecting to the 1AM browser extension, deploying or calling a Compact contract, handling ZK proving, setting up providers, or asking about dust-free transaction flow. Also use it for indexer patching, private state providers, payload encryption, or any question involving window.midnight['1am'].
---

**Scope**
This skill covers detecting, connecting, and wiring the 1AM browser extension (`window.midnight['1am']`) into a frontend dApp. The wallet proves and balances transactions through the DApp Connector API. 1AM has advertised DUST fee sponsorship through its ProofStation; confirm the current policy with 1AM after the Ledger 9 DUST reset. This skill is generic: replace every `YourContract` / `yourCircuit` / `your-contract` placeholder with your actual contract name and circuit IDs.

> **Ledger 9 (Nov 2026).** Targets Midnight.js **5.0.2**, DApp Connector API **4.1.0**, `ledger-v9` **1.0.2**, `compact-runtime` **0.21.0**, Compact **0.36.1** (`pragma language_version >= 0.28.0`). `setNetworkId` is gone, the `offset: null` indexer patch is no longer needed, and the hand-rolled proof/wallet/midnight providers are replaced by `@midnightntwrk/midnight-js-dapp-connector-proof-provider`. The session code in §3 is the same file `templates/locker-dapp` ships, and that template type-checks and passes `next build`. Make sure users run a Ledger 9 build of the 1AM extension.

Suggested file layout (adapt to your project):
- `src/lib/midnight.ts` → wallet session and provider wiring (**canonical source:** `references/midnight-session.md`)
- `src/lib/encryption.ts` → optional payload encryption derived from wallet signature
- `src/hooks/useContract.ts` → app logic and state orchestration
- `src/contexts/WalletContext.tsx` → wallet connection state

**Shared references:** `references/midnight-session.md`, `references/gotchas.md`, `references/versions.json`

---

## 1) Dependencies

The Ledger 9.1 set (checked against npm and the support matrix on 21 Nov 2026):

```bash
npm install \
  @midnight-ntwrk/compact-runtime@0.21.0 \
  @midnight-ntwrk/compact-js@3.0.2 \
  @midnightntwrk/ledger-v9@1.0.2 \
  @midnightntwrk/dapp-connector-api@4.1.0 \
  @midnightntwrk/midnight-js-contracts@5.0.2 \
  @midnightntwrk/midnight-js-types@5.0.2 \
  @midnightntwrk/midnight-js-utils@5.0.2 \
  @midnightntwrk/midnight-js-dapp-connector-proof-provider@5.0.2 \
  @midnightntwrk/midnight-js-fetch-zk-config-provider@5.0.2 \
  @midnightntwrk/midnight-js-indexer-public-data-provider@5.0.2 \
  @midnightntwrk/midnight-js-level-private-state-provider@5.0.2 \
  @midnightntwrk/wallet-sdk-address-format@4.0.1
```

`compact-runtime` / `compact-js` stay on the `@midnight-ntwrk` scope (the compiler's output imports `@midnight-ntwrk/compact-runtime`). Everything else is `@midnightntwrk`. **Removed:** `@midnight-ntwrk/midnight-js-network-id`, `@midnight-ntwrk/ledger-v8`, and the obsolete `@midnight-ntwrk/ledger`.

Vite requires these plugins for WASM and top-level await (the Compact SDK uses both):

```bash
npm install -D vite-plugin-wasm vite-plugin-top-level-await
```

For Next.js, see §12 — webpack config is required instead.

---

## 2) Wallet Detection & Connection

The extension injects asynchronously — always poll, never assume it's immediately available. Both 1AM and Lace wallets are supported.

```ts
// Inline detection (non-React)
function detectWallet(): Promise<any | null> {
  return new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      const wallet = (window as any).midnight?.['1am'];
      if (wallet) { resolve(wallet); return; }
      if (++attempts > 50) { resolve(null); return; }
      setTimeout(check, 100);
    };
    check();
  });
}

// Connect
const wallet = await detectWallet();
if (!wallet) throw new Error('1AM wallet not installed');
const api = await wallet.connect('preview'); // 'preview' | 'preprod' | 'mainnet' (all Ledger 9)
```

### React Context + useWallet Hook

Wrap your app with `WalletProvider`, then call `useWallet()` in any component.

```tsx
// contexts/WalletContext.tsx
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type WalletContextType = {
  address: string | null;
  isConnected: boolean;
  walletType: '1am' | 'lace' | null;
  isConnecting: boolean;
  walletStatus: 'checking' | 'detected' | 'not-found';
  session: ConnectedSession | null;
  connect: (network?: string) => Promise<ConnectedSession | undefined>;
  disconnect: () => void;
};

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [walletType, setWalletType] = useState<'1am' | 'lace' | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletStatus, setWalletStatus] = useState<'checking' | 'detected' | 'not-found'>('checking');
  const [session, setSession] = useState<ConnectedSession | null>(null);
  const connectingRef = useRef(false);

  // Poll for wallet injection — runs once on mount
  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => {
      const w1am = (window as any).midnight?.['1am'];
      const wLace = (window as any).midnight?.mnLace;
      if (w1am) { setWalletType('1am'); setWalletStatus('detected'); clearInterval(id); return; }
      if (wLace) { setWalletType('lace'); setWalletStatus('detected'); clearInterval(id); return; }
      if (Date.now() - startedAt >= 6000) { setWalletStatus('not-found'); clearInterval(id); }
    }, 300);
    return () => clearInterval(id);
  }, []);

  const connect = useCallback(async (network = 'preview') => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    setIsConnecting(true);
    try {
      const wallet = (window as any).midnight?.['1am'] ?? (window as any).midnight?.mnLace;
      if (!wallet) throw new Error('No wallet found');
      const api = await wallet.connect(network);
      const { createConnectedSession } = await import('../lib/midnight');
      const sess = await createConnectedSession(api, '/zk/your-contract'); // where your ZK assets are served
      setSession(sess);
      setAddress((await api.getUnshieldedAddress()).unshieldedAddress);
      setIsConnected(true);
      return sess;
    } finally {
      connectingRef.current = false;
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null); setIsConnected(false); setSession(null);
    setWalletStatus('checking'); setWalletType(null);
  }, []);

  return (
    <WalletContext.Provider value={{ address, isConnected, walletType, isConnecting, walletStatus, session, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextType {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within a WalletProvider');
  return ctx;
}
```

### WalletConnect UI Component

Always render all four states: `checking`, `not-found`, disconnected (connect CTA), connected (address + disconnect).

```tsx
import { Loader2, LogOut, Shield, Smartphone } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';

export default function WalletConnect() {
  const { isConnected, address, walletType, walletStatus, isConnecting, connect, disconnect } = useWallet();

  if (walletStatus === 'checking')
    return <span className="text-zinc-600 text-[11px] font-mono animate-pulse">Checking wallet...</span>;

  if (isConnected)
    return (
      <div className="flex items-center gap-3 border border-white/[0.06] px-4 py-2">
        {walletType === 'lace'
          ? <Smartphone className="w-3.5 h-3.5 text-violet-400" />
          : <Shield className="w-3.5 h-3.5 text-violet-400" />}
        <div>
          <span className="text-[9px] tracking-[0.2em] font-mono text-zinc-600 uppercase block">
            {walletType === '1am' ? '1AM' : 'Lace'}
          </span>
          <span className="text-[11px] font-mono text-zinc-300 truncate max-w-[130px] block">{address}</span>
        </div>
        <button onClick={disconnect} title="Disconnect" className="text-zinc-600 hover:text-red-400">
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    );

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => connect('preview')}
        disabled={isConnecting}
        className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-mono tracking-widest uppercase py-2.5 px-5 transition-all disabled:opacity-40"
      >
        {isConnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Smartphone className="w-3.5 h-3.5" />}
        Connect Wallet
      </button>
      {walletStatus === 'not-found' &&
        <p className="text-[10px] font-mono text-zinc-600">Install 1AM or Lace wallet extension</p>}
    </div>
  );
}
```

---

## 3) Session Setup (`createConnectedSession`)

Midnight.js 5 ships the connector-backed providers, so the session is mostly wiring:

- `dappConnectorNetwork(api)` → `{ networkId, indexer: { queryURL, subscriptionURL }, nodeURL, nodeWsURL }` from the network the user picked in the wallet
- `dappConnectorProofProvider(api, zkConfigProvider, costModel)` → proving delegated to the wallet (`getProvingProvider`)
- `dappConnectorWalletProviders(api)` → `walletProvider` (`balanceUnsealedTransaction`) + `midnightProvider` (`submitTransaction`), both era-aware
- `providers.config = { networkId, ttlSeconds }` replaces the global `setNetworkId`

```ts
// src/lib/midnight.ts — identical to templates/locker-dapp/lib/midnight.ts
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

With `useWallet`, call `createConnectedSession(api, '/zk/your-contract', ...)` after `connect()`. Pass the zk path, because the session needs to know where your circuit assets are served.

### Hex Helpers (never skip `padStart`)

```ts
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function fromHex(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (normalized.length % 2 !== 0) throw new Error('Invalid hex string from wallet.');
  return Uint8Array.from(normalized.match(/.{2}/g) ?? [], (b) => parseInt(b, 16));
}
```

### Coin Public Key Helpers

The DApp Connector returns `shieldedCoinPublicKey` in **Bech32m** (`mn_shield-cpk_…`), and `dappConnectorWalletProviders` passes it through unchanged as `walletProvider.getCoinPublicKey()`. Parsing it as hex silently yields garbage. Decode it:

```ts
import { MidnightBech32m, ShieldedCoinPublicKey } from '@midnightntwrk/wallet-sdk-address-format';

export function coinPublicKeyToBytes(key: string, networkId: string): Uint8Array {
  if (/^(0x)?[0-9a-fA-F]{64}$/.test(key)) return fromHex(key);          // some wallets return hex
  return new Uint8Array(ShieldedCoinPublicKey.codec.decode(networkId, MidnightBech32m.parse(key)).data);
}

// Compact's Either type — Left = shielded coin key, Right = unshielded/raw key
export function makeEitherLeft(bytes: Uint8Array) {
  return { is_left: true, left: { bytes }, right: { bytes: new Uint8Array(32) } };
}

export function formatAddress(either: any): string {
  if (!either) return '—';
  const bytes = either.is_left ? either.left?.bytes : either.right?.bytes;
  return bytes ? '0x' + toHex(bytes) : '—';
}
```

Argument shapes come from the generated `contract/index.d.ts`: `Bytes<32>` is a plain `Uint8Array`, while `ZswapCoinPublicKey` / `UserAddress` are `{ bytes }`.

---

## 4) Public Data Provider (no patch needed)

Earlier versions of this skill wrapped `indexerPublicDataProvider` to dodge an `offset: null` GraphQL bug on the hosted indexers. **Delete that wrapper.** Indexer 4.4.101 answers no-offset queries with the latest state (verified against Preview), and Midnight.js 5 sends a nullable offset itself. Use `indexerPublicDataProvider(network.indexer)` as in §3.

Reading state changed shape in 5.x. Decode the era-tagged bytes with your own runtime:

```ts
import { ContractState } from '@midnight-ntwrk/compact-runtime';

const read = await session.providers.publicDataProvider.queryContractState(contractAddress);
const state = read ? yourLedger(read.contractState.deserialize({ v9: ContractState }).data) : null;
```

Indexer endpoints: preview is `https://indexer.preview.midnight.network/api/v4/graphql`; preprod/mainnet are Blockfrost (`?project_id=<token>`). In a browser dApp, take the endpoints from the wallet (`dappConnectorNetwork`) rather than hardcoding them.

---

## 5) Private State Provider

`PrivateStateProvider` is per-contract in Midnight.js 5 (`provider.forContract(address).get/set`). The old in-memory object with `setContractAddress()` no longer satisfies the interface. Use `levelPrivateStateProvider`, which uses IndexedDB in the browser:

```ts
levelPrivateStateProvider({
  accountId: unshieldedAddress,                     // scope the store per wallet account
  privateStoragePasswordProvider: async () => password, // ≥16 chars, 3 character classes
});
```

The template uses a random password kept in `localStorage`, which is demo-grade. Production apps should ask the user or derive the password from wallet-held material. Use one database per browser tab.

---

## 6) Deploy & Call Contracts

Replace `YourContract`, `your-contract`, and `yourCircuit` with your actual names. Type the providers to your contract; no `as any` needed.

```ts
import type { ProvableCircuitId } from '@midnight-ntwrk/compact-js';
import { deployContract, findDeployedContract } from '@midnightntwrk/midnight-js-contracts';
import type { MidnightProviders } from '@midnightntwrk/midnight-js-types';
import { CompiledYourContract, type YourContract, type YourPrivateState } from '../contract/src/index';

const PRIVATE_STATE_ID = 'yourPrivateState';
type YourProviders = MidnightProviders<ProvableCircuitId<YourContract>, typeof PRIVATE_STATE_ID, YourPrivateState>;
const providersFor = (s: ConnectedSession) => s.providers as unknown as YourProviders;

export async function deploy(session: ConnectedSession, initialPrivateState: YourPrivateState) {
  const deployed = await deployContract(providersFor(session), {
    compiledContract: CompiledYourContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState,
    // args: [...] for constructor parameters
  });
  return deployed.deployTxData.public.contractAddress;
}

export async function callYourCircuit(session: ConnectedSession, contractAddress: string, ...args: any[]) {
  const contract = await findDeployedContract(providersFor(session), {
    compiledContract: CompiledYourContract,
    contractAddress,
    privateStateId: PRIVATE_STATE_ID,
  });
  return contract.callTx.yourCircuit(...args);
}
```

`CompiledYourContract` is built in `contract/src/index.ts` with `CompiledContract` from **`@midnight-ntwrk/compact-js`**. Keep `node:path` out of the browser bundle (see `references/midnight-session.md`).

`deployContract` / `callTx` wait for the transaction to be indexed and store private state for you. If you need the address immediately and want to show progress while the indexer catches up, use the non-blocking path in §8.

---

## 7) Transaction Flow

```
dApp builds unproven tx (Midnight.js)
        ↓
proofProvider.proveTx()       →  wallet getProvingProvider()   →  ZK proofs
        ↓
walletProvider.balanceTx()    →  api.balanceUnsealedTransaction() →  wallet adds inputs + DUST fees
        ↓
midnightProvider.submitTx()   →  api.submitTransaction()        →  Midnight chain
```

`balanceUnsealedTransaction` (option `payFees`, default `true`) is where fees are paid: from the user's DUST, or by 1AM's sponsorship where 1AM offers it. Never skip it. The connector takes no TTL, so the wallet chooses the expiry of the intents it adds, and `providers.config.ttlSeconds` doesn't apply to them. Wallet errors carry a connector `code` (`Rejected`, `InsufficientFunds` (new in 4.1.0), `Disconnected`, …). `deployContract` / `callTx` wrap them in `ProviderFailedError`, which drops that `code`.

---

## 8) Non-Blocking Deploy + Call (low level)

Use these when you need the contract address before the transaction is indexed, or want to drive your own progress UI. **`submitTxAsync` does not persist private state or the signing key.** You must do that yourself, or later calls won't find them. Type-checked against Midnight.js 5.0.2:

```ts
import { sampleSigningKey } from '@midnight-ntwrk/compact-runtime';
import { createUnprovenDeployTx, submitTxAsync, submitCallTxAsync } from '@midnightntwrk/midnight-js-contracts';

export async function deployNonBlocking(session: ConnectedSession, initialPrivateState: YourPrivateState) {
  const providers = providersFor(session);
  const deployTxData = await createUnprovenDeployTx(providers, {
    compiledContract: CompiledYourContract,
    initialPrivateState,
    signingKey: sampleSigningKey(),            // contract maintenance authority key
  });
  const contractAddress = deployTxData.public.contractAddress;   // known before submission
  const txId = await submitTxAsync(providers, { unprovenTx: deployTxData.private.unprovenTx });

  // submitTxAsync does NOT store these — do it yourself:
  await providers.privateStateProvider.forContract(contractAddress).set(PRIVATE_STATE_ID, initialPrivateState);
  await providers.privateStateProvider.setSigningKey(contractAddress, deployTxData.private.signingKey);

  return { contractAddress, finalized: providers.publicDataProvider.watchForTxData(txId) };
}

export async function callNonBlocking(session: ConnectedSession, contractAddress: string, ...args: any[]) {
  const providers = providersFor(session);
  const { txId } = await submitCallTxAsync(providers, {
    compiledContract: CompiledYourContract,
    contractAddress,
    circuitId: 'yourCircuit',
    args,
    privateStateId: PRIVATE_STATE_ID,
  });
  return providers.publicDataProvider.watchForTxData(txId);   // resolves once indexed
}
```

---

## 9) Waiting for State

Midnight.js 5 has watchers, so hand-rolled polling loops are rarely needed:

```ts
import { ContractState } from '@midnight-ntwrk/compact-runtime';

// Wait for a newly deployed contract to be indexed
await session.providers.publicDataProvider.watchForDeployTxData(contractAddress);

// Wait for a submitted transaction
await session.providers.publicDataProvider.watchForTxData(txId);

// Poll until a predicate on the decoded ledger holds
export async function waitForLedger<T>(
  session: ConnectedSession,
  contractAddress: string,
  readLedger: (data: ReturnType<typeof ContractState.deserialize>['data']) => T,
  done: (ledger: T) => boolean,
  pollIntervalMs = 2000,
  maxAttempts = 60,
): Promise<T> {
  for (let i = 0; i < maxAttempts; i++) {
    const read = await session.providers.publicDataProvider.queryContractState(contractAddress);
    if (read) {
      const ledger = readLedger(read.contractState.deserialize({ v9: ContractState }).data);
      if (done(ledger)) return ledger;
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  throw new Error(`State did not reach the expected value after ${(maxAttempts * pollIntervalMs) / 1000}s`);
}
```

---

## 10) Generic React Hook Pattern

This is a minimal template. Replace `YourState`, `yourLedger`, and circuit names with your contract's actual shape.

```tsx
// hooks/useContract.ts
import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { ContractState } from '@midnight-ntwrk/compact-runtime';
import { callNonBlocking, waitForLedger } from '../lib/midnight';

export function useContract(contractAddress: string | null) {
  const { session } = useWallet();
  const [contractState, setContractState] = useState<YourState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    if (!session || !contractAddress) return;
    const read = await session.providers.publicDataProvider.queryContractState(contractAddress);
    // Midnight.js 5 returns era-tagged bytes. Decode with YOUR compact-runtime copy, then pass
    // .data (a ChargedState) to ledger() — passing the ContractState itself fails with
    // "expected instance of ChargedState".
    if (read) setContractState(yourLedger(read.contractState.deserialize({ v9: ContractState }).data));
  }, [session, contractAddress]);

  useEffect(() => { fetchState(); }, [fetchState]);

  const callSomeCircuit = useCallback(async (...args: any[]) => {
    if (!session || !contractAddress) return;
    setIsLoading(true);
    setError(null);
    try {
      const snapshotBefore = contractState?.someField;

      await callNonBlocking(session, contractAddress, ...args);   // resolves once indexed
      await waitForLedger(session, contractAddress, yourLedger, (l) => l.someField !== snapshotBefore);

      // Optimistic local update (optional — feels instant)
      setContractState(prev => prev ? { ...prev /* apply expected delta */ } : prev);
      await fetchState(); // reconcile with chain
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [session, contractAddress, contractState, fetchState]);

  return { contractState, isLoading, error, callSomeCircuit, refreshState: fetchState };
}
```

Key design points:
- **Snapshot before calling** — capture the field you expect to change before submitting, use it in the polling predicate.
- **Optimistic update** — apply the expected delta to local state immediately after the tx lands, before `fetchState()` returns.
- **Server reconcile** — call `fetchState()` after the optimistic update to sync with the true indexed state.

---

## 11) Optional: Payload Encryption

Encrypt on-chain strings using a key derived from a wallet signature. Requires `api.signData`. In DApp Connector 4.x it takes `{ encoding, keyType: 'unshielded' }` and returns a `Signature` **object** (`{ scheme, data, signature, verifyingKey }`), not a string. Key derivation is only stable if the wallet's signature is **deterministic** for the same message. 4.1.0 wallets may sign with `ecdsa_secp256k1_sha256` or `schnorr_bip340`, so the helper checks determinism before deriving.

```ts
// src/lib/encryption.ts

// Derive a scoped AES-GCM key from the user's wallet signature.
// Key is deterministic: same wallet + same contract = same key across sessions.
export async function deriveContractKey(api: any, networkId: string, contractAddress: string): Promise<CryptoKey> {
  const message = `midnight-app-key|${networkId}|${contractAddress}`;
  const sign = () => api.signData(message, { encoding: 'text', keyType: 'unshielded' });
  const [first, second] = [await sign(), await sign()];
  if (!first?.signature) throw new Error('signData returned no signature — cannot derive encryption key');
  if (first.signature !== second.signature) {
    throw new Error(`Wallet signatures are not deterministic (${first.scheme ?? 'unknown scheme'}); derive the key another way`);
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(first.signature), 'HKDF', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(`midnight-salt|${networkId}`),
      info: new TextEncoder().encode(`midnight-contract|${contractAddress}`),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// Encrypt a string → versioned envelope: "enc:v1:<base64url(iv+ciphertext)>"
export async function encryptPayload(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return 'enc:v1:' + btoa(String.fromCharCode(...combined)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Decrypt a versioned envelope → original string
export async function decryptPayload(key: CryptoKey, envelope: string): Promise<string> {
  if (!envelope.startsWith('enc:v1:')) throw new Error('Not an encrypted payload');
  const b64 = envelope.slice(7).replace(/-/g, '+').replace(/_/g, '/');
  const combined = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plain);
}

export const isEncryptedPayload = (s: string) => s.startsWith('enc:v1:');
```

Design decisions:
- Use `base64url` (replacing `+/=`) to avoid padding issues in URLs and JSON.
- Include both `networkId` and `contractAddress` in KDF salt and info — keys are contract-scoped; the same wallet produces different keys for different contracts and networks.
- Detect encrypted values with `isEncryptedPayload()` before attempting decryption.
- If `signData` is unavailable, throw immediately — do not silently degrade to unencrypted storage.

---

## 12) Next.js Compatibility

The SDK uses `isomorphic-ws`, async WebAssembly, and top-level await — none of which work out of the box in Next.js. Required steps:

**1. Create a WebSocket shim** (Next.js bundles a broken `isomorphic-ws` for browser targets):

```ts
// lib/isomorphic-ws-fix.mjs
export default globalThis.WebSocket;
export const WebSocket = globalThis.WebSocket;
```

**2. Configure `next.config.mjs`:**

```ts
// next.config.mjs
const nextConfig = {
  webpack(config) {
    config.resolve.alias['isomorphic-ws'] = new URL('./lib/isomorphic-ws-fix.mjs', import.meta.url).pathname;
    config.resolve.fallback = { fs: false, net: false, tls: false, child_process: false };
    config.experiments = { asyncWebAssembly: true, topLevelAwait: true };
    return config;
  },
};
export default nextConfig;
```

**3. Webpack, not Turbopack.** Next 15 builds with webpack by default (`next dev`, `next build`). On Next 16, add `--webpack`. The flag doesn't exist in Next 15.5 and makes the command fail there. You cannot use custom webpack experiments and Turbopack together.

**4. Never prerender the wallet UI.** `level` resolves to a native module on the server, so load the client component from a `'use client'` page with `dynamic(() => import('./YourClient'), { ssr: false })`. Otherwise `next build` fails with `No native build was found … classic-level`.

**TypeScript** — no `as any` needed with Midnight.js 5. Type the compiled contract (`CompiledContract.make<Contract<YourPrivateState>>(...)`) and narrow the session's providers to `MidnightProviders<ProvableCircuitId<YourContract>, Id, YourPrivateState>` (see §6). The old casts hid real argument-shape bugs.

---

## 13) ZK Key Hosting

Compiled contracts produce assets that must be served over HTTP with CORS enabled. The `FetchZkConfigProvider` fetches them at runtime.

```
your-server.com/<zk-path>/
  compiler/
    contract-manifest.json  # integrity manifest — REQUIRED by FetchZkConfigProvider (compactc ≥0.33)
    contract-info.json      # declares runtime-version
  keys/
    circuitName.prover      # 2–10 MB each
    circuitName.verifier    # ~2 KB each
  zkir/
    circuitName.bzkir       # ZKIR v3
```

Without `compiler/`, every contract operation fails with `EraMismatchError: artifact-era-undeclared`.

Required header: `Access-Control-Allow-Origin: *`

For local Vite development, sync assets into `public/` with an npm script:

```json
{
  "scripts": {
    "sync:zk": "mkdir -p public/zk/your-contract && cp -r contracts/managed/your-contract/compiler contracts/managed/your-contract/keys contracts/managed/your-contract/zkir public/zk/your-contract/"
  }
}
```

**Before debugging any provider error, open the asset URLs directly in the browser.** A 404 or CORS failure here surfaces as a cryptic SDK error. Run `sync:zk` before `npm run dev` — Vite only serves files present in `public/` at startup.

---

## 14) ProofStation API

The 1AM wallet calls ProofStation internally via `balanceUnsealedTransaction`. You typically don't need to call it directly. Reference only:

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Server health + upstream status |
| `/prove` | POST | Generate ZK proof |
| `/verify` | POST | Verify a ZK proof |
| `/prove-and-balance` | POST | Prove + balance in one call |
| `/balance` | POST | Balance a pre-proven tx |
| `/check` | POST | Check a proof preimage |
| `/wallet-status` | GET | Sponsorship wallet DUST balance |

(Endpoint list as reported by the preview server's own 404 hint on 21 Nov 2026; `/health` responded. 1AM's sponsorship policy after the Ledger 9 DUST reset is not something this skill can verify; check 1AM's docs.)

Base URLs:
- Preview: `https://api-preview.1am.xyz`
- Preprod: `https://api-preprod.1am.xyz`
- Mainnet: `https://api.1am.xyz`

Auth: `X-API-Key: pk_live_xxx` (only needed for direct calls — prefer routing through `api.balanceUnsealedTransaction`).

---

## 15) Networks

| Network | Use for | Indexer | RPC |
|---|---|---|---|
| `preview` | Active development | `indexer.preview.midnight.network/api/v4/graphql` | `rpc.preview.midnight.network` |
| `preprod` | Pre-release testing | Blockfrost `midnight-preprod.blockfrost.io/api/v0?project_id=…` | Blockfrost `rpc.midnight-preprod.blockfrost.io` |
| `mainnet` | Production | Blockfrost `midnight-mainnet.blockfrost.io/api/v0?project_id=…` | Blockfrost `rpc.midnight-mainnet.blockfrost.io` |

The old `indexer.preprod/mainnet.midnight.network` hosts return 410 (retired 9 Oct 2026). **Preview relaunched as a new chain on 7 Nov 2026**: old contract addresses and balances are gone, so redeploy, re-request tNIGHT and re-register DUST. Preprod upgraded in place on 9 Nov 2026 (non-cNIGHT DUST registrations cleared). Use `preview` during development, and always take endpoints from the wallet (`dappConnectorNetwork(api)`); never hardcode them.

---

## 16) Wallet API Reference

### `window.midnight['1am']` (InitialAPI)

| Method | Returns | Notes |
|---|---|---|
| `connect(networkId)` | `ConnectedAPI` | `'preview'` \| `'preprod'` \| `'mainnet'` |
| `name` | `string` | `'1AM'` |
| `apiVersion` | `string` | Connector spec version the wallet implements (`'4.1.0'` for current wallets); check it at runtime |

### ConnectedAPI

| Method | Returns | Notes |
|---|---|---|
| `getConfiguration()` | `{ networkId, indexerUri, indexerWsUri, proverServerUri?, substrateNodeUri }` | Source of truth for URLs; `dappConnectorNetwork(api)` wraps it |
| `getShieldedAddresses()` | `{ shieldedAddress, shieldedCoinPublicKey, shieldedEncryptionPublicKey }` | |
| `getUnshieldedAddress()` | `{ unshieldedAddress }` | |
| `getDustAddress()` | `{ dustAddress }` | |
| `getShieldedBalances()` | `Record<string, bigint>` | |
| `getUnshieldedBalances()` | `Record<string, bigint>` | |
| `getDustBalance()` | `{ balance, cap }` | |
| `getProvingProvider(zkConfigProvider)` | `ProvingProvider` | Pass your `FetchZkConfigProvider` |
| `balanceUnsealedTransaction(hex, { payFees? })` | `{ tx: string }` | Adds inputs + DUST fees — never skip |
| `submitTransaction(hex)` | `void` | Midnight.js reads the tx id from the transaction itself |
| `signData(data, { encoding, keyType: 'unshielded' })` | `{ scheme?, data, signature, verifyingKey }` | 4.1.0 adds ECDSA (`ecdsa_secp256k1_sha256`) alongside `schnorr_bip340` |
| `makeTransfer(outputs, { payFees? })` | `{ tx }` | Token transfer |
| `getTxHistory(page, size)` / `hintUsage(methods)` | | Optional helpers |

Errors carry a `code` from `ErrorCodes`: `InternalError`, `Rejected`, `InvalidRequest`, `PermissionRejected`, `Disconnected`, `InsufficientFunds` (new in 4.1.0).

---

## 17) Common Pitfalls

| Pitfall | Fix |
|---|---|
| Missing `padStart(2, '0')` in `toHex` | Single-digit hex bytes corrupt the transaction. Always use it. |
| Importing `setNetworkId` / `midnight-js-network-id` | Removed in Midnight.js 5. The network id lives in `providers.config`, from `dappConnectorNetwork(api)`. |
| `0x` prefix not stripped in `fromHex` | The wallet may return hex with or without `0x`. The `fromHex` helper above handles both. |
| `deployContract()` feels slow | It waits for indexing. For immediate feedback use the non-blocking path in §8, and remember to store private state + signing key yourself. |
| Hand-rolled `proveTx` / `balanceTx` / `submitTx` objects | Midnight.js 5 providers are era-aware (`supportedEras`). Use `dappConnectorProofProvider` / `dappConnectorWalletProviders`. |
| Coin public key bytes all wrong / zero | The connector returns Bech32m. Use `coinPublicKeyToBytes(key, networkId)` from §3, not a hex parser. |
| `EraMismatchError: artifact-era-undeclared` | Serve `compiler/` with your ZK assets (§13). |
| `ledger()` fails on `queryContractState` result | 5.x returns era-tagged bytes: `yourLedger(read.contractState.deserialize({ v9: ContractState }).data)`. |
| Reading state immediately after deploy | The indexer is not synchronous with chain finality. Always poll — never read state right after submit. |
| ZK assets 404 | Run `sync:zk` (copies `compiler/`, `keys/`, `zkir/`) before `npm run dev`. Vite only serves files that exist in `public/` at startup. |
| Reusing old contract address after recompile | Any contract change, including moving from compiler 0.31 to 0.36.x, regenerates verifier keys. Redeploy. Preview addresses from before 7 Nov 2026 are gone. |
| Circuit too small on preview | Preview ProofStation requires minimum circuit size `k≥6`. If you see `prove: no SRS params for k=6`, add dummy ledger fields to increase circuit size as a workaround. |
| Hardcoding indexer/RPC URLs | Always read URLs from `getConfiguration()`. Users may be on a different network than you expect. |
| Next.js: `isomorphic-ws` / WASM / top-level await errors | See §12 for the required webpack config, WebSocket shim, and Turbopack disable instructions. |
| TypeScript errors on SDK call sites | Type the compiled contract and narrow providers (§6) instead of casting. The errors usually point at real argument-shape bugs. |