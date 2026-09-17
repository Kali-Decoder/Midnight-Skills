---
name: ankr-midnight
description: >
  Integrate Ankr as a Midnight Network RPC provider for testnet and mainnet.
  Covers creating an Ankr project, copying HTTPS/WSS endpoints with API key,
  wiring the node URL into midnight-js / multinetwork configs, and calling
  Midnight JSON-RPC methods (midnight_*, system_*, chain_*, state_*). Use when
  the user asks about Ankr + Midnight, Ankr.js for Midnight, Ankr RPC endpoint,
  or replacing public Midnight RPC with Ankr.
author: Kali-Decoder
---

# Ankr + Midnight Network RPC

Use **Ankr Chain RPC** as your Midnight node endpoint for **testnet** and **mainnet**.

**What this skill produces:** working Ankr HTTPS/WSS URLs with API key, a small JSON-RPC client, midnight-js network config wired to Ankr, and call patterns for Midnight operations.

**Primary references:**
- [Ankr Midnight RPC](https://www.ankr.com/rpc/midnight/)
- [Ankr Midnight API docs](https://www.ankr.com/docs/rpc-service/chains/chains-api/midnight/)
- [Ankr API key / Premium basics](https://www.ankr.com/docs/rpc-service/getting-started/basics-premium/)
- Related skills: `midnight-rpc/`, `midnight-js/`, `multinetwork/`, `indexer/`

---

## Critical: Midnight ≠ Ankr.js Advanced API

`@ankr.com/ankr.js` (`AnkrProvider`) talks to Ankr **Advanced API** (`ankr_getNFTsByOwner`, `getAccountBalance`, …). Those methods are for **EVM chains only** (`eth`, `polygon`, `bsc`, …).

**Midnight is not in the Advanced API chain list.** Do **not** use:

```javascript
// ❌ Wrong for Midnight — Advanced API / EVM only
import { AnkrProvider } from '@ankr.com/ankr.js';
const provider = new AnkrProvider('YOUR_ADVANCED_API_ENDPOINT');
await provider.getNFTsByOwner({ blockchain: 'eth', walletAddress: '0x…' });
```

For Midnight, use Ankr **Node / Chain RPC**: plain JSON-RPC `POST` to:

```text
https://rpc.ankr.com/midnight_testnet/<API_KEY>
https://rpc.ankr.com/midnight_mainnet/<API_KEY>
```

Auth is the **API key in the URL path** — no `Authorization` header.

---

## Workflow

1. Sign in to Ankr RPC and create/select a project
2. Enable Midnight and copy HTTPS (and optionally WSS) endpoints
3. Store the full URL (with key) in env — never commit the key
4. Point midnight-js `node` / `rpc` at the Ankr URL
5. Call Midnight JSON-RPC methods (`midnight_*`, `system_*`, `chain_*`, …)
6. Keep Indexer GraphQL separate (Ankr RPC ≠ Midnight Indexer)

---

## 1) Get your Ankr API key and Midnight endpoints

### Sign in

1. Open [https://www.ankr.com/rpc/](https://www.ankr.com/rpc/)
2. **Sign in** (Google, Ethereum wallet, GitHub, X, etc.)
3. Create or open a **Project** (Projects pane)

Premium / paid plans unlock higher rate limits and private endpoints. Free/demo access may be rate-limited — prefer a project key for apps.

### Copy Midnight endpoints

1. In the project, open **Chains**
2. Select **Midnight**
3. Choose network:
   - **Testnet** → `midnight_testnet`
   - **Mainnet** → `midnight_mainnet`
4. Copy **HTTPS** (required) and **WSS** (optional, for subscriptions / some SDKs)

### URL shape

```text
HTTPS: https://rpc.ankr.com/<network>/<API_KEY>
WSS:   wss://rpc.ankr.com/<network>/<API_KEY>
```

| Midnight network | Ankr path | Example HTTPS |
|------------------|-----------|---------------|
| Testnet | `midnight_testnet` | `https://rpc.ankr.com/midnight_testnet/<API_KEY>` |
| Mainnet | `midnight_mainnet` | `https://rpc.ankr.com/midnight_mainnet/<API_KEY>` |

Formula: **Endpoint = Project (API key) + Network**.

Official Ankr request examples use a trailing slash:

```text
https://rpc.ankr.com/midnight_testnet/YOUR_ANKR_API_KEY/
```

Both with and without trailing slash usually work; keep one style consistently.

### Env vars (recommended)

```bash
# .env.local — never commit
ANKR_API_KEY=your_project_api_key_here

# Or store the full endpoint
ANKR_MIDNIGHT_TESTNET_RPC=https://rpc.ankr.com/midnight_testnet/your_project_api_key_here
ANKR_MIDNIGHT_MAINNET_RPC=https://rpc.ankr.com/midnight_mainnet/your_project_api_key_here

# Optional WebSocket
ANKR_MIDNIGHT_TESTNET_WSS=wss://rpc.ankr.com/midnight_testnet/your_project_api_key_here
ANKR_MIDNIGHT_MAINNET_WSS=wss://rpc.ankr.com/midnight_mainnet/your_project_api_key_here
```

Build URLs in code if you only store the key:

```typescript
const ANKR_KEY = process.env.ANKR_API_KEY!;
if (!ANKR_KEY) throw new Error('Missing ANKR_API_KEY');

export const ANKR_MIDNIGHT = {
  testnet: {
    http: `https://rpc.ankr.com/midnight_testnet/${ANKR_KEY}`,
    wss: `wss://rpc.ankr.com/midnight_testnet/${ANKR_KEY}`,
  },
  mainnet: {
    http: `https://rpc.ankr.com/midnight_mainnet/${ANKR_KEY}`,
    wss: `wss://rpc.ankr.com/midnight_mainnet/${ANKR_KEY}`,
  },
} as const;
```

---

## 2) Smoke-test the endpoint

```bash
curl -X POST "https://rpc.ankr.com/midnight_testnet/${ANKR_API_KEY}/" \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "method": "system_chain",
    "params": [],
    "id": 1
  }'
```

Expected shape:

```json
{
  "id": 1,
  "jsonrpc": "2.0",
  "result": "testnet-02-1"
}
```

Quick health check:

```bash
curl -X POST "https://rpc.ankr.com/midnight_testnet/${ANKR_API_KEY}/" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"system_health","params":[],"id":1}'
```

---

## 3) Minimal TypeScript JSON-RPC client (Midnight)

No `@ankr.com/ankr.js` required for Midnight.

```typescript
type JsonRpcId = number | string;

