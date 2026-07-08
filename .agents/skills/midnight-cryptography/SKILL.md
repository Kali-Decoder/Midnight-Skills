---
name: midnight-cryptography
description: Cryptographic primitives used by the Midnight node — Blake2-256 hashing, sr25519/ECDSA/Ed25519 signatures, twoxhash storage keys, and how they map to consensus, P2P, and state. Use when debugging node crypto, signature verification, or hash function choices.
author: Kali-Decoder
---

# Midnight Node Cryptography

Outside the **Midnight Ledger** (which has its own ZK circuits), the Midnight node relies on foundational cryptographic algorithms for **consensus**, **state transition integrity**, and **network communication**.

## Algorithm map

```mermaid
flowchart TB
  subgraph Hash["Hashing"]
    B2["Blake2-256 — cryptographic"]
    T2["twoxhash — non-cryptographic storage keys"]
  end

  subgraph Sign["Signature schemes"]
    SR["sr25519 — AURA block authorship"]
    ECDSA["ECDSA — Partnerchain consensus messages"]
    ED["Ed25519 — GRANDPA finality + libp2p"]
  end

  subgraph Use["Used for"]
    B2 --> Blocks["Block hashes, state transitions"]
    T2 --> Trie["Patricia-Merkle trie key generation"]
    SR --> AURA["AURA block production"]
    ECDSA --> PC["Partnerchain coordination"]
    ED --> GRANDPA["GRANDPA votes"]
    ED --> P2P["libp2p protocol messages"]
  end
```

---

## Blake2-256 (primary hash)

**Blake2-256** is the primary cryptographic hash function on Midnight.

- Used for **block hashes** and general-purpose hashing in state transition functions.
- Balances **performance** and **security** for runtime-critical operations.

---

## Signature schemes

Midnight uses **three distinct schemes** depending on role:

| Scheme | Construction / basis | Used for |
|--------|---------------------|----------|
| **sr25519** | Schnorrkel + Ristretto x25519 | Signing **AURA block authorship** messages |
| **ECDSA** | Standard elliptic-curve ECDSA | Signing **Partnerchain-related consensus** messages (external interoperability) |
| **Ed25519** | Edwards-curve EdDSA | **GRANDPA finality** messages and **libp2p** protocol messages |

```mermaid
flowchart LR
  subgraph Consensus
    AURA["AURA slot"] -->|sr25519| BA["Block authorship"]
    GRANDPA["GRANDPA vote"] -->|Ed25519| FV["Finality message"]
    PC["Partnerchain signal"] -->|ECDSA| PM["Cross-chain message"]
  end

  subgraph Network
    L2P["libp2p handshake"] -->|Ed25519| PI["Peer identity separate from consensus keys"]
  end
```

### sr25519

- Efficient key derivation and signature aggregation.
- Strong security guarantees for Substrate-style block production.

### ECDSA

- Ensures interoperability with systems where ECDSA is the standard (Partnerchain / Cardano ecosystem bridges).

### Ed25519

- Fast verification for high-frequency validator communication during finalization.
- Also used for **libp2p peer identity** (separate keypair from consensus signing keys).

---

## twoxhash (storage keys)

**twoxhash** is a **non-cryptographic** hash used to generate **storage keys** in the Patricia-Merkle trie.

- Optimized for **speed** and **low collision rates**.
- **Not** suitable for security-sensitive hashing.
- Significantly improves trie lookup performance.

See `midnight-storage/` for how twoxhash fits into ParityDB and state commitments.

---

## Ledger vs node crypto

| Layer | Cryptography |
|-------|-------------|
| **Midnight Ledger** | ZK proofs, ZSwap circuits, contract proof verification |
| **Midnight Node** | Blake2-256, sr25519, ECDSA, Ed25519, twoxhash |

Do not conflate ledger proof verification (handled by `pallet-midnight`) with node-level consensus and P2P primitives.

---

## Related skills

- `midnight-consensus/` — which schemes sign AURA vs GRANDPA vs Partnerchain messages
- `midnight-storage/` — twoxhash in trie key generation
- `midnight-p2p-networking/` — Ed25519 peer identity in libp2p
