---
name: midnight-consensus
description: Midnight Network consensus — AURA block production, GRANDPA finality, Cardano Partnerchain validator selection, and hybrid permissioned deployments. Use when explaining how Midnight blocks are produced, finalized, or how SPO stake delegation affects validator sets.
author: Kali-Decoder
---

# Midnight Consensus

The Midnight Network uses a **modified Substrate consensus stack**: **AURA** for block production and **GRANDPA** for finality. Both are extended for Midnight as a **Cardano Partnerchain**.

## Architecture overview

```mermaid
flowchart TB
  subgraph Selection["Validator selection"]
    SPO["Cardano SPO stake delegation"]
    Perm["Optional permissioned validators"]
    VS["Custom validator set function"]
    SPO --> VS
    Perm --> VS
  end

  subgraph Production["Block production — AURA"]
    VS --> Slots["Round-robin slots + session keys"]
    Slots --> Block["New block proposed"]
  end

  subgraph Finality["Finality — GRANDPA"]
    Block --> Votes["Validator votes on chain"]
    Votes --> Final["Provable finality"]
  end
```

---

## Validator selection

Unlike standard Substrate chains, Midnight uses a **custom validator set selection function** that:

- Accounts for **stake delegation from Cardano Stake Pool Operators (SPOs)**, letting existing Cardano validators participate in Midnight consensus.
- Supports **optional permissioned validators** for hybrid public/private network deployments.

| Model | Role |
|-------|------|
| SPO delegation | Bridges Cardano stake into Partnerchain validator eligibility |
| Permissioned set | Adds known operators for regulated or consortium networks |
| Custom selection | Combines both into the active session validator set |

---

## AURA: Block production

**AURA (Authority Round)** is a proof-of-authority (PoA) algorithm that determines which validator produces each block.

- Validators take turns in **round-robin** order.
- Scheduling uses **predefined slots** and **session keys**.
- Properties: simple, fast, deterministic — suited to high-throughput chains with known validator sets.

AURA is **not Midnight-specific**; it originated in OpenEthereum. See the [Polkadot protocol glossary — AURA](https://wiki.polkadot.network/docs/glossary#authority-round-aura).

```mermaid
sequenceDiagram
  participant V1 as Validator 1
  participant V2 as Validator 2
  participant V3 as Validator 3
  participant Chain as Chain

  Note over V1,V3: Slot N — Validator 1's turn
  V1->>Chain: Produce block N
  Note over V1,V3: Slot N+1 — Validator 2's turn
  V2->>Chain: Produce block N+1
  Note over V1,V3: Slot N+2 — Validator 3's turn
  V3->>Chain: Produce block N+2
```

**Signing:** Block authorship messages in AURA are signed with **sr25519** (see the Cryptography skill).

---

## GRANDPA: Finality

**GRANDPA (GHOST-based Recursive ANcestor Deriving Prefix Agreement)** provides **asynchronous, provable finality**.

- Operates **independently** of block production.
- Validators vote on chains; blocks finalize when they receive sufficient support.
- General-purpose Polkadot component — [formal specification](https://github.com/w3f/consensus/blob/master/pdf/grandpa.pdf) and [Polkadot glossary](https://wiki.polkadot.network/docs/glossary#ghost-based-recursive-ancestor-deriving-prefix-agreement-grandpa).

```mermaid
flowchart LR
  A["Blocks produced (AURA)"] --> B["GRANDPA voters observe chain"]
  B --> C{"≥ threshold support?"}
  C -->|Yes| D["Block finalized — irreversible"]
  C -->|No| E["Remains unfinalized / fork possible"]
```

**Signing:** GRANDPA finality messages use **Ed25519**.

---

## How AURA and GRANDPA work together

| Layer | Responsibility | Midnight extension |
|-------|----------------|-------------------|
| AURA | Who builds the next block | Standard PoA over Partnerchain validator set |
| GRANDPA | Which blocks are final | Standard async finality gadget |
| Validator set | Who may participate | SPO delegation + optional permissioned operators |

**Key insight:** Block production can continue while GRANDPA finalizes earlier blocks asynchronously — throughput and safety are decoupled.

---

## Related skills

- `midnight-cryptography/` — signature schemes used by AURA and GRANDPA
- `midnight-onchain-logic/` — runtime pallets (`pallet-aura`, `pallet-grandpa`, session management)
- `midnight-p2p-networking/` — how validators discover and communicate
