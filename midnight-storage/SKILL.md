---
name: midnight-storage
description: Midnight on-chain storage — ParityDB key-value backend, Patricia-Merkle trie state commitments, twoxhash storage keys, and how state transitions are persisted. Use when explaining state proofs, database layout, or trie performance on Midnight nodes.
author: Kali-Decoder
---

# Storage

Midnight is built on the **Polkadot SDK (Substrate)** and uses **ParityDB** as its default database backend.

## Storage stack

```mermaid
flowchart TB
  subgraph Runtime["Runtime execution"]
    STF["State transition function (WASM)"]
    PM["pallet-midnight + other pallets"]
  end

  subgraph Trie["State layer"]
    MPT["Patricia-Merkle trie"]
    T2H["twoxhash — storage key generation"]
    MPT --- T2H
  end

  subgraph Persist["Persistence"]
    PDB["ParityDB — key-value store"]
  end

  STF --> PM
  PM --> MPT
  MPT --> PDB
  MPT --> Commit["State root commitment per block"]
```

---

## ParityDB

**ParityDB** is a fast key-value store designed for blockchain workloads.

- Stores **all on-chain state**.
- Default backend for Substrate/Polkadot SDK chains including Midnight.
- Optimized for high write throughput during block import and state commits.

---

## Patricia-Merkle trie

The trie is the underlying data structure for **state commitments**.

| Property | Benefit |
|----------|---------|
| Merkle structure | Tamper-evident state root per block |
| Inclusion proofs | Efficient verification of contract state, balances, etc. |
| Incremental updates | Only changed paths recomputed per block |

Canonical ledger state from runtime pallets (including `pallet-midnight`) is organized in this trie and persisted via ParityDB.

```mermaid
flowchart LR
  BlockN["Block N state root"] --> Root["Trie root hash"]
  Root --> Leaf1["Storage item A"]
  Root --> Leaf2["Storage item B"]
  Root --> Leaf3["Contract state …"]
  Query["RPC / light client"] --> Proof["Merkle inclusion proof"]
  Proof --> Leaf2
```

---

## twoxhash (storage keys)

**twoxhash** generates **storage keys** within the trie.

| Aspect | Detail |
|--------|--------|
| Type | Non-cryptographic hash |
| Purpose | Fast internal key-value lookups |
| Properties | Speed, low collision rate |
| **Not for** | Security-sensitive hashing (use Blake2-256) |

twoxhash significantly improves trie performance for map lookups without the cost of cryptographic hashing on every key derivation.

See `midnight-cryptography/` for the full hash/signature split.

---

## State commit flow

Every block:

1. Runtime executes transactions and updates pallet storage.
2. Changed trie nodes are computed; **state root** is derived.
3. **Midnight Ledger commitment** is persisted alongside standard Substrate state (`pallet-midnight`).
4. ParityDB persists the updated trie backing store.

```mermaid
sequenceDiagram
  participant RT as Runtime
  participant Trie as Patricia-Merkle trie
  participant PM as pallet-midnight
  participant DB as ParityDB

  RT->>Trie: Apply storage writes (twoxhash keys)
  RT->>PM: Commit ledger state
  Trie->>Trie: Compute new state root
  PM->>DB: Persist ledger commitment
  Trie->>DB: Persist trie nodes
```

---

## Querying storage

| Access path | Use case |
|-------------|----------|
| `state_getStorage` (RPC) | Raw storage key reads |
| `midnight_contractState` (RPC) | Contract-specific state |
| Indexer GraphQL | Application-friendly contract/event queries |

---

## Related skills

- `midnight-onchain-logic/` — what gets written to storage
- `midnight-cryptography/` — Blake2-256 vs twoxhash
- `midnight-rpc/` — reading state via JSON-RPC
- `midnight-transactions/` — how txs trigger storage updates