export async function ankrMidnightRpc<T = unknown>(
  endpoint: string,
  method: string,
  params: unknown[] = [],
  id: JsonRpcId = 1,
): Promise<T> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id }),
  });

  if (!res.ok) {
    throw new Error(`Ankr RPC HTTP ${res.status}: ${await res.text()}`);
  }

  const payload = (await res.json()) as {
    result?: T;
    error?: { code: number; message: string; data?: unknown };
  };

  if (payload.error) {
    throw new Error(`Ankr RPC ${payload.error.code}: ${payload.error.message}`);
  }

  return payload.result as T;
}
```

Usage:

```typescript
const rpc = process.env.ANKR_MIDNIGHT_TESTNET_RPC!;

const chain = await ankrMidnightRpc<string>(rpc, 'system_chain');
const health = await ankrMidnightRpc<{
  peers: number;
  isSyncing: boolean;
  shouldHavePeers: boolean;
}>(rpc, 'system_health');

const apiVersions = await ankrMidnightRpc<number[]>(rpc, 'midnight_apiVersions');
```

---

## 4) Wire Ankr into midnight-js / multinetwork config

Midnight dApps typically need **three** services. Ankr replaces only the **node RPC**:

| Service | Provider | Notes |
|---------|----------|--------|
| Node RPC | **Ankr** (this skill) | `midnight_*`, `system_*`, tx submit paths used by SDKs |
| Indexer GraphQL | Midnight hosted indexer | Still `indexer.*.midnight.network` — not Ankr |
| Proof server | Local Docker or 1AM | Unchanged |

### Drop-in network config

```typescript
import { ANKR_MIDNIGHT } from './ankr';

