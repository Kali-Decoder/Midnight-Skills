---
name: 1am-wallet
description: Integrate the 1AM wallet for dust-free contract deployment and transaction flow on Midnight Network. Use this skill whenever a user is building a Midnight Network dApp, connecting to the 1AM browser extension, deploying or calling a Compact contract, handling ZK proving, setting up providers, or asking about dust-free transaction flow. Also use it for indexer patching, private state providers, payload encryption, or any question involving window.midnight['1am'].
---

**Scope**
This skill covers detecting, connecting, and wiring the 1AM browser extension (`window.midnight['1am']`) into a frontend dApp. The 1AM wallet handles all ZK proving and dust fee sponsorship — users pay zero gas. Grounded in the working reference implementation at `webisoftSoftware/1AM-starter-template`.

Place files exactly as shown:
- `src/midnight.ts` → wallet session, provider wiring, indexer patch
- `src/confidentialTodo.ts` → optional payload encryption (derived from wallet signature)
- `src/features/tasks/hooks/useTaskBoard.ts` → app logic and state orchestration
- `src/features/tasks/domain/*` → task serialization/parsing
- `src/features/tasks/data/*` → storage helpers

## 1) Dependencies

Exact versions from the reference implementation:

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

Vite requires these plugins for WASM and top-level await (Compact SDK uses both):

```bash
npm install -D vite-plugin-wasm vite-plugin-top-level-await
```

## 2) Wallet Detection & Connection

The extension injects asynchronously — always poll, never assume it's immediately available.

```ts
function detectWallet(): Promise<OneAmInitialApi | null> {
  return new Promise((resolve) => {
    const wallet = (window as any).midnight?.['1am'];
    if (wallet) { resolve(wallet); return; }

    let attempts = 0;
    const interval = setInterval(() => {
      const w = (window as any).midnight?.['1am'];
      if (w) { clearInterval(interval); resolve(w); }
      else if (++attempts > 50) { clearInterval(interval); resolve(null); }
    }, 100);
  });
}

// Connect
const wallet = await detectWallet();
if (!wallet) throw new Error('1AM wallet not installed');

const api = await wallet.connect('preview'); // 'preview' | 'preprod' | 'mainnet'
```

## 3) Session Setup (`createConnectedSession`)

Fetch config, network ID, and all addresses in **parallel** — don't await them in sequence:

```ts
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { createProofProvider } from '@midnight-ntwrk/midnight-js-types';
import { Transaction } from '@midnight-ntwrk/ledger-v8';

export async function createConnectedSession(api: OneAmConnectedApi, zkAssetBasePath: string) {
  // Fetch in parallel
  const [config, unshieldedAddress, shieldedAddress] = await Promise.all([
    api.getConfiguration(),
    api.getUnshieldedAddress(),
    api.getShieldedAddresses(),
  ]);

  // Must be called before any SDK operations
  setNetworkId(config.networkId);

  const zkConfigProvider = new FetchZkConfigProvider(
    new URL(zkAssetBasePath, window.location.origin).toString(),
    window.fetch.bind(window),
  );

  const provingProvider = await api.getProvingProvider(zkConfigProvider);

  const walletProvider = {
    getCoinPublicKey: () => shieldedAddress.shieldedCoinPublicKey,
    getEncryptionPublicKey: () => shieldedAddress.shieldedEncryptionPublicKey,
    balanceTx: async (tx: UnboundTransaction) => {
      const txHex = toHex(tx.serialize());
      const balanced = await api.balanceUnsealedTransaction(txHex);
      return Transaction.deserialize('signature', 'proof', 'binding', fromHex(balanced.tx));
    },
  };

  const midnightProvider = {
    submitTx: async (tx: any) => {
      const txHex = toHex(tx.serialize());
      const txId = await api.submitTransaction(txHex);
      return txId ?? '';
    },
  };

  return {
    api,
    config,
    providers: {
      privateStateProvider: createPrivateStateProvider(),
      publicDataProvider: createPatchedPublicDataProvider(config.indexerUri, config.indexerWsUri),
      zkConfigProvider,
      proofProvider: createProofProvider(provingProvider),
      walletProvider,
      midnightProvider,
    },
    unshieldedAddress: unshieldedAddress.unshieldedAddress,
  };
}
```

### Hex helpers (required — use `padStart`, never skip it)

```ts
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (normalized.length % 2 !== 0) throw new Error('Invalid hex string from wallet.');
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}
```

## 4) Patched Public Data Provider (Critical — Preview/Preprod Indexer Bug)

The preview and preprod indexers have a GraphQL bug with `offset: null` in latest-state queries. The default SDK `queryContractState()` without a config block hits this bug. **Always wrap `indexerPublicDataProvider` with this patch:**

