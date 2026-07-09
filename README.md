# Midnight Skills

Public skills registry for AI agents building on Midnight Network. Each skill is a standalone `SKILL.md` that agents fetch and follow.

The **MIDSKILLS** marketplace UI is a separate Next.js app (`midskills/` during migration). This repository is the source of truth for skill content and the published registry bundle.

## Skills

| Skill | Description |
|-------|-------------|
<!-- SKILLS_REGISTRY:README_TABLE -->
| [1AM Wallet](.agents/skills/1am-wallet/SKILL.md) | Integrate 1AM wallet for dust-free contract deployment and transaction flow on Midnight Network. |
| [Android Example Voting](.agents/skills/android-example-voting/SKILL.md) | Build a voting/poll dApp on Midnight Network using the Kuira Android SDK — Compact smart contract with create/cast/close circuits, passkey-derived identity, embedded wallet, Compose UI, reactive ledger reads via observeLedger(), and on-device ZK proving. |
| [Compact](.agents/skills/compact/SKILL.md) | The Compact smart contract language for Midnight Network. TypeScript-like DSL that compiles to ZK circuits. |
| [Example Counter](.agents/skills/example-counter/SKILL.md) | Complete Midnight DApp reference — headless wallet, CLI, counter contract, DUST generation, deploy, interaction. |
| [Example Hello World](.agents/skills/example-hello-world/SKILL.md) | Build a complete Midnight Network hello-world DApp from scratch with Compact, vitest, and FluentWalletBuilder. |
| [Example Leaderboard Dapp](.agents/skills/example-leaderboard-dapp/SKILL.md) | Privacy-preserving arcade leaderboard: submit scores with anonymous/public/custom names and prove ownership via ZK. |
| [Example Locker Dapp](.agents/skills/example-locker-dapp/SKILL.md) | Time-lock vault dApp: lock unshielded NIGHT until a Unix deadline; beneficiary releases via blockTimeGte. |
| [Example Payment Dapp](.agents/skills/example-payment-dapp/SKILL.md) | Privacy-preserving payment vault: deposit/withdraw tNIGHT via Compact + 1AM wallet. |
| [Example Private Party Dapp](.agents/skills/example-private-party-dapp/SKILL.md) | Private party RSVP dApp: persistentCommit guest list, DApp-specific public keys, unshielded NIGHT privacy boundary, Next.js + 1AM wallet. |
| [Example ZK Loan Application](.agents/skills/example-zk-loan-application/SKILL.md) | Zero-knowledge loan dApp: privately evaluate credit data with Schnorr attestation, record only loan outcomes on-chain. |
| [Indexer](.agents/skills/indexer/SKILL.md) | Query and subscribe to Midnight blockchain data via Indexer GraphQL API v4. |
| [Midnight Consensus](.agents/skills/midnight-consensus/SKILL.md) | AURA block production, GRANDPA finality, and Cardano Partnerchain validator selection with SPO stake delegation. |
| [Midnight Cryptography](.agents/skills/midnight-cryptography/SKILL.md) | Node cryptographic primitives — Blake2-256, sr25519, ECDSA, Ed25519, and twoxhash storage keys. |
| [Midnight.js](.agents/skills/midnight-js/SKILL.md) | TypeScript SDK — provider wiring, wallet SDK, contract deployment, DUST flow, testkit. |
| [Multinetwork](.agents/skills/multinetwork/SKILL.md) | Build a single dApp that deploys across all networks (localnet, preview, preprod, mainnet) from one codebase. |
| [NFT](.agents/skills/nft/SKILL.md) | Build shielded and unshielded NFTs on Midnight using OpenZeppelin Compact contracts. |
| [Onchain Logic and State](.agents/skills/midnight-onchain-logic/SKILL.md) | WASM runtime, FRAME pallets, pallet-midnight ledger state machine, and proof-based state transitions. |
| [P2P Networking](.agents/skills/midnight-p2p-networking/SKILL.md) | libp2p peer discovery, TCP/WebSocket transport, Noise encryption, Yamux multiplexing, and gossip protocols. |
| [React Wallet Connector](.agents/skills/react-wallet-connector/SKILL.md) | Scaffold a React + Vite app with DApp Connector API wallet connection, connect/disconnect UI, and unshielded address display. |
| [RPC Interface](.agents/skills/midnight-rpc/SKILL.md) | JSON-RPC methods for contract state, ZSwap chain state, ledger version, Polkadot SDK defaults, and Partnerchain RPCs. |
| [Security](.agents/skills/security/SKILL.md) | Privacy audit checklist, data leak patterns, defensive Compact patterns. |
| [Storage](.agents/skills/midnight-storage/SKILL.md) | ParityDB backend, Patricia-Merkle trie state commitments, and twoxhash storage key generation. |
| [Testing](.agents/skills/testing/SKILL.md) | Debug Compact contracts and manage toolchain versions. Static vs dynamic errors, version sync, common traps. |
| [Token Transfers](.agents/skills/token-transfers/SKILL.md) | Shielded and unshielded token transfers, balance queries, multi-party flows on Midnight. |
| [Transactions](.agents/skills/midnight-transactions/SKILL.md) | Proof-based unsigned ledger transactions, pool validation, runtime verification, and state commit lifecycle. |
| [Why Midnight](.agents/skills/why-midnight/SKILL.md) | What Midnight is, why it exists, and how it works — public/private state, selective disclosure, and ZK proofs. |
<!-- /SKILLS_REGISTRY:README_TABLE -->

## Architecture

<!-- SKILLS_REGISTRY:ARCHITECTURE -->
- **Registry:** `skills.json` — single source of truth for skills, learning paths, and site metadata
- **Content:** Skill folders, `references/`, and `templates/` in this repository
- **CI:** GitHub Actions validate on PR; publish a versioned registry bundle on release tags
- **UI:** [MIDSKILLS](https://midnight-skills.netlify.app) Next.js app (separate repo) consumes the published registry at build time
- **Agents:** Install skill folders via npm package or fetch from GitHub
<!-- /SKILLS_REGISTRY:ARCHITECTURE -->

## Repository layout

```
skills.json          # Registry manifest
SKILL.md             # Router skill for agents
compact/             # Example skill folder
references/          # Shared docs (provider wiring, gotchas)
templates/           # Runnable dApp templates
scripts/             # validate, sync, package registry
midskills/           # Next.js UI (standalone — publish as private repo; see midskills/README.md)
```

## Prerequisites

- Node.js >= 22

## Local commands

```bash
npm run validate:registry   # Check skills.json + on-disk paths
npm run sync:registry       # Update router docs, README table, package.json
npm run package:registry    # Build dist/registry/ + tarball (for UI consumers)
```

## Publish registry

<!-- SKILLS_REGISTRY:REGISTRY -->
1. Edit `skills.json` and skill folders
2. Run `npm run validate:registry`
3. Run `npm run sync:registry` to update router docs and `package.json`
4. Open a PR — CI validates the registry
5. Tag `v*` on `main` to publish `midnight-skills-registry-<version>.tar.gz` as a GitHub Release asset
<!-- /SKILLS_REGISTRY:REGISTRY -->

**Shared dApp references** live in `references/` — provider wiring and gotchas used by payment, locker, and wallet skills.

**Runnable templates** live in `templates/` — linked from skills via `templatePath` in `skills.json`.

## Contributing

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for contribution rules and a step-by-step guide to adding a new skill.

Quick summary: create `your-skill/SKILL.md` → register in `skills.json` → run `npm run sync:registry` → open a PR.

## License

MIT License

Copyright 2026 Tusharpamnani, Kali-Decoder

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
