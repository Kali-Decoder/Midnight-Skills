---
name: example-payment-dapp
description: >
  Use this skill whenever building, debugging, or extending a privacy-preserving
  payment dApp on the Midnight Network using the 1AM wallet, Compact smart contracts,
  and Next.js. Triggers include: any mention of Midnight Network, Compact contracts,
  tNIGHT tokens, 1AM wallet integration, ZK proving assets, midnight-js SDK, or
  deploying/calling circuits (deposit, withdraw). Also use when the user encounters
  errors like "Invalid character 'm' at position 0", "offset: null" GraphQL errors,
  balanceUnsealedTransaction failures, or WASM/WebSocket issues in Next.js with
  Midnight packages. Use this skill even for partial tasks like wiring a single
  provider, decoding ledger state, or debugging a stuck deploy transaction.
---

# Midnight Network Payment DApp

A privacy-preserving payment vault: users deposit/withdraw tNIGHT through a Compact
smart contract with zero gas fees via the 1AM wallet.

## Workflow

When helping the user, follow this sequence:

1. **Detect where they are**: Contract authoring → Provider setup → Deploy → Circuit calls → Indexer/state polling → UI
2. **Check for known gotchas first** (see `references/gotchas.md`) before writing any provider or circuit code
3. **Use low-level SDK functions** (`createUnprovenDeployTx`, `submitTxAsync`, `submitCallTxAsync`) — never the high-level wrappers (`deployContract`, `createProofProvider`) which are broken on preprod
4. **Always wrap the public data provider** with the patched version to avoid the GraphQL `offset: null` bug

---

## Architecture