```ts
import { ContractState } from '@midnight-ntwrk/compact-runtime';
import { LedgerParameters, ZswapChainState } from '@midnight-ntwrk/ledger-v8';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';

function createPatchedPublicDataProvider(queryUrl: string, subscriptionUrl: string) {
  const base = indexerPublicDataProvider(queryUrl, subscriptionUrl);

  async function queryLatest(queryUrl: string, query: string, address: string) {
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
      // If config is provided, the SDK path works — use it
      if (config) return base.queryContractState(contractAddress, config);

      // Without config, bypass the broken SDK query
      const action = await queryLatest(queryUrl, `
        query LATEST_CONTRACT_STATE($address: HexEncoded!) {
          contractAction(address: $address) { state }
        }`, contractAddress);
      return action ? ContractState.deserialize(fromHex(action.state)) : null;
    },
    async queryZSwapAndContractState(contractAddress: string, config?: any) {
      if (config) return base.queryZSwapAndContractState(contractAddress, config);

      const action = await queryLatest(queryUrl, `
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

## 5) Private State Provider (In-Memory)

For minimal dApps, an in-memory provider is sufficient. Private state does not persist across page reloads — this is intentional for a reference implementation:

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
    // export/import not needed for minimal dApps — throw if called
    async exportPrivateStates() { throw new Error('Not implemented.'); },
    async importPrivateStates() { throw new Error('Not implemented.'); },
    async exportSigningKeys() { throw new Error('Not implemented.'); },
    async importSigningKeys() { throw new Error('Not implemented.'); },
  };
}
```

## 6) Deploy & Call Contracts

```ts
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { deployContract, submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { Contract } from './your-compiled-contract';

// Deploy
const compiledContract = CompiledContract.make('YourContract', Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets('./contract/compiled/your-contract'),
);

const session = await createConnectedSession(api, '/zk/your-contract/');
const deployed = await deployContract(session.providers, { compiledContract });
console.log('Address:', deployed.deployTxData.public.contractAddress);

// Call a circuit
const result = await submitCallTx(session.providers, {
  compiledContract,
  contractAddress: deployed.deployTxData.public.contractAddress,
  circuitId: 'yourCircuit',
  args: [arg1, arg2],
});
console.log('Tx hash:', result.public.txHash);
```

## 7) Transaction Flow (Dust-Free)

```
dApp builds unproven tx
        ↓
proofProvider.proveTx()  →  1AM wallet  →  ProofStation  →  ZK proof (~2–5s)
        ↓
walletProvider.balanceTx()  →  api.balanceUnsealedTransaction()  →  server adds dust fees
        ↓
midnightProvider.submitTx()  →  api.submitTransaction()  →  Midnight chain

Total user cost: 0 NIGHT, 0 dust.
```

The key step is `balanceUnsealedTransaction` — this is where ProofStation's server wallet pays fees on behalf of the user. Never skip it.

## 8) Post-Deploy: Polling for Indexed State

After deploy, the indexer takes time to reflect the new contract. **Do not** use SDK helpers that block on finalization — they hit the indexer bug. Poll manually:

```ts
async function pollForContractState(
  queryUrl: string,
  contractAddress: string,
  maxAttempts = 30,
  intervalMs = 2000,
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: `query($address: HexEncoded!) { contractAction(address: $address) { state } }`,
        variables: { contractAddress },
      }),
    });
    const data = await res.json();
    if (data?.data?.contractAction?.state) return true;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}
