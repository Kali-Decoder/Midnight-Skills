# MidSkills skills to MIPs mapping

**Source:** `midnightntwrk/midnight-improvement-proposals` at commit `eb62664` (20 Nov 2026), read 22 Nov 2026. Every status below is taken from the file's front matter, and every relationship from its `Requires` / `MPS` / `MIP` fields. MIP-0010 and MIP-0027 (protocol core, no developer build surface) were not read in full.

**Re-check this file on every MidSkills refresh** with the status script in `../SKILL.md` §2. A status change here is the earliest signal that a skill needs updating.

## Verdicts

| Verdict | Meaning |
|---|---|
| **BUILDABLE NOW** | The MIP behind it is Accepted, or what it teaches is live code. Build the skill and cite the MIP as canonical. |
| **DRAFT AGAINST PROPOSAL** | The MIP is Proposed: the spec is detailed but can still move. Build the skill, **state the MIP's status inside it**, and re-check on every refresh. |
| **WATCH** | Draft MIP, or an MPS with no MIP yet. No skill until the spec firms up; track it below. |
| **NO MIP** | A third-party product or integration. Ground the skill in the project's own docs; cite adjacent MIPs as context only. |

Rule: the skill teaches how to build, the MIP defines the standard. Never restate a spec from memory when the MIP is the source.

## Headline

Only **4 of 33** numbered MIPs are Accepted: MIP-0001 (the process), MIP-0002 (contract log emission, the Ledger 9 `emit`), MIP-0003 (ECDSA support, the Ledger 9 native secp256k1 verify), and MIP-0018 (on-chain token metadata). The 33 include MIP-0028 (*custom-spend-logic*), which is assigned "in review" with no file yet. Everything else developer-facing is Proposed or Draft. On the MPS side, MPS-0001 (the MPS process) and MPS-0012 (account aliasing) are Accepted.

## Planned skills

### ZSwap + Offer Files — DRAFT AGAINST PROPOSAL

| Doc | Status | Note |
|---|---|---|
| MIP-0005 Offer Files | Proposed (Feb 2026) | The offer-file format spec |
| MIP-0006 Peer-to-Peer Atomic Swaps | Proposed (Feb 2026) | The swap flow offer files enable |
| MIP-0017 Signature-Authorized Shielded Spends with VRF Nullifiers | Proposed (Aug 2026) | Answers MPS-0035; lists MIP-0005/0006 as related and says their flows remain supported |
| MPS-0013 zswap business logic | Proposed (May 2026), no MIP | The open item: no canonical spec for ZSwap business logic yet |

Build on the ZSwap protocol as shipped, plus offer files per MIP-0005 with its Proposed status stated. Do not invent ZSwap business logic: MPS-0013 has no MIP.

### Ledger 9 Compact — BUILDABLE NOW (core), WATCH (phase 2)

| Doc | Status | Note |
|---|---|---|
| MIP-0002 Public Contract Log Emission | **Accepted** (May 2026) | The `emit` in Ledger 9; answers MPS-0005 |
| MIP-0003 ECDSA signature support | **Accepted** (May 2026) | Native secp256k1 verify in Ledger 9 |
| MIP-0019 Multipart Event | Proposed (Sep 2026) | Requires MIP-0002 |
| MPS-0021 Phase 2 contract-to-contract | Proposed (Aug 2026) | Answered by MIP-0025 Managed Private State and Capsule Runtime (**Draft**). Phase 2 is not Ledger 9 |
| MPS-0029 Caller identity in Compact circuits | Proposed (Jun 2026), no MIP | `kernel.caller()` shipped in Ledger 9; the MPS is still open |
| MPS-0040 Cross-contract call provenance | Proposed (Sep 2026), no MIP | Context for C2C security notes |
| MPS-0022 Standard contract representation | Proposed (Jun 2026), no MIP | Tooling future |
| MPS-0047 Multi-environment Compact releases | Proposed (Oct 2026), no MIP | Tooling future |

The Ledger 9 core (events, ECDSA, contract-to-contract calls as shipped in Compact 0.36.1) is buildable now on two Accepted MIPs; see the `compact/` and `security/` skills. Capsule runtime and caller-identity-as-spec are watch items.

### Fee Abstraction — DRAFT AGAINST PROPOSAL (product), WATCH (standards)

| Doc | Status | Note |
|---|---|---|
| MPS-0031 Community-Governed DUST Grant DAO | Proposed (Jul 2026), no MIP | No spec yet |
| MIP-0033 Scoped Grants and dApp Connection for Custody Accounts | **Draft** (Sep 2026) | Requires MIP-0012, MIP-0013, MIP-0030 |
| MIP-0012 / MIP-0013 custody | Proposed (Jul 2026) | The custody-account base scoped grants build on |

Ground the skill in the live products, because no MIP defines fee abstraction. The DUST DAO and scoped grants are watch items.

### Third-party wallet (e.g. Gero) — NO MIP

Context only:

| Doc | Status | Note |
|---|---|---|
| MIP-0015 Wallet-derived deterministic secrets | Proposed (Aug 2026) | How wallets derive secrets |
| MIP-0031 Midnight Message Signing | Proposed (Sep 2026) | Requires MIP-0003; cite when covering signing |
| MIP-0008 CAIP-2 Network Identifiers | **Draft** (May 2026) | Answers MPS-0003; chain IDs for wallet integration |

Build from the wallet's own docs. Do not present these MIPs as the wallet spec.

### Shielded Tokens — DRAFT AGAINST PROPOSAL

| Doc | Status | Note |
|---|---|---|
| MIP-0011 Native Shielded Token Standard | Proposed (Jun 2026) | Authors from OpenZeppelin; the standard to teach |
| MIP-0014 Native Unshielded Token Standard | Proposed (Jul 2026) | The unshielded companion |
| MIP-0004 Fungible Token Standard with UTXO Conversion | **Draft** (Mar 2026) | Older draft; MIP-0011/0014 are the live direction |
| MIP-0018 On-Chain Token Metadata Emission | **Accepted** (Sep 2026; vote 17 Nov 2026) | Requires MIP-0002; buildable now |
| MPS-0006 Institutional custody for native shielded assets | Proposed (May 2026), no MIP | Custody angle |

Teach MIP-0011 as the draft standard with its status stated, pair it with MIP-0014, and cover MIP-0018 metadata as the buildable part. When MIP-0011 is Accepted, the skill graduates.

### DUST — NO MIP

No MIP defines DUST. Ground it in the live architecture and the Managing DUST guide. "Where this is heading" notes: MPS-0031 DUST Grant DAO (Proposed, no MIP) and MPS-0033 mNIGHT to cNIGHT (Proposed, answered by MIP-0023 Committee Bridge Consensus, Proposed).

### Midnames (name service, DIDs, credentials) — DRAFT AGAINST PROPOSAL

| Skill | Doc | Status | Note |
|---|---|---|---|
| Name resolver | MIP-0007 Name Service Registry and Resolver | Proposed (May 2026) | **Authored by Midnames**; the canonical registry and resolver standard; reference SDK `@midnames/sdk` |
| Name resolver | MPS-0012 Human-Readable Aliasing | **Accepted** (May 2026) | The problem MIP-0007 answers |
| did:midnight DIDs | MIP-0007 | Proposed | Names resolve to DIDs under the standard |
| did:midnight / agent identity | MIP-0029 Midnight Agent Identity Standard (MAIS) | Proposed (May 2026) | Answers MPS-0015 |
| Verifiable credentials | MIP-0032 Private Credential Registry and Soulbound Profile | Proposed (Jun 2026) | Answers MPS-0049 |
| Selective disclosure | MPS-0043 Selective Disclosure to a Chosen Party | Proposed (Sep 2026), no MIP | No canonical ZK selective-disclosure spec yet |

Build against MIP-0007, not just the SDK docs. This is the strongest mapping here: the integration partner wrote the standard, and the problem it answers is Accepted. Honesty flag: selective disclosure in `@midnames/vc` v1.0 RC is off-chain P-256 verification plus minimal disclosure, not ZK attribute proofs, and MPS-0043 confirms there is no canonical ZK selective-disclosure spec.

## Partner skills

| Skill | Verdict | Context |
|---|---|---|
| VIA Labs cross-chain | NO MIP | Protocol bridge context: MIP-0023 (Proposed), MIP-0008 (Draft). Not the VIA spec |
| NIGHTGATE / ODATANO | NO MIP | Adjacent: MPS-0031 (Proposed), MIP-0033 (Draft). Neither defines it |
| Sig Network | NO MIP | Crypto context: MIP-0003 (Accepted), MIP-0021 Domain-Separation Convention (Proposed), MIP-0031 (Proposed) |
| ZK Predicates pattern | DRAFT AGAINST PROPOSAL | MIP-0032 (Proposed), MPS-0043 (Proposed, no MIP), MPS-0049 (Proposed, answered by MIP-0032). Same honesty flag as selective disclosure |
| Private Governance | WATCH | MIP-0016 NIGHT Staking (**Draft**), MIP-0024 Block Production Rewards (Proposed, requires MIP-0023), MPS-0017 governance-observability (in review, no file). Nothing Accepted, no staking live |

## Existing skills: MIP anchors to cite

| Skill | MIP / MPS |
|---|---|
| `compact/`, `security/` | MIP-0002 (Accepted), MIP-0003 (Accepted), MIP-0019 (Proposed), MIP-0021 (Proposed) |
| `midnight-js/`, `indexer/` | MIP-0009 Lazy Contract State Query RPC (Proposed), MIP-0026 Interim Ledger State Management (Proposed) |
| proof server content | MPS-0004 Trusted proof serving (Proposed, no MIP), MIP-0020 On-Demand Prover Keys (Proposed) |
| `midnight-passport/`, `example-passport-dapp/` | The custody cluster (below) |
| `1am-wallet/`, `dynamic-midnight-wallet/`, `react-wallet-connector/` | MIP-0015 (Proposed), MIP-0031 (Proposed) |
| `multinetwork/` | MIP-0008 (Draft), MPS-0003 (Proposed) |
| `token-transfers/`, `nft/` | MIP-0011, MIP-0014 (Proposed), MIP-0018 (Accepted) |

### The custody cluster

MIP-0012 (contract custody), MIP-0013 (multi-key authorisation, requires 0012), MIP-0022 (recovery paths, requires 0012/0013), MIP-0030 (ECDSA authorisation, **Draft**, requires 0012/0013), and MIP-0033 (scoped grants, **Draft**, requires 0012/0013/0030). Together they form one family that answers **MPS-0018** (multi-key account custody), and MPS-0018 lists all five. The Passport skills teach the Foundation's localnet demo; this cluster defines how custody accounts will actually work. Note it with its Proposed/Draft status, and don't teach it as shipped.

## No MidSkills mapping

- MIP-0010 Aura to BABE migration, MIP-0027 Transaction Revalidation Cache: protocol core.
- MIP-0025 Capsule Runtime (Draft): future Compact execution model; watch for the post-Ledger 9 era.
- MIP-0026 Interim Ledger State (Proposed): core ledger work; indexer context only.
- MIP-0024 Block Production Rewards (Proposed): operator economics, except as Private Governance context.

## Watchlist: status changes that trigger skill work

| Change | Unlocks |
|---|---|
| MIP-0011 Proposed → Accepted | Shielded Tokens skill graduates to buildable |
| MIP-0005 Proposed → Accepted | Offer Files section of the ZSwap skill firms up |
| MIP-0007 Proposed → Accepted | Midnames skills graduate |
| MIP-0029 Proposed → Accepted | Agent Identity skill becomes buildable |
| MIP-0033 Draft → Proposed | Scoped grants enter the Fee Abstraction skill |
| MIP-0016 Draft → Proposed | Staking content becomes writable |
| MPS-0013 or MPS-0043 gains a MIP | ZSwap business logic / selective disclosure get a canonical spec |
| MIP-0012 / MIP-0013 Proposed → Accepted | Custody-account skills become buildable; Passport skills get a rewrite target |
| MIP-0002 / MIP-0003 / MIP-0018 → Implemented / Active | Update the `compact/`, `security/` and token skills to cite the new status |
