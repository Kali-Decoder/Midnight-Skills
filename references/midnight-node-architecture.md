---
title: Midnight Node Architecture
description: Overview of Midnight node internals — consensus, cryptography, runtime, P2P, RPC, storage, and transactions. Each topic is a dedicated agent skill with diagrams.
category: Node Architecture
author: Kali-Decoder
tags:
  - Consensus
  - Node
  - Runtime
  - P2P
  - RPC
skills:
  - midnight-consensus
  - midnight-cryptography
  - midnight-onchain-logic
  - midnight-p2p-networking
  - midnight-rpc
  - midnight-storage
  - midnight-transactions
---

# Midnight Node Architecture

Midnight is a **Cardano Partnerchain** built on the **Polkadot SDK**. The node stack spans consensus, cryptography, on-chain execution, networking, RPC, storage, and a proof-based transaction model.

## Full stack map

```mermaid
flowchart TB
  subgraph Clients["External clients"]
    DApp["dApps / wallets"]
  end

  subgraph Node["Midnight node"]
    RPC["RPC layer"]
    P2P["P2P / libp2p"]
    Pool["Transaction pool"]
    RT["WASM runtime + FRAME pallets"]
    PM["pallet-midnight"]
    Store["ParityDB + Merkle trie"]
  end

  subgraph Consensus["Consensus"]
    AURA["AURA — block production"]
    GRANDPA["GRANDPA — finality"]
  end

  DApp --> RPC
  P2P <--> Node
  Pool --> RT
  RT --> PM
  PM --> Store
  AURA --> RT
  GRANDPA --> RT
```

## Topic skills

| Topic | Skill folder | Covers |
|-------|--------------|--------|
| Consensus | `midnight-consensus/` | AURA, GRANDPA, SPO validator selection |
| Cryptography | `midnight-cryptography/` | Blake2-256, sr25519, ECDSA, Ed25519, twoxhash |
| Onchain logic | `midnight-onchain-logic/` | WASM runtime, FRAME, pallet-midnight |
| P2P networking | `midnight-p2p-networking/` | Discovery, transport, gossip |
| RPC | `midnight-rpc/` | JSON-RPC for state and system queries |
| Storage | `midnight-storage/` | ParityDB, trie, state roots |
| Transactions | `midnight-transactions/` | Proof-based tx lifecycle |

Browse these on MIDSKILLS under **Foundation**, or install with:

```bash
npx skills add Kali-Decoder/Midnight-skills
```

Learning path: **Midnight node architecture** (`/paths`).