```

## 9) Optional: Payload Encryption (`confidentialTodo.ts` pattern)

Encrypt on-chain data using a key derived from the user's wallet signature. Requires `api.signData`.

```ts
// Derive a deterministic AES-GCM key from wallet signature
async function deriveContractKey(api: OneAmConnectedApi, networkId: string, contractAddress: string) {
  const message = `your-app-confidential-key|${networkId}|${contractAddress}`;
  const signature = await api.signData(message, { encoding: 'text' });

  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(signature), 'HKDF', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(`your-app-salt|${networkId}`),
      info: new TextEncoder().encode(`your-app-key|${contractAddress}`),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// Encrypt a string payload → versioned envelope string
// Decrypt by detecting the envelope prefix, reversing the process
// See confidentialTodo.ts in the reference repo for the full AES-GCM + base64url envelope implementation
```

Key design decisions from the reference implementation:
- Use `base64url` (not standard base64) to avoid padding issues in URLs/JSON
- Include `networkId` + `contractAddress` in both KDF salt and AAD — keys are contract-scoped
- Prefix encrypted values with `enc:v1:` for detection (`isEncryptedPayload()` check)
- If `signData` is unavailable, throw immediately — do not silently degrade

## 10) ZK Key Hosting

Compiled contracts produce assets that must be served via HTTP with CORS enabled:

```
your-server.com/zk/your-contract/
  keys/
    circuitName.prover      # 2–10 MB each
    circuitName.verifier    # ~2 KB each
  zkir/
    circuitName.bzkir       # 1–3 KB each
```

Required CORS header: `Access-Control-Allow-Origin: *`

For local dev with Vite, sync assets into `public/zk/` with npm scripts:

```json
{
  "sync:assets": "mkdir -p public/zk/your-contract && cp -r contracts/managed/your-contract/keys public/zk/your-contract/ && cp -r contracts/managed/your-contract/zkir public/zk/your-contract/"
}
```

Test asset URLs directly in the browser before debugging provider errors — a 404 or CORS failure here will surface as a cryptic SDK error.

## 11) ProofStation API

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Server health + upstream status |
| `/prove` | POST | Generate ZK proof |
| `/verify` | POST | Verify a ZK proof |
| `/prove-and-balance` | POST | Prove + balance in one call |
| `/balance-only` | POST | Balance a pre-proven tx (used by wallet internally) |
| `/wallet-status` | GET | Sponsorship wallet dust balance |

Base URLs:
- Preview: `https://api-preview.1am.xyz`
- Preprod: `https://api-preprod.1am.xyz`
- Mainnet: `https://api.1am.xyz`

Auth: `X-API-Key: pk_live_xxx` (only needed if calling ProofStation directly — prefer routing through `api.balanceUnsealedTransaction` instead)

## 12) Networks

| Network | Use for | Indexer | RPC |
|---|---|---|---|
| `preview` | Active development | `indexer.preview.midnight.network` | `rpc.preview.midnight.network` |
| `preprod` | Pre-release testing | `indexer.preprod.midnight.network` | `rpc.preprod.midnight.network` |
| `mainnet` | Production | `indexer.mainnet.midnight.network` | `rpc.mainnet.midnight.network` |

Use `preview` for development. The `getConfiguration()` call returns the correct URLs for whichever network the user has selected in the wallet — always use those values dynamically.

## 13) Common Pitfalls

- **`padStart(2, '0')` in `toHex`** — Missing zero-padding on single-digit hex bytes corrupts the transaction. Always use it.
- **`setNetworkId()` must be called before SDK operations** — Call it immediately after `getConfiguration()`. Missing this causes silent type mismatches.
- **Do not call `fromHex` before stripping `0x`** — The wallet may return hex with or without the `0x` prefix. The `fromHex` helper above handles both.
- **Indexer lag after deploy** — The indexer is not synchronous with chain finality. Poll or subscribe; do not read state immediately after submitting.
- **Circuit size on preview** — The preview ProofStation requires a minimum circuit size (`k≥6`). If `prove: no SRS params for k=6` appears, the circuit is too small. Add dummy ledger fields to increase circuit size as a workaround until mainnet prover supports smaller circuits.
- **ZK assets 404** — Run the sync npm script before `npm run dev`. Vite only serves files that exist in `public/` at startup.
- **Old contract addresses** — After any contract shape change or recompile, the verifier key changes. Old saved addresses will fail proof verification. Always redeploy after contract changes.

## 14) Wallet API Reference

### `window.midnight['1am']` (InitialAPI)

| Method | Returns | Notes |
|---|---|---|
| `connect(networkId)` | `ConnectedAPI` | `'preview'` \| `'preprod'` \| `'mainnet'` |
| `name` | `string` | `'1AM'` |
| `apiVersion` | `string` | `'4.0.0'` |

### ConnectedAPI

| Method | Returns | Notes |
|---|---|---|
| `getConfiguration()` | `{ networkId, indexerUri, indexerWsUri, proverServerUri, substrateNodeUri }` | Source of truth for all URLs |
| `getShieldedAddresses()` | `{ shieldedAddress, shieldedCoinPublicKey, shieldedEncryptionPublicKey }` | |
| `getUnshieldedAddress()` | `{ unshieldedAddress }` | |
| `getDustAddress()` | `{ dustAddress }` | |
| `getShieldedBalances()` | `Record<string, bigint>` | |
| `getUnshieldedBalances()` | `Record<string, bigint>` | |
| `getDustBalance()` | `{ balance, cap }` | |
| `getProvingProvider(zkConfigProvider)` | `ProvingProvider` | Pass your `FetchZkConfigProvider` |
| `balanceUnsealedTransaction(hex)` | `{ tx: string }` | Returns hex of balanced tx |
| `submitTransaction(hex)` | `string \| void` | Returns txId or void |
| `signData(data, options)` | `string` | Signature for key derivation |
| `makeTransfer(outputs)` | `{ tx }` | Token transfer |
