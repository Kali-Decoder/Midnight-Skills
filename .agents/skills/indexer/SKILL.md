---
name: indexer
description: Query and subscribe to Midnight blockchain data via the Indexer GraphQL API v4. Covers contract state reads, transaction lookups, block queries, real-time subscriptions (contractActions, blocks, unshielded/shielded transactions), state deserialization, contract events (Ledger 9), and TypeScript helper patterns. Use when a user needs to read on-chain state after a transaction, watch contract events in real time, look up blocks or transactions, query unshielded balances, or monitor DUST generation status.
---

# Midnight Indexer Skill

The Midnight Indexer exposes a GraphQL API that indexes everything the chain produces: blocks, transactions, contract actions, and UTXO events. It is the only way to read public on-chain state from a DApp frontend.

**Primary references:**
- `docs.midnight.network/api-reference/midnight-indexer` — official v4 API reference
- `github.com/midnightntwrk/midnight-indexer` (tag `v4.4.101`) — `indexer-api/graphql/schema-v4.graphql`
- Live schema: introspect your indexer (`{ __schema { ... } }`). Every query below was validated against the Preview indexer (4.4.101, protocol version `2001100`) on 21 Nov 2026
- `midnight.ts` in `webisoftSoftware/1AM-starter-template` — real-world patched implementation
- `references/volatile.md` — resolve current `@midnight-ntwrk/*` and schema versions live

---

## 1) Endpoints

| Network | HTTP | WebSocket |
|---|---|---|
| `undeployed` (local) | `http://localhost:8088/api/v4/graphql` | `ws://localhost:8088/api/v4/graphql/ws` |
| `preview` | `https://indexer.preview.midnight.network/api/v4/graphql` | `wss://indexer.preview.midnight.network/api/v4/graphql/ws` |
| `preprod` | `https://midnight-preprod.blockfrost.io/api/v0?project_id=<token>` | `wss://midnight-preprod.blockfrost.io/api/v0/ws?project_id=<token>` |
| `mainnet` | `https://midnight-mainnet.blockfrost.io/api/v0?project_id=<token>` | `wss://midnight-mainnet.blockfrost.io/api/v0/ws?project_id=<token>` |

- **Local and preview both use `/api/v4/graphql`.** Older guides said the local indexer was v3; indexer 4.4.101 serves v4.
- **Preprod and mainnet are served by Blockfrost** since `indexer.preprod.midnight.network` / `indexer.mainnet.midnight.network` were retired on 9 Oct 2026 (they now answer HTTP 410 `ENDPOINT_DECOMMISSIONED`). Tokens are per network (`nightpreprod…` / `nightmainnet…`); a missing or wrong token gives HTTP 403. Pass the token as `?project_id=` in the URL (browser WebSockets cannot set headers), and keep it out of browser bundles.
- **Version:** Ledger 9 networks need indexer **4.4.101** (`midnightntwrk/indexer-standalone:4.4.101` locally). Older indexers are incompatible.
- `networks.preview()` / `networks.preprod(token)` / `networks.mainnet(token)` from `@midnightntwrk/midnight-js-utils` build these URLs.

---

## 2) Latest State and Offsets (the old `offset: null` bug is gone)

Earlier guides wrapped `indexerPublicDataProvider` in a "patched" provider because the hosted indexers errored when `contractAction` was queried without an offset. **That workaround is obsolete.** On indexer 4.4.101 a query with no offset (or `offset: null`) returns the latest state. This was verified against Preview, and Midnight.js 5's own `CONTRACT_STATE_QUERY` sends `$offset: BlockOffset` as null. Use the SDK provider directly:

```typescript
import { indexerPublicDataProvider } from '@midnightntwrk/midnight-js-indexer-public-data-provider';

const publicDataProvider = indexerPublicDataProvider({ queryURL, subscriptionURL });
const read = await publicDataProvider.queryContractState(contractAddress);   // latest
const atBlock = await publicDataProvider.queryContractState(contractAddress, { type: 'blockHeight', blockHeight: 100 });
```

**One semantic change on 4.4.101:** a `contractActions` **subscription** without an offset delivers only *new* actions. To replay history, pass an explicit offset (e.g. `{ height: 0 }`). Midnight.js 5 does this for you; hand-written subscriptions must do it themselves.

---

## 3) Contract State — Query and Deserialize

The indexer returns contract state as a hex-encoded `ContractState` blob. Decode it with **your own** `compact-runtime` copy, then apply the generated `ledger()` function.

**Preferred: through Midnight.js 5**