// Map Ankr "testnet" to your app's Midnight testnet target
// (preview/preprod naming differs by SDK version — use the network your app deploys to)
export const networks = {
  testnet: {
    // Keep official indexer unless you have another GraphQL provider
    indexerHttp: 'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWs: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
    // Ankr node RPC (HTTPS). Some midnight-js setups expect WSS — use ANKR_MIDNIGHT.testnet.wss then.
    rpc: ANKR_MIDNIGHT.testnet.http,
    proofServerUrl: 'http://127.0.0.1:6300',
  },
  mainnet: {
    indexerHttp: 'https://indexer.mainnet.midnight.network/api/v4/graphql',
    indexerWs: 'wss://indexer.mainnet.midnight.network/api/v4/graphql/ws',
    rpc: ANKR_MIDNIGHT.mainnet.http,
    proofServerUrl: 'https://api.1am.xyz',
  },
};
```

Where example skills use `node = 'https://rpc.preprod.midnight.network'`, replace with the Ankr HTTPS URL (or WSS if the provider builder requires WebSocket).

**Network naming note:** Ankr exposes `midnight_testnet` / `midnight_mainnet`. Midnight apps often use `preview` / `preprod` / `mainnet`. Confirm which public Midnight network Ankr’s `midnight_testnet` tracks (`system_chain` → e.g. `testnet-02-1`) before deploying contracts against it.

---

## 5) Operations (JSON-RPC methods on Ankr Midnight)

Full method catalog: [Ankr Midnight docs](https://www.ankr.com/docs/rpc-service/chains/chains-api/midnight/) and skill `midnight-rpc/`.

### A) Midnight-specific (primary for dApps)

| Method | Purpose | Typical params |
|--------|---------|----------------|
| `midnight_apiVersions` | Supported Midnight RPC API versions | `[]` |
| `midnight_contractState` | Raw/binary contract state at optional block | `[contractAddress, atBlockHash?]` |
| `midnight_jsonContractState` | Human-readable JSON contract state | `[contractAddress, atBlockHash?]` |
| `midnight_zswapChainState` | ZSwap chain state for a contract | `[contractAddress, atBlockHash?]` |
| `midnight_jsonBlock` | Full block as JSON | `[blockHashOrNumber]` |
| `midnight_decodeEvents` | Decode Midnight contract events | `[eventPayload…]` (see node docs) |

```typescript
const state = await ankrMidnightRpc(
  rpc,
  'midnight_jsonContractState',
  ['<contract-address>'], // omit second arg for latest
);

const zswap = await ankrMidnightRpc(
  rpc,
  'midnight_zswapChainState',
  ['<contract-address>'],
);

const versions = await ankrMidnightRpc(rpc, 'midnight_apiVersions');
```

### B) System / health

| Method | Purpose |
|--------|---------|
| `system_chain` | Chain name (e.g. `testnet-02-1`) |
| `system_chainType` | `Live` / `Development` / `Local` |
| `system_health` | Sync + peer health |
| `system_properties` | Chain properties |
| `system_syncState` | `startingBlock` / `currentBlock` / `highestBlock` |
| `system_version` | Node implementation version |

```typescript
await ankrMidnightRpc(rpc, 'system_chain');
await ankrMidnightRpc(rpc, 'system_syncState');
```

### C) Chain & blocks

| Method | Purpose |
|--------|---------|
| `chain_getBlock` | Full block by hash |
| `chain_getBlockHash` | Hash for block number |
| `chain_getHeader` | Block header |
| `chain_getFinalizedHead` / `chain_getFinalisedHead` | Latest finalized hash |
| `chain_getHead` | Best block hash |
| `chain_getRuntimeVersion` | Runtime version |

```typescript
const head = await ankrMidnightRpc<string>(rpc, 'chain_getFinalizedHead');
const block = await ankrMidnightRpc(rpc, 'chain_getBlock', [head]);
```

### D) State & storage

| Method | Purpose |
|--------|---------|
| `state_getStorage` / `state_getStorageAt` | Read storage key |
| `state_getKeysPaged` / `state_getKeysPagedAt` | Page storage keys |
| `state_getMetadata` | Runtime metadata |
| `state_call` / `state_callAt` | Runtime call without extrinsic |
| `state_queryStorageAt` | Multi-key query at block |

### E) Archive (historical)

| Method | Purpose |
|--------|---------|
| `archive_unstable_finalizedHeight` | Latest archived finalized height |
| `archive_unstable_genesisHash` | Genesis hash |
| `archive_unstable_hashByHeight` | Hash(es) at height |
| `archive_unstable_header` / `archive_unstable_body` | Historical header / extrinsics |
| `archive_unstable_call` / `archive_unstable_storage` | Historical runtime call / storage |

### F) Sidechain / Partnerchain

| Method | Purpose |
|--------|---------|
| `sidechain_getStatus` | Sidechain sync / status |
| `sidechain_getParams` | Sidechain config params |
| `sidechain_getEpochCommittee` | Validator committee for epoch |
| `sidechain_getRegistrations` | Registered participants |
| `sidechain_getAriadneParameters` | Ariadne parameters |

### G) Accounts, GRANDPA, child state, meta

| Method | Purpose |
|--------|---------|
| `account_nextIndex` / `system_accountNextIndex` | Next account nonce |
| `grandpa_proveFinality` / `grandpa_roundState` | Finality proofs / round state |
| `childstate_getStorage` (+ keys/hash/size variants) | Child storage reads |
| `rpc_methods` | List methods exposed by this Ankr node |
| `offchain_localStorageGet` / `Set` | Often restricted on public RPCs |

```typescript
const methods = await ankrMidnightRpc(rpc, 'rpc_methods');
```

---

## 6) What Ankr does *not* replace on Midnight

| Need | Use instead |
|------|-------------|
| Contract actions, tx history, live subscriptions | Midnight **Indexer** GraphQL (`indexer/` skill) |
| NFT/token portfolio APIs like `getNFTsByOwner` | Not available via Ankr Advanced API for Midnight |
| Proof generation | Local proof server or 1AM ProofStation |
| Compact compile / deploy | `compact/`, `midnight-js/` |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `401` / unauthorized | Bad or missing API key in path | Recopy endpoint from Ankr Projects → Midnight |
| `method not found` | Method not exposed on this node | Call `rpc_methods`; fall back to official Midnight RPC |
| Advanced API / `AnkrProvider` errors with Midnight | Wrong product | Use Chain RPC JSON-RPC, not `@ankr.com/ankr.js` Advanced API |
| App works on official RPC, fails on Ankr | HTTPS vs WSS mismatch | Match protocol expected by midnight-js provider (`http` vs `ws`) |
| Rate limit / 429 | Free tier or empty credit balance | Upgrade plan / deposit API credits |
| Indexer queries fail after switching RPC | Indexer URL accidentally pointed at Ankr | Keep indexer on `indexer.*.midnight.network` |
| Wrong chain / contracts missing | Ankr testnet ≠ your preview/preprod deploy | Verify with `system_chain` and redeploy or switch network |

---

## Related Skills

| Task | Skill |
|------|-------|
| Midnight JSON-RPC method semantics | `midnight-rpc/` |
| Provider wiring, wallets, deploy | `midnight-js/` |
| Multi-network RPC/indexer/proof config | `multinetwork/` |
| GraphQL reads & subscriptions | `indexer/` |
| Environment / proof server setup | `midnight-environment-setup/` |

## Sources

- https://www.ankr.com/rpc/midnight/
- https://www.ankr.com/docs/rpc-service/chains/chains-api/midnight/
- https://www.ankr.com/docs/rpc-service/getting-started/basics-premium/
- https://www.ankr.com/docs/advanced-api/javascript-sdk/ (EVM Advanced API — not Midnight)
- https://www.npmjs.com/package/@ankr.com/ankr.js
