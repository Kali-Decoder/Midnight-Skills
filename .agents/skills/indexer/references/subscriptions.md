# Midnight Indexer Skill: 6) Real-Time Subscriptions

> Reference for the `indexer` skill. Back to [SKILL.md](../SKILL.md).

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