```typescript
import { ContractState } from '@midnight-ntwrk/compact-runtime';
import { ledger } from './managed/counter/contract/index.js';

const read = await publicDataProvider.queryContractState(contractAddress);
if (read) {
  // read.contractState.era is 'v8' | 'v9'; deserialize calls only the matching decoder
  const state = ledger(read.contractState.deserialize({ v9: ContractState }).data);
  console.log(state.round);
}
```

**Manual GraphQL** (no SDK):

```typescript
import { ContractState } from '@midnight-ntwrk/compact-runtime';
import { ledger } from './managed/counter/contract/index.js';

function fromHex(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Uint8Array.from(h.match(/.{2}/g) ?? [], (b) => parseInt(b, 16));
}

async function getContractLedgerState(indexerUrl: string, contractAddress: string) {
  const res = await fetch(indexerUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: `query($address: HexEncoded!) {
        contractAction(address: $address) {
          state
          zswapState
          transaction { block { ledgerParameters protocolVersion } }
        }
      }`,
      variables: { address: contractAddress },
    }),
  });
  const payload = await res.json();
  if (payload.errors?.length) throw new Error(payload.errors[0].message);
  const action = payload.data?.contractAction;
  if (!action) return null;
  return ledger(ContractState.deserialize(fromHex(action.state)).data);
}
```

A state written under Ledger 8 (`protocolVersion` < 2000000 on Preprod/mainnet history) cannot be decoded by `compact-runtime` 0.21. Midnight.js routes those to its retained v8 decoder only when you pass `{ v8: ... }`.

### Deserializing ZSwap + Contract State Together

When you need `ZswapChainState` and `LedgerParameters` (required by some SDK functions):

```typescript
import { LedgerParameters, ZswapChainState } from '@midnightntwrk/ledger-v9';

const action = payload.data?.contractAction;
if (action?.zswapState) {
  const zswapState = ZswapChainState.deserialize(fromHex(action.zswapState));
  const contractState = ContractState.deserialize(fromHex(action.state));
  const ledgerParams = action.transaction?.block?.ledgerParameters
    ? LedgerParameters.deserialize(fromHex(action.transaction.block.ledgerParameters))
    : LedgerParameters.initialParameters();

  return [zswapState, contractState, ledgerParams];
}
```

---

## 4) All Query Types

### Latest Block

```graphql
query {
  block {
    hash
    height
    timestamp
    protocolVersion
    ledgerParameters
    transactions {
      id
      hash
    }
  }
}
```

### Block by Height or Hash

```graphql
query {
  block(offset: { height: 42 }) {
    hash height timestamp
  }
}

query {
  block(offset: { hash: "3031323..." }) {
    hash height timestamp
  }
}
```

### Contract Action — Latest

```graphql
query($address: HexEncoded!) {
  contractAction(address: $address) {
    __typename
    address
    state
    zswapState
    transaction {
      hash
      block { height ledgerParameters }
      ... on RegularTransaction { fee identifiers }
    }
    unshieldedBalances {
      tokenType
      amount
    }
    ... on ContractCall {
      entryPoint
    }
  }
}
```

### Contract Action at a Specific Block

```graphql
query($address: HexEncoded!) {
  contractAction(
    address: $address,
    offset: { blockOffset: { height: 100 } }
  ) {
    state
    zswapState
  }
}
```

### Contract Action at a Specific Transaction

```graphql
query($address: HexEncoded!, $txHash: HexEncoded!) {
  contractAction(
    address: $address,
    offset: { transactionOffset: { hash: $txHash } }
  ) {
    state
  }
}
```

### Transactions by Hash or Identifier

```graphql
query($hash: HexEncoded!) {
  transactions(offset: { hash: $hash }) {
    __typename            # RegularTransaction | SystemTransaction | BridgeClaimTransaction
    id hash protocolVersion
    block { height hash }
    ... on RegularTransaction {
      identifiers
      fee                 # String (u128); `fees { paidFees estimatedFees }` is deprecated
      transactionResult { status segments { id success } }
    }
    contractActions {
      __typename
      address
      state
      ... on ContractDeploy { address }
      ... on ContractCall { entryPoint }
    }
    unshieldedCreatedOutputs {
      owner value tokenType intentHash outputIndex
    }
    unshieldedSpentOutputs {
      owner value tokenType intentHash outputIndex
    }
  }
}
```

### Unshielded Balances for a Contract

```graphql
query($address: HexEncoded!) {
  contractAction(address: $address) {
    unshieldedBalances {
      tokenType   # hex-encoded token type identifier
      amount      # string (supports u128)
    }
  }
}
```

Note: `ContractDeploy` always returns empty balances. Only `ContractCall` and `ContractUpdate` reflect meaningful balances.

### DUST Generation Status

```graphql
query {
  dustGenerationStatus(
    cardanoRewardAddresses: ["stake_test1uq..."]
  ) {
    cardanoRewardAddress
    dustAddress
    registered
    nightBalance
    generationRate
    currentCapacity
    maxCapacity
    utxoTxHash
    utxoOutputIndex
  }
}
```

The Ledger 9 upgrade reset DUST state: mainnet replayed cNIGHT registrations to full cap; Preprod cleared registrations not backed by cNIGHT (re-register); Preview relaunched empty. Generation parameters are unchanged.

`currentCapacity` is accurate only until the first DUST fee payment (fee payments are shielded — indexer can't track them). Use it as an approximation; query the wallet SDK directly for precise post-payment DUST balance.

---

## 5) Contract Events (Ledger 9)

Compact 0.36 contracts can `emit(...)` events (all events are public). The indexer exposes them as `contractEvents`:

```graphql
query($address: HexEncoded!) {
  contractEvents(filter: { contractAddress: $address }, limit: 50, offset: 0) {
    __typename            # ShieldedSpendEvent | UnshieldedReceiveEvent | MiscContractEvent | ...
    id maxId protocolVersion contractAddress transactionId raw
    ... on MiscContractEvent { name payload }
    ... on UnshieldedReceiveEvent { recipient { kind userAddress contractAddress } domainSep tokenType amount }
    ... on UnshieldedSpendEvent { sender { kind userAddress contractAddress } domainSep tokenType amount }
  }
}
```

From TypeScript, page through all of them with the SDK helper:

```typescript
import { getAllContractEvents } from '@midnightntwrk/midnight-js-indexer-public-data-provider';

for await (const event of getAllContractEvents(publicDataProvider, { contractAddress })) {
  console.log(event);
}
```

There is also a `contractEvents(filter, id)` subscription, and `ContractCall.contractEvents` on each call.

---

## 6) Real-Time Subscriptions

Subscriptions use WebSocket with the `graphql-transport-ws` protocol. The `graphql-ws` npm package handles this cleanly.

```bash
npm install graphql-ws ws
```

### Subscribe to Contract Actions

The most common subscription for DApp UIs — fires every time your contract is called or updated:

```typescript
import { createClient } from 'graphql-ws';
import { WebSocket } from 'ws'; // Node.js only

const client = createClient({
  url: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws', // preprod/mainnet: Blockfrost …/api/v0/ws?project_id=<token>
  webSocketImpl: typeof window === 'undefined' ? WebSocket : undefined,
});

const unsubscribe = client.subscribe(
  {
    query: `
      subscription WatchContract($address: HexEncoded!) {
        contractActions(address: $address, offset: { height: 0 }) {   # omit offset → only NEW actions (indexer 4.4.101)
          __typename
          address
          state
          zswapState
          transaction {
            hash
            block { height timestamp }
            ... on RegularTransaction { fee }
          }
          ... on ContractCall {
            entryPoint
          }
        }
      }
    `,
    variables: { address: contractAddress },
  },
  {
    next(data) {
      const action = data.data?.contractActions;
      if (!action) return;

      // Deserialize raw state to typed ledger
      const contractState = ContractState.deserialize(fromHex(action.state));
      const ledgerState = YourContract.ledger(contractState.data);

      console.log('New state:', ledgerState);
      console.log('Entry point:', action.entryPoint); // which circuit was called
    },
    error(err) { console.error('Subscription error:', err); },
    complete() { console.log('Subscription closed'); },
  },
);

// Cleanup
unsubscribe();
```

**Offsets:** with no offset, indexer 4.4.101 delivers only actions after you subscribe. Pass a block offset to replay from a known point:

```typescript
variables: { address: contractAddress },
// Pass offset in the query to replay from block 100:
query: `subscription($address: HexEncoded!) {
  contractActions(address: $address, offset: { height: 100 }) { ... }
}`
```

### Subscribe to New Blocks

```typescript
client.subscribe(
  {
    query: `
      subscription {
        blocks {
          hash height timestamp
          transactions { id hash }
        }
      }
    `,
  },
  {
    next(data) { console.log('New block:', data.data?.blocks?.height); },
    error(err) { console.error(err); },
    complete() {},
  },
);
```

### Subscribe to Unshielded Transactions

Watch for incoming/outgoing unshielded UTXOs for a specific address:

```typescript
client.subscribe(
  {
    query: `
      subscription WatchAddress($address: UnshieldedAddress!) {
        unshieldedTransactions(address: $address) {
          __typename
          ... on UnshieldedTransaction {
            transaction { hash block { height } }
            createdUtxos { owner value tokenType intentHash outputIndex }
            spentUtxos  { owner value tokenType intentHash outputIndex }
          }
          ... on UnshieldedTransactionsProgress {
            highestTransactionId
          }
        }
      }
    `,
    variables: { address: 'mn_addr_preview1...' },
  },
  {
    next(data) {
      const event = data.data?.unshieldedTransactions;
      if (event?.__typename === 'UnshieldedTransaction') {
        console.log('Created UTXOs:', event.createdUtxos);
        console.log('Spent UTXOs:', event.spentUtxos);
      }
    },
    error(err) { console.error(err); },
    complete() {},
  },
);
```

**Resume from a transaction ID** (to avoid replaying from genesis):

```typescript
variables: { address: 'mn_addr_preview1...', transactionId: 12345 },
```

### Subscribe to Shielded Transactions (Wallet Sync)

Requires a `sessionId` from the `connect` mutation. This is used internally by the wallet SDK — you rarely need to call it directly unless building a custom wallet sync.

```typescript
// Step 1: get a session ID
const sessionRes = await fetch(indexerHttpUrl, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    query: `mutation { connect(viewingKey: "mn_shield-esk1...") }`,
  }),
});
const { data } = await sessionRes.json();
const sessionId = data.connect;

// Step 2: subscribe
client.subscribe(
  {
    query: `
      subscription($sessionId: HexEncoded!, $index: Int) {
        shieldedTransactions(sessionId: $sessionId, index: $index) {
          __typename
          ... on RelevantTransaction {
            transaction { id hash }
            zswapCollapsedUpdate { startIndex endIndex update protocolVersion }   # was collapsedMerkleTree (deprecated)
          }
          ... on ShieldedTransactionsProgress {
            highestZswapEndIndex            # was highestEndIndex (deprecated)
            highestCheckedZswapEndIndex
            highestRelevantZswapEndIndex
          }
        }
      }
    `,
    variables: { sessionId, index: 0 },
  },
  {
    next(data) { /* process wallet sync events */ },
    error(err) { console.error(err); },
    complete() {},
  },
);

// Step 3: cleanup session when done
await fetch(indexerHttpUrl, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    query: `mutation { disconnect(sessionId: "${sessionId}") }`,
  }),
});
```

---

## 7) Poll After Submit (Practical Pattern)

After calling `submitTx`, the indexer is not synchronous with chain finality. For most DApp flows, poll with exponential backoff rather than using a long-lived subscription:

```typescript
async function pollForContractState(
  indexerUrl: string,
  contractAddress: string,
  options: { maxAttempts?: number; intervalMs?: number } = {},
): Promise<string | null> {
  const { maxAttempts = 30, intervalMs = 2000 } = options;

  for (let i = 0; i < maxAttempts; i++) {
    const data = await gqlQuery(indexerUrl, `
      query($address: HexEncoded!) {
        contractAction(address: $address) { state }
      }
    `, { address: contractAddress });

    if (data?.contractAction?.state) return data.contractAction.state;

    await new Promise(r => setTimeout(r, intervalMs));
  }
  return null;
}

// Usage after deploy
const deployed = await deployContract(providers, { ... });
const address = deployed.deployTxData.public.contractAddress;
const stateHex = await pollForContractState(network.indexer.queryURL, address);
// With Midnight.js 5 you rarely need this: deployContract already waits, and
// publicDataProvider.watchForContractState(address) does the polling for you.
if (!stateHex) throw new Error('Contract not found after deploy — indexer lag');
```

---

## 8) Reading `TransactionResult` (Did It Succeed?)

```typescript
const data = await gqlQuery(indexerUrl, `
  query($hash: HexEncoded!) {
    transactions(offset: { hash: $hash }) {
      ... on RegularTransaction {
        transactionResult {
          status          # SUCCESS | PARTIAL_SUCCESS | FAILURE
          segments { id success }
        }
        fee               # String (u128)
      }
    }
  }
`, { hash: txHash });

const result = data?.transactions?.[0]?.transactionResult;
if (result?.status === 'FAILURE') {
  console.error('Transaction failed');
} else if (result?.status === 'PARTIAL_SUCCESS') {
  // Some segments succeeded, some didn't
  const failed = result.segments?.filter(s => !s.success);
  console.warn('Partial success. Failed segments:', failed);
}
```

---

## 9) TypeScript Helpers

```typescript
// src/indexer.ts

export type ContractActionType = 'ContractDeploy' | 'ContractCall' | 'ContractUpdate';

export interface RawContractAction {
  __typename: ContractActionType;
  address: string;
  state: string;
  zswapState: string;
  entryPoint?: string;  // only on ContractCall
  transaction: {
    hash: string;
    block: { height: number; timestamp: number; ledgerParameters?: string };
    fee?: string; // only on RegularTransaction (u128 as string)
  };
  unshieldedBalances: Array<{ tokenType: string; amount: string }>;
}

export function parseUnshieldedBalances(
  balances: Array<{ tokenType: string; amount: string }>,
): Map<string, bigint> {
  return new Map(balances.map(b => [b.tokenType, BigInt(b.amount)]));
}

export function fromHex(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (normalized.length % 2 !== 0) throw new Error('Invalid hex string');
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// Typed ledger state from raw hex (using your contract's generated ledger() fn)
export function deserializeLedgerState<T>(
  stateHex: string,
  ledgerFn: (data: any) => T,
): T {
  const { ContractState } = require('@midnight-ntwrk/compact-runtime');
  const contractState = ContractState.deserialize(fromHex(stateHex));
  return ledgerFn(contractState.data);
}
```

---

## 10) Query Limits

The indexer server enforces limits on query complexity. If you hit them:

```json
{ "errors": [{ "message": "Query has too many fields: 20. Max fields: 10." }] }
```

Split deep queries into multiple smaller queries. Don't select the full transaction graph in a single query — request only what you need.

---

## 11) Common Pitfalls

**Retired hosts** — `indexer.preprod.midnight.network` / `indexer.mainnet.midnight.network` answer 410 `ENDPOINT_DECOMMISSIONED`. Use Blockfrost with a per-network `project_id`.

**`/api/v4/graphql` everywhere Midnight hosts or you run locally** — local and preview both serve v4.

**Deprecated fields on 4.4.101** — `Transaction.fees`/`TransactionFees.estimatedFees` → `RegularTransaction.fee`; `transactionResult` is only on `RegularTransaction` (use `... on RegularTransaction`); `collapsedMerkleTree` → `zswapCollapsedUpdate`; `highest*EndIndex` → `highest*ZswapEndIndex`. Querying `fees`/`transactionResult` directly on `Transaction` is a validation error.

**Subscriptions without an offset only see new data** — pass `offset: { height: 0 }` (or a saved height) to replay.

**Ledger 8 history** — states and transactions from before the fork (Preprod/mainnet) carry a Ledger 8 `protocolVersion`; `compact-runtime` 0.21 cannot decode them.

**State is not immediately available after `submitTx`** — the indexer is asynchronous with chain finality. Always poll or subscribe rather than querying immediately. Typical lag: 2–10 seconds on preprod/preview.

**`ContractDeploy` always returns empty `unshieldedBalances`** — contracts are deployed with zero balance. Query a `ContractCall` or `ContractUpdate` action for meaningful balance data.

**`currentCapacity` in `dustGenerationStatus` is stale after fee payments** — DUST fees are shielded transactions; the indexer cannot track them. Use the wallet SDK for accurate post-payment DUST balance.

**`amount` in `ContractBalance` is a `String`, not a number** — it supports u128 values that overflow JavaScript's number type. Always parse with `BigInt(amount)`, never `parseInt` or `Number`.

**`block.ledgerParameters` may be null on old blocks** — fall back to `LedgerParameters.initialParameters()` (from `@midnightntwrk/ledger-v9`) when null.

**Subscription connection drops silently** — the `graphql-ws` client does not automatically reconnect by default. Configure `retryAttempts` and `shouldRetry` in `createClient` options for production:

```typescript
const client = createClient({
  url: wsUrl,
  retryAttempts: Infinity,
  shouldRetry: () => true,
  retryWait: async (retries) => {
    await new Promise(r => setTimeout(r, Math.min(1000 * 2 ** retries, 30_000)));
  },
});
```

**`transactions` query returns an array** — even querying by hash returns `[Transaction!]!`. Always index into `[0]`.

**`__typename` required for union/interface fragments** — always request `__typename` when using `... on ContractDeploy / ContractCall / ContractUpdate` fragments or you won't be able to discriminate the type at runtime.