```
Browser (Next.js)
├── app/payment/PaymentClient.tsx   ← client component (all UI + logic)
├── lib/midnight.ts                 ← wallet detection, session, providers
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
pragma language_version >= 0.20;
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

### Session Type

```ts
export type ConnectedSession = {
  api: any;
  config: any;
  providers: {
    privateStateProvider: ReturnType<typeof createPrivateStateProvider>;
    publicDataProvider: ReturnType<typeof createPatchedPublicDataProvider>;
    zkConfigProvider: FetchZkConfigProvider<any>;
    proofProvider: { proveTx: (unprovenTx: any) => Promise<any> };
    walletProvider: WalletProvider;
    midnightProvider: MidnightProvider;
  };
  unshieldedAddress: string;
  coinPublicKeyBytes: Uint8Array;   // ← pre-converted, never pass raw pk to circuits
};
```

### createConnectedSession

```ts
export async function createConnectedSession(api: any, zkAssetBasePath: string): Promise<ConnectedSession> {
  const [config, unshieldedAddress, shieldedAddress] = await Promise.all([
    api.getConfiguration(),
    api.getUnshieldedAddress(),
    api.getShieldedAddresses(),
  ]);

  setNetworkId(config.networkId);

  const zkConfigProvider = new FetchZkConfigProvider(
    new URL(zkAssetBasePath, window.location.origin).toString(),
    window.fetch.bind(window),
  );
  const provingProvider = await api.getProvingProvider(zkConfigProvider);

  const proofProvider = {
    async proveTx(unprovenTx: any) {
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
      if (typeof result === 'string' && result) return result;
      if (result?.transactionId) return result.transactionId;
      if (result?.id) return result.id;
      return txHex.slice(0, 64); // fallback pseudo-txId
    },
  };

  return {
    api, config,
    providers: {
      privateStateProvider: createPrivateStateProvider(),
      publicDataProvider: createPatchedPublicDataProvider(config.indexerUri, config.indexerWsUri),
      zkConfigProvider,
      proofProvider,
      walletProvider,
      midnightProvider,
    },
    unshieldedAddress: unshieldedAddress.unshieldedAddress,
    coinPublicKeyBytes: coinPublicKeyToBytes(shieldedAddress.shieldedCoinPublicKey),
  };
}
```

### coinPublicKeyToBytes (required — format varies by wallet version)

```ts
function coinPublicKeyToBytes(pk: unknown): Uint8Array {
  if (pk instanceof Uint8Array) return pk.length === 32 ? pk : pk.slice(0, 32);
  if (typeof pk === 'string') {
    const hex = pk.startsWith('0x') ? pk.slice(2) : pk;
    if (hex.length === 64 && /^[0-9a-fA-F]+$/.test(hex)) return fromHex(hex);
    console.warn('coinPublicKey not hex, using fallback');
    return new Uint8Array(32);
  }
  if (Array.isArray(pk)) return new Uint8Array(pk.length >= 32 ? pk.slice(0, 32) : [...pk, ...new Uint8Array(32 - pk.length)]);
  if (pk && typeof pk === 'object' && 'bytes' in (pk as any)) return coinPublicKeyToBytes((pk as any).bytes);
  return new Uint8Array(32);
}
```

### Patched Public Data Provider

```ts
function createPatchedPublicDataProvider(queryUrl: string, subscriptionUrl: string) {
  const base = indexerPublicDataProvider(queryUrl, subscriptionUrl);
  return {
    ...base,
    async queryContractState(contractAddress: string, config?: any) {
      if (config) return base.queryContractState(contractAddress, config);
      const res = await fetch(queryUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: `query LATEST_CONTRACT_STATE($address: HexEncoded!) {
            contractAction(address: $address) { state }
          }`,
          variables: { address: contractAddress },
        }),
      });
      if (!res.ok) throw new Error(`Indexer HTTP error: ${res.status}`);
      const payload = await res.json();
      if (payload.errors?.length) throw new Error(payload.errors.map((e: any) => e.message).join('; '));
      const action = payload.data?.contractAction ?? null;
      return action ? ContractState.deserialize(fromHex(action.state)) : null;
    },
  };
}
```

### Private State Provider (In-Memory)

```ts
function createPrivateStateProvider() {
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

## Deploy & Circuit Calls

### Deploy (use low-level API — high-level hangs on preprod)

```ts
export async function deployPayment(session: ConnectedSession, ownerKey: Uint8Array): Promise<string> {
  const compiledContract = makeCompiledContract();
  const initialPrivateState = { ownerSecretKey: ownerKey };

  const deployTxData = await (createUnprovenDeployTx as any)(
    { zkConfigProvider: session.providers.zkConfigProvider, walletProvider: session.providers.walletProvider },
    { compiledContract, args: [], privateStateId: PRIVATE_STATE_ID, initialPrivateState, signingKey: sampleSigningKey() },
  );

  const contractAddress = deployTxData.public.contractAddress;
  await (submitTxAsync as any)(session.providers, { unprovenTx: deployTxData.private.unprovenTx });

  await session.providers.privateStateProvider.setContractAddress(contractAddress);
  await session.providers.privateStateProvider.set(PRIVATE_STATE_ID, initialPrivateState);
  await session.providers.privateStateProvider.setSigningKey(contractAddress, deployTxData.private.signingKey);

  return contractAddress;
}
```

### Deposit / Withdraw

```ts
export async function depositPayment(session: ConnectedSession, contractAddress: string, amount: bigint) {
  await (submitCallTxAsync as any)(session.providers, {
    compiledContract: makeCompiledContract(),
    contractAddress,
    circuitId: 'deposit',
    args: [amount],
    privateStateId: PRIVATE_STATE_ID,
  });
}

export async function withdrawPayment(session: ConnectedSession, contractAddress: string, amount: bigint, recipientBytes: Uint8Array) {
  await (submitCallTxAsync as any)(session.providers, {
    compiledContract: makeCompiledContract(),
    contractAddress,
    circuitId: 'withdraw',
    args: [amount, { bytes: recipientBytes }],
    privateStateId: PRIVATE_STATE_ID,
  });
}
```

### Compiled Contract Builder

```ts
function makeCompiledContract() {
  const witnesses = {
    ownerKey: (context: any) => [context.privateState, context.privateState.ownerSecretKey],
  };
  return CompiledContract.make('payment', Payment.Contract).pipe(
    CompiledContract.withWitnesses(witnesses),
    CompiledContract.withCompiledFileAssets(ZK_ASSET_PATH),
  ) as any;
}
```

---

## Indexer & State Polling

```ts
export async function pollForState(
  queryUrl: string,
  contractAddress: string,
  onProgress?: (attempt: number) => void,
  maxAttempts = 120,
  intervalMs = 2000,
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    onProgress?.(i + 1);
    const state = await fetchContractState(queryUrl, contractAddress);
    if (state) return state;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`State not found after ${maxAttempts * intervalMs / 1000}s`);
}

export function decodePaymentState(stateHex: string) {
  const contractState = ContractState.deserialize(fromHex(stateHex));
  const ledger = Payment.ledger(contractState.data); // ← pass .data, not contractState itself
  return {
    balance: ledger.balance as unknown as bigint,
    totalDeposited: ledger.totalDeposited as unknown as bigint,
    totalWithdrawn: ledger.totalWithdrawn as unknown as bigint,
  };
}
```

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

### package.json scripts — must use `--webpack`

```json
{ "dev": "next dev --webpack", "build": "next build --webpack" }
```

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
| `Invalid character 'm' at position 0` | `encodeUserAddress()` got raw coin pk | Never use `encodeUserAddress`. Use `coinPublicKeyToBytes()` → pass `{ bytes: ... }` to circuits |
| Deploy hangs 30–120s silently | `deployContract()` calls `watchForTxData` | Use `createUnprovenDeployTx` + `submitTxAsync` |
| Proof fails | `createProofProvider()` missing CostModel | Call `unprovenTx.prove(provingProvider, CostModel.initialCostModel())` directly |
| GraphQL `offset: null` error | Default `queryContractState` sends null offset | Use the patched public data provider (custom GraphQL query, omit offset) |
| `Cannot read properties of null` on balance | `balanceUnsealedTransaction()` returned null | Guard: `if (!balanced?.tx) throw new Error(...)` |
| Tx ID not found after submit | `submitTransaction()` returns object not string | Normalize: string → `.transactionId` → `.id` → hex prefix fallback |
| `ledger()` fails with wrong type | Passing `contractState` instead of `.data` | Always pass `contractState.data` (ChargedState) to `Payment.ledger()` |
| ZK asset 404 → cryptic SDK error | Assets not synced to public/ | Run `npm run sync:assets` before dev; verify URLs directly in browser |
| WASM / top-level-await errors | Missing webpack config or Turbopack | Add `asyncWebAssembly: true`, `topLevelAwait: true`; use `--webpack` flag |
| Wrong wallet detected | Both Lace and 1AM present | Check `window.midnight['1am']` first; fall back to `window.midnight?.mnLace` |

---

## ZK Asset Hosting

Run `npm run sync:assets` to copy `contract/src/managed/payment/{keys,zkir}/` → `public/zk/payment/`.

**Before debugging any provider/SDK error**, open the asset URLs directly:
`http://localhost:3000/zk/payment/keys/deposit.prover` — a 404 here surfaces as a cryptic SDK error.

The `FetchZkConfigProvider` fetches from `/zk/payment/` at runtime. Next.js serves `public/` by default — no extra config needed.