---
name: 1am-wallet
description: Integrate the 1AM wallet for dust-free contract deployment and transaction flow on Midnight Network. Use this skill whenever a user is building a Midnight Network dApp, connecting to the 1AM browser extension, deploying or calling a Compact contract, handling ZK proving, setting up providers, or asking about dust-free transaction flow. Also use it for indexer patching, private state providers, payload encryption, or any question involving window.midnight['1am'].
---

**Scope**
This skill covers detecting, connecting, and wiring the 1AM browser extension (`window.midnight['1am']`) into a frontend dApp. The 1AM wallet handles all ZK proving and dust fee sponsorship — users pay zero gas. This skill is generic: replace every `YourContract` / `yourCircuit` / `your-contract` placeholder with your actual contract name and circuit IDs.

Suggested file layout (adapt to your project):
- `src/lib/midnight.ts` → wallet session, provider wiring, indexer patch
- `src/lib/encryption.ts` → optional payload encryption derived from wallet signature
- `src/hooks/useContract.ts` → app logic and state orchestration
- `src/contexts/WalletContext.tsx` → wallet connection state

---

## 1) Dependencies

Exact versions known to work together:

```bash
npm install \
  @midnight-ntwrk/compact-runtime@^0.15.0 \
  @midnight-ntwrk/ledger@^4.0.0 \
  @midnight-ntwrk/ledger-v8@^8.0.3 \
  @midnight-ntwrk/midnight-js-contracts@^4.0.4 \
  @midnight-ntwrk/midnight-js-fetch-zk-config-provider@^4.0.4 \
  @midnight-ntwrk/midnight-js-indexer-public-data-provider@^4.0.4 \
  @midnight-ntwrk/midnight-js-network-id@^4.0.4 \
  @midnight-ntwrk/midnight-js-types@^4.0.4 \
  @midnight-ntwrk/wallet-sdk-address-format@^3.1.0
```

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
const api = await wallet.connect('preprod'); // 'preview' | 'preprod' | 'mainnet'
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

  const connect = useCallback(async (network = 'preprod') => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    setIsConnecting(true);
    try {
      const wallet = (window as any).midnight?.['1am'] ?? (window as any).midnight?.mnLace;
      if (!wallet) throw new Error('No wallet found');
      const api = await wallet.connect(network);
      const { createConnectedSession } = await import('../lib/midnight');
      const sess = await createConnectedSession(api);
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
        onClick={() => connect('preprod')}
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

Fetch config, network ID, and all addresses in **parallel** — never await them in sequence.

```ts
// src/lib/midnight.ts
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import type { MidnightProvider, WalletProvider } from '@midnight-ntwrk/midnight-js-types';

export type ConnectedSession = {
  api: any;
  config: any;
  providers: {
    privateStateProvider: ReturnType<typeof createPrivateStateProvider>;
    publicDataProvider: ReturnType<typeof createPatchedPublicDataProvider>;
    zkConfigProvider: FetchZkConfigProvider;
    proofProvider: { proveTx: (unprovenTx: any, _config: any) => Promise<any> };
    walletProvider: WalletProvider;
    midnightProvider: MidnightProvider;
  };
  unshieldedAddress: string;
};

export async function createConnectedSession(api: any): Promise<ConnectedSession> {
  // Fetch in parallel — do not await sequentially
  const [config, unshieldedAddress, shieldedAddress] = await Promise.all([
    api.getConfiguration(),
    api.getUnshieldedAddress(),
    api.getShieldedAddresses(),
  ]);

  // Must be called before any SDK operations
  setNetworkId(config.networkId);

  // ZK assets are served from /contract/collection relative to your origin.
  // Adjust the path to match where your compiled contract assets are hosted.
  const zkConfigProvider = new FetchZkConfigProvider(
    new URL('/contract/your-contract', window.location.origin).toString(),
    window.fetch.bind(window),
  );

  // Optional: smoke-test ZK asset reachability at startup
  zkConfigProvider.getZKIR('yourCircuit').then(
    (zkir) => console.log('[zkConfigProvider] getZKIR ok, length:', zkir?.length),
    (err) => console.error('[zkConfigProvider] getZKIR failed — check ZK asset hosting:', err),
  );

  const provingProvider = await api.getProvingProvider(zkConfigProvider);

  // ✅ Use this custom wrapper — do NOT use createProofProvider() from @midnight-ntwrk/midnight-js-types.
  // createProofProvider wraps the provider differently and does not pass CostModel correctly.
  // unprovenTx.prove() called directly is the only pattern confirmed to work with 1AM's provingProvider.
  const proofProvider = {
    async proveTx(unprovenTx: any, _config: any) {
      const { CostModel } = await import('@midnight-ntwrk/ledger-v8');
      return unprovenTx.prove(provingProvider, CostModel.initialCostModel());
    },
  };

  const walletProvider: WalletProvider = {
    getCoinPublicKey: () => shieldedAddress.shieldedCoinPublicKey,
    getEncryptionPublicKey: () => shieldedAddress.shieldedEncryptionPublicKey,
    balanceTx: async (tx: any) => {
      const txHex = toHex(tx.serialize());
      const balanced = await api.balanceUnsealedTransaction(txHex);
      if (!balanced?.tx) throw new Error('balanceUnsealedTransaction returned invalid result');
      const { Transaction } = await import('@midnight-ntwrk/ledger-v8');
      return Transaction.deserialize('signature', 'proof', 'binding', fromHex(balanced.tx));
    },
  };

  const midnightProvider: MidnightProvider = {
    submitTx: async (tx: any) => {
      const txHex = toHex(tx.serialize());
      const result = await api.submitTransaction(txHex);
      // Accept string txId, or object with transactionId/id, or fall back to hex prefix
      if (typeof result === 'string' && result) return result;
      if (result?.transactionId) return result.transactionId;
      if (result?.id) return result.id;
      return txHex.slice(0, 64); // fallback pseudo-txId
    },
  };

  const publicDataProvider = createPatchedPublicDataProvider(config.indexerUri, config.indexerWsUri);

  return {
    api,
    config,
    providers: {
      privateStateProvider: createPrivateStateProvider(),
      publicDataProvider,
      zkConfigProvider,
      proofProvider,
      walletProvider,
      midnightProvider,
    },
    unshieldedAddress: unshieldedAddress.unshieldedAddress,
  };
}
```

### Hex Helpers (required — never skip `padStart`)

```ts
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function fromHex(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (normalized.length % 2 !== 0) throw new Error('Invalid hex string from wallet.');
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}
```

### Coin Public Key Helpers

Use these when your contract takes a wallet address as an argument (e.g. recipient fields):

```ts
export function coinPublicKeyToBytes(walletProvider: WalletProvider): Uint8Array {
  const pk = walletProvider?.getCoinPublicKey?.() ?? '';
  const hex = typeof pk === 'string' ? pk : Array.from(pk as number[]).map((b) => b.toString(16).padStart(2, '0')).join('');
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

// Compact's Either type — Left = shielded coin key, Right = unshielded/raw key
export function makeEitherLeft(bytes: Uint8Array) {
  return { is_left: true, left: { bytes }, right: { bytes: new Uint8Array(32) } };
}

// Format an Either<Bytes, Bytes> address for display
export function formatAddress(either: any): string {
  if (!either) return '—';
  const bytes = either.is_left ? either.left?.bytes : either.right?.bytes;
  if (!bytes) return '—';
  return '0x' + Array.from(bytes as number[]).map((b) => b.toString(16).padStart(2, '0')).join('');
}
```

---

## 4) Patched Public Data Provider ⚠️ Critical

The preview and preprod indexers have a GraphQL bug with `offset: null` in latest-state queries. The default SDK `queryContractState()` without a config block hits this bug. **Always wrap `indexerPublicDataProvider` with this patch — without it, state reads will fail on these networks.**

```ts
import { ContractState } from '@midnight-ntwrk/compact-runtime';
import { LedgerParameters, ZswapChainState } from '@midnight-ntwrk/ledger-v8';

export function createPatchedPublicDataProvider(queryUrl: string, subscriptionUrl: string) {
  const base = indexerPublicDataProvider(queryUrl, subscriptionUrl);

  async function queryLatest(query: string, address: string) {
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables: { address } }),
    });
    if (!res.ok) throw new Error(`Indexer HTTP error: ${res.status}`);
    const payload = await res.json();
    if (payload.errors?.length) throw new Error(payload.errors.map((e: any) => e.message).join('; '));
    return payload.data?.contractAction ?? null;
  }

  return {
    ...base,
    async queryContractState(contractAddress: string, config?: any) {
      if (config) return base.queryContractState(contractAddress, config);

      const action = await queryLatest(`
        query LATEST_CONTRACT_STATE($address: HexEncoded!) {
          contractAction(address: $address) { state }
        }`, contractAddress);
      return action ? ContractState.deserialize(fromHex(action.state)) : null;
    },
    async queryZSwapAndContractState(contractAddress: string, config?: any) {
      if (config) return base.queryZSwapAndContractState(contractAddress, config);

      const action = await queryLatest(`
        query LATEST_BOTH_STATE($address: HexEncoded!) {
          contractAction(address: $address) {
            state
            zswapState
            transaction { block { ledgerParameters } }
          }
        }`, contractAddress);

      if (!action?.zswapState) return null;
      return [
        ZswapChainState.deserialize(fromHex(action.zswapState)),
        ContractState.deserialize(fromHex(action.state)),
        action.transaction?.block?.ledgerParameters
          ? LedgerParameters.deserialize(fromHex(action.transaction.block.ledgerParameters))
          : LedgerParameters.initialParameters(),
      ];
    },
  };
}
```

---

## 5) Private State Provider (In-Memory)

Sufficient for most dApps. Private state does not persist across page reloads — this is intentional for a minimal reference implementation. For production persistence, replace with `localStorage` or an encrypted server store.

```ts
export function createPrivateStateProvider() {
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
    async exportPrivateStates(): Promise<never> { throw new Error('Not implemented.'); },
    async importPrivateStates(): Promise<never> { throw new Error('Not implemented.'); },
    async exportSigningKeys(): Promise<never> { throw new Error('Not implemented.'); },
    async importSigningKeys(): Promise<never> { throw new Error('Not implemented.'); },
  };
}
```

---

## 6) Deploy & Call Contracts

Replace `YourContract`, `your-contract`, and `yourCircuit` with your actual names.

```ts
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { deployContract, submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { Contract } from './your-compiled-contract'; // generated by `compact` compiler

// Build the compiled contract handle (do this once, cache it)
function getCompiledContract() {
  return CompiledContract.make('YourContract', Contract).pipe(
    CompiledContract.withVacantWitnesses,
    CompiledContract.withCompiledFileAssets('./contract/your-contract'),
  ) as any; // TypeScript: compiled contract generics are too narrow; cast is safe at runtime
}

// Call any circuit by name
async function callCircuit(
  session: ConnectedSession,
  contractAddress: string,
  circuitId: string,
  args: any[],
) {
  const compiledContract = getCompiledContract();
  const result = await submitCallTx(session.providers as any, {
    compiledContract,
    contractAddress,
    circuitId,
    args,
  });
  console.log('Tx hash:', result.public.txHash);
  return result;
}
```

> ⚠️ **Do not use `deployContract()` for deploy on preprod/preview.** `deployContract` calls `watchForTxData` internally, which polls the indexer until the transaction is indexed — on preprod this can take 30–120s with no feedback, and will hang indefinitely if the indexer lags. **Use the low-level `createUnprovenDeployTx` + `submitTxAsync` pattern in §8 instead.** The contract address is available from `deployTxData.public.contractAddress` immediately, before any submission. `submitTxAsync` skips the blocking `watchForTxData` call entirely.

---

## 7) Transaction Flow (Dust-Free)

```
dApp builds unproven tx
        ↓
proofProvider.proveTx()  →  1AM / ProofStation  →  ZK proof  (~2–5s)
        ↓
walletProvider.balanceTx()  →  api.balanceUnsealedTransaction()  →  server adds dust fees
        ↓
midnightProvider.submitTx()  →  api.submitTransaction()  →  Midnight chain

Total user cost: 0 NIGHT, 0 dust.
```

`balanceUnsealedTransaction` is where ProofStation's server wallet pays fees on behalf of the user. **Never skip it.**

---

## 8) Low-Level Deploy + Call (with Indexer Polling)

Use these when you need finer control than `deployContract` / `submitCallTx` — e.g. saving private state, waiting for indexer confirmation, or updating UI after the transaction lands.

### Deploy with Private State Persistence

```ts
import { createUnprovenDeployTx, submitTxAsync } from '@midnight-ntwrk/midnight-js-contracts';
import { sampleSigningKey } from '@midnight-ntwrk/compact-runtime';

async function deployAndPersist(
  session: ConnectedSession,
  constructorArgs: any[],
  onDeployed?: (address: string) => Promise<void>,
): Promise<string> {
  const compiledContract = getCompiledContract();

  const deployTxData = await createUnprovenDeployTx(
    { zkConfigProvider: session.providers.zkConfigProvider, walletProvider: session.providers.walletProvider },
    { compiledContract, args: constructorArgs, signingKey: sampleSigningKey() },
  );

  const contractAddress = deployTxData.public.contractAddress;

  await submitTxAsync(session.providers, { unprovenTx: deployTxData.private.unprovenTx });

  // Persist private state so subsequent circuit calls can find it
  await session.providers.privateStateProvider.setContractAddress(contractAddress);
  await session.providers.privateStateProvider.setSigningKey(contractAddress, deployTxData.private.signingKey);

  // Optional: persist to your backend
  await onDeployed?.(contractAddress);

  await waitForContractDeployment(session.providers.publicDataProvider, contractAddress);
  return contractAddress;
}
```

### Call a Circuit with State Change Polling

```ts
import { createUnprovenCallTx } from '@midnight-ntwrk/midnight-js-contracts';

async function callAndWait(
  session: ConnectedSession,
  contractAddress: string,
  circuitId: string,
  args: any[],
  // Provide a predicate that returns true when the indexed state has advanced past the pre-call snapshot
  hasStateAdvanced: (publicDataProvider: any) => Promise<boolean>,
): Promise<string> {
  const compiledContract = getCompiledContract();

  const callTxData = await createUnprovenCallTx(session.providers, {
    compiledContract,
    contractAddress,
    circuitId,
    args,
  });

  const txId = await submitTxAsync(session.providers, {
    unprovenTx: callTxData.private.unprovenTx,
    circuitId,
  });

  await waitForStateAdvance(session.providers.publicDataProvider, hasStateAdvanced);
  return txId;
}
```

---

## 9) Polling Helpers

```ts
// Wait until a newly deployed contract appears in the indexer
export async function waitForContractDeployment(
  publicDataProvider: ReturnType<typeof createPatchedPublicDataProvider>,
  contractAddress: string,
  pollIntervalMs = 2000,
  maxAttempts = 30,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const state = await publicDataProvider.queryContractState(contractAddress);
    if (state?.data) return;
    await new Promise(r => setTimeout(r, pollIntervalMs));
  }
  throw new Error(`Contract not indexed after ${maxAttempts * pollIntervalMs}ms — check address or indexer lag`);
}

// Wait until a caller-supplied predicate signals that state has advanced
// The predicate receives publicDataProvider so it can query whatever ledger field is relevant
export async function waitForStateAdvance(
  publicDataProvider: ReturnType<typeof createPatchedPublicDataProvider>,
  hasAdvanced: (provider: typeof publicDataProvider) => Promise<boolean>,
  pollIntervalMs = 2000,
  maxAttempts = 30,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await hasAdvanced(publicDataProvider)) return;
    await new Promise(r => setTimeout(r, pollIntervalMs));
  }
  throw new Error(`State did not advance after ${maxAttempts * pollIntervalMs}ms`);
}
```

**Usage example** — pass a predicate that captures a pre-call snapshot:

```ts
const stateBefore = await getRelevantLedgerValue(session, contractAddress);

await callAndWait(session, contractAddress, 'increment', [arg1], async (provider) => {
  const contractState = await provider.queryContractState(contractAddress);
  if (!contractState?.data) return false;
  // Always pass contractState.data (ChargedState) to your ledger() function, not contractState itself
  const current = yourLedgerReader(contractState.data).someField;
  return current !== stateBefore;
});
```

---

## 10) Generic React Hook Pattern

This is a minimal template. Replace `YourState`, `yourLedger`, and circuit names with your contract's actual shape.

```tsx
// hooks/useContract.ts
import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { waitForContractDeployment, waitForStateAdvance } from '../lib/midnight';

export function useContract(contractAddress: string | null) {
  const { session } = useWallet();
  const [contractState, setContractState] = useState<YourState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    if (!session || !contractAddress) return;
    const contractState = await session.providers.publicDataProvider.queryContractState(contractAddress);
    // ⚠️ Pass contractState.data (a ChargedState), NOT the ContractState itself.
    // The compiled contract's ledger() function expects a ChargedState and accesses .state on it.
    // Passing a raw ContractState (from ContractState.deserialize) will fail with
    // "expected instance of ChargedState" because ContractState has no .state property.
    if (contractState?.data) setContractState(yourLedger(contractState.data));
  }, [session, contractAddress]);

  useEffect(() => { fetchState(); }, [fetchState]);

  const callSomeCircuit = useCallback(async (...args: any[]) => {
    if (!session || !contractAddress) return;
    setIsLoading(true);
    setError(null);
    try {
      const snapshotBefore = contractState?.someField;

      const callTxData = await createUnprovenCallTx(session.providers, {
        compiledContract: getCompiledContract(),
        contractAddress,
        circuitId: 'someCircuit',
        args,
      });
      await submitTxAsync(session.providers, { unprovenTx: callTxData.private.unprovenTx, circuitId: 'someCircuit' });

      await waitForStateAdvance(session.providers.publicDataProvider, async (provider) => {
        const s = await provider.queryContractState(contractAddress);
        return s?.data ? yourLedger(s.data).someField !== snapshotBefore : false;
      });

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

Encrypt on-chain strings using a key derived deterministically from a wallet signature. Requires `api.signData`.

```ts
// src/lib/encryption.ts

// Derive a scoped AES-GCM key from the user's wallet signature.
// Key is deterministic: same wallet + same contract = same key across sessions.
export async function deriveContractKey(api: any, networkId: string, contractAddress: string): Promise<CryptoKey> {
  const message = `midnight-app-key|${networkId}|${contractAddress}`;
  const signature = await api.signData(message, { encoding: 'text' });
  if (!signature) throw new Error('signData returned empty — cannot derive encryption key');

  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(signature), 'HKDF', false, ['deriveKey'],
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

**3. Disable Turbopack** — Next.js 15+ enables Turbopack by default. Custom webpack config requires webpack mode:

```json
// package.json
{
  "scripts": {
    "dev": "next dev --webpack"
  }
}
```

Or if using Next.js config-based Turbopack opt-in, explicitly set `turbopack: {}` only when not using custom webpack experiments. **You cannot use both simultaneously.**

**TypeScript casts** — SDK generics don't compose cleanly with compiled contract output. Use `as any` on `createUnprovenDeployTx`, `submitTxAsync`, and `submitCallTx` call sites. The types are correct at runtime; the static generics are too narrow for the compiler-generated contract shape. `FetchZkConfigProvider<any>` is the correct annotation.

---

## 13) ZK Key Hosting

Compiled contracts produce assets that must be served over HTTP with CORS enabled. The `FetchZkConfigProvider` fetches them at runtime.

```
your-server.com/<zk-path>/
  keys/
    circuitName.prover      # 2–10 MB each
    circuitName.verifier    # ~2 KB each
  zkir/
    circuitName.bzkir       # 1–3 KB each
```

Required header: `Access-Control-Allow-Origin: *`

For local Vite development, sync assets into `public/` with an npm script:

```json
{
  "scripts": {
    "sync:zk": "mkdir -p public/contract/your-contract && cp -r contracts/managed/your-contract/keys public/contract/your-contract/ && cp -r contracts/managed/your-contract/zkir public/contract/your-contract/"
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
| `/balance-only` | POST | Balance a pre-proven tx |
| `/wallet-status` | GET | Sponsorship wallet dust balance |

Base URLs:
- Preview: `https://api-preview.1am.xyz`
- Preprod: `https://api-preprod.1am.xyz`
- Mainnet: `https://api.1am.xyz`

Auth: `X-API-Key: pk_live_xxx` (only needed for direct calls — prefer routing through `api.balanceUnsealedTransaction`).

---

## 15) Networks

| Network | Use for | Indexer | RPC |
|---|---|---|---|
| `preview` | Active development | `indexer.preview.midnight.network` | `rpc.preview.midnight.network` |
| `preprod` | Pre-release testing | `indexer.preprod.midnight.network` | `rpc.preprod.midnight.network` |
| `mainnet` | Production | `indexer.mainnet.midnight.network` | `rpc.mainnet.midnight.network` |

Use `preview` during development. `getConfiguration()` returns the correct URLs for whichever network the user has selected in the wallet — always use those values dynamically; never hardcode them.

---

## 16) Wallet API Reference

### `window.midnight['1am']` (InitialAPI)

| Method | Returns | Notes |
|---|---|---|
| `connect(networkId)` | `ConnectedAPI` | `'preview'` \| `'preprod'` \| `'mainnet'` |
| `name` | `string` | `'1AM'` |
| `apiVersion` | `string` | `'4.0.0'` |

### ConnectedAPI

| Method | Returns | Notes |
|---|---|---|
| `getConfiguration()` | `{ networkId, indexerUri, indexerWsUri, proverServerUri, substrateNodeUri }` | Source of truth for all URLs — always use dynamically |
| `getShieldedAddresses()` | `{ shieldedAddress, shieldedCoinPublicKey, shieldedEncryptionPublicKey }` | |
| `getUnshieldedAddress()` | `{ unshieldedAddress }` | |
| `getDustAddress()` | `{ dustAddress }` | |
| `getShieldedBalances()` | `Record<string, bigint>` | |
| `getUnshieldedBalances()` | `Record<string, bigint>` | |
| `getDustBalance()` | `{ balance, cap }` | |
| `getProvingProvider(zkConfigProvider)` | `ProvingProvider` | Pass your `FetchZkConfigProvider` |
| `balanceUnsealedTransaction(hex)` | `{ tx: string }` | Adds dust fees — never skip |
| `submitTransaction(hex)` | `string \| void` | Returns txId or void |
| `signData(data, options)` | `string` | Signature for key derivation |
| `makeTransfer(outputs)` | `{ tx }` | Token transfer |

---

## 17) Common Pitfalls

| Pitfall | Fix |
|---|---|
| Missing `padStart(2, '0')` in `toHex` | Single-digit hex bytes corrupt the transaction. Always use it. |
| `setNetworkId()` not called first | Call it immediately after `getConfiguration()`. Missing it causes silent type mismatches throughout the SDK. |
| `0x` prefix not stripped in `fromHex` | The wallet may return hex with or without `0x`. The `fromHex` helper above handles both. |
| Using `deployContract()` on preprod/preview | It calls `watchForTxData` and blocks for 30–120s with no feedback. Use `createUnprovenDeployTx` + `submitTxAsync` instead (§8). |
| Using `createProofProvider()` from `@midnight-ntwrk/midnight-js-types` | Does not pass `CostModel` correctly. Use the custom `proveTx` wrapper in §3 — call `unprovenTx.prove(provingProvider, CostModel.initialCostModel())` directly. |
| `api.submitTransaction()` returning non-string | Normalize the return: check for string, then `.transactionId`, then `.id`, then fall back to `txHex.slice(0, 64)`. Already done in the `midnightProvider` in §3. |
| `balanceUnsealedTransaction` returning null | Guard with `if (!balanced?.tx) throw new Error(...)` before calling `fromHex`. Already done in `walletProvider.balanceTx` in §3. |
| Passing `ContractState` to `ledger()` instead of `ChargedState` | `queryContractState()` returns a `ContractState`. Its `.data` property is the `ChargedState` that `ledger()` expects. Always call `yourLedger(contractState.data)`, never `yourLedger(contractState)`. |
| Reading state immediately after deploy | The indexer is not synchronous with chain finality. Always poll — never read state right after submit. |
| ZK assets 404 | Run `sync:zk` before `npm run dev`. Vite only serves files that exist in `public/` at startup. |
| Reusing old contract address after recompile | Any contract change regenerates the verifier key. Old addresses will fail proof verification. Always redeploy. |
| Circuit too small on preview | Preview ProofStation requires minimum circuit size `k≥6`. If you see `prove: no SRS params for k=6`, add dummy ledger fields to increase circuit size as a workaround. |
| Hardcoding indexer/RPC URLs | Always read URLs from `getConfiguration()`. Users may be on a different network than you expect. |
| Next.js: `isomorphic-ws` / WASM / top-level await errors | See §12 for the required webpack config, WebSocket shim, and Turbopack disable instructions. |
| TypeScript errors on SDK call sites | Use `as any` casts on `createUnprovenDeployTx`, `submitTxAsync`, `submitCallTx`, and `FetchZkConfigProvider<any>`. Types are correct at runtime; the generics are too narrow for compiler-generated contract output. |