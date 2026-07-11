---
name: midnightskill
description: Set of skills for developing/building apps on Midnight Network. Always start with this skill to pick the right midnight skill for the task.
---

It is very likely that you have stale knowledge about building on Midnight Network. 

This file will guide to the right skill with the latest knowledge about Midnight Network.

**Need a specific topic?** Each skill below is standalone. Fetch only the ones relevant to your task. If you are starting from scratch, start with scaffold skill.

## What to Fetch by Task

| I'm doing... | Fetch these skills |
|--------------|-------------------|
<!-- SKILLS_REGISTRY:TASK_TABLE -->
| Set up Compact, Docker, and proof server before building | `midnight-environment-setup/` |
| Understand Midnight's architecture, privacy model, and ZK approach | `why-midnight/` |
| Integrate 1AM wallet for dust-free flow | `1am-wallet/` |
| Build a React app with wallet connect/disconnect via DApp Connector API | `react-wallet-connector/` |
| Write Compact smart contracts | `compact/` |
| Debug Compact contracts, read errors, manage versions | `testing/` |
| Build a single dApp targeting all networks from one codebase | `multinetwork/` |
| Wire up SDK providers, wallets, deploy/call contracts | `midnight-js/` |
| Query blockchain data, watch contract state, subscribe to events | `midnight-indexer/` |
| Privacy audit checklist, prevent data leaks, defensive Compact patterns | `midnight-security/` |
| Build a voting/poll dApp on Midnight targeting Android | `android-example-voting/` |
| Complete DApp reference: wallet, deploy, interact (use as template) | `example-counter/` |
| Build a complete Midnight Network hello-world DApp from scratch using Compact smart contract, headless Node.js tests with vitest, and testkit-js FluentWalletBuilder. | `hello-world/` |
| Build a privacy-preserving payment vault with 1AM wallet | `example-payment-dapp/` |
| Build a time-lock vault dApp on Midnight | `example-locker-dapp/` |
| Build a privacy-preserving leaderboard DApp on Midnight | `example-leaderboard-dapp/` |
| Build a private party RSVP dApp with privacy boundary on Midnight | `example-private-party-dapp/` |
| Build a private reserve auction dApp with hidden reserve price and private bidders | `example-private-reserve-auction/` |
| Build a ZK loan application with attestation on Midnight | `example-zk-loan-application/` |
| Build NFTs (shielded + unshielded) with OpenZeppelin | `nft/` |
| Token transfers, balance flows, multi-party txs | `token-transfers/` |
| Understand Midnight consensus — AURA, GRANDPA, and Partnerchain validators | `midnight-consensus/` |
| Explain Midnight node cryptography — hashes and signature schemes | `midnight-cryptography/` |
| Explain Midnight on-chain logic — runtime, pallets, and pallet-midnight | `midnight-onchain-logic/` |
| Configure or debug Midnight P2P networking and peer discovery | `midnight-p2p-networking/` |
| Query Midnight node RPC — contract state, ZSwap, and ledger methods | `midnight-rpc/` |
| Explain Midnight on-chain storage — ParityDB, trie, and state roots | `midnight-storage/` |
| Explain Midnight transaction lifecycle — proofs, pool, and execution | `midnight-transactions/` |
<!-- /SKILLS_REGISTRY:TASK_TABLE -->
## Skills

<!-- SKILLS_REGISTRY:SECTIONS -->
### [1AM Wallet](/.agents/skills/1am-wallet/SKILL.md)
- Detect, connect, and wire 1AM browser extension into frontend.
- Provider setup, contract deployment, and dust-free transaction flow.

### [Android Example Voting](/.agents/skills/android-example-voting/SKILL.md)
- Build a voting/poll dApp on Midnight using the Kuira Android SDK.
- Compact smart contract, passkey-derived identity, embedded wallet, Compose UI, on-device ZK proving.

### [Compact](/.agents/skills/compact/SKILL.md)
- The four mandatory pieces of every contract, type system, circuits as constraints.
- Witnesses, `disclose()`, ledger ADTs, standard library, and security patterns.

### [Example Counter](/.agents/skills/example-counter/SKILL.md)
- Complete DApp reference: headless wallet, CLI, counter contract.
- DUST generation, deploy, interaction, standalone mode.

### [Example Hello World](/.agents/skills/example-hello-world/SKILL.md)
- Build a complete Midnight Network hello-world DApp from scratch using Compact smart contract, headless Node.js tests with vitest, and testkit-js FluentWalletBuilder.

### [Example Leaderboard Dapp](/.agents/skills/example-leaderboard-dapp/SKILL.md)
- Arcade leaderboard with privacy modes, `persistentHash` owner commitments, and `verifyOwnership` ZK proofs.
- Next.js + 1AM wallet template with indexer reads and low-level deploy/call.

### [Example Locker Dapp](/.agents/skills/example-locker-dapp/SKILL.md)
- Time-lock vault: lock unshielded NIGHT until a Unix deadline; beneficiary releases via `blockTimeGte` and witness auth.

### [Example Payment Dapp](/.agents/skills/example-payment-dapp/SKILL.md)
- Build a privacy-preserving payment vault: users deposit/withdraw tNIGHT through a Compact smart contract with zero gas fees via the 1AM wallet.

### [Example Private Party Dapp](/.agents/skills/example-private-party-dapp/SKILL.md)
- Private RSVP with `persistentCommit` and DApp-specific public keys — no witnesses.
- Unshielded NIGHT check-in crosses the privacy boundary; Next.js + 1AM frontend template.
- Official vitest devnet test harness in `example-private-party` repo.

### [Example Private Reserve Auction](/.agents/skills/example-private-reserve-auction/SKILL.md)
- Hidden reserve price via persistentCommit, public bids with private bidder identities.
- Map/Counter tracking, auction auto-close, privacy boundary on claim via unshielded payment.
- Next.js + 1AM wallet frontend with seller/bidder role cards and indexer polling.

### [Example ZK Loan Application](/.agents/skills/example-zk-loan-application/SKILL.md)
- Private credit scoring with Schnorr attestation — score, income, and tenure never touch the ledger.
- Monorepo: Compact contract + attestation API + CLI; optional Next.js + 1AM frontend (leaderboard-dapp pattern).

### [Indexer](/.agents/skills/indexer/SKILL.md)
- GraphQL queries and subscriptions, contract state reads, transaction lookups.
- Real-time event watching, offset/null bug workaround, TypeScript helpers.

### [Midnight Consensus](/.agents/skills/midnight-consensus/SKILL.md)
- Modified Substrate consensus: AURA for block production, GRANDPA for finality.
- Custom validator set with Cardano SPO delegation and optional permissioned validators.

### [Midnight Cryptography](/.agents/skills/midnight-cryptography/SKILL.md)
- Blake2-256 for block hashes; twoxhash for trie storage keys.
- sr25519 (AURA), ECDSA (Partnerchain), Ed25519 (GRANDPA + libp2p).

### [Midnight Environment Setup](/.agents/skills/midnight-environment-setup/SKILL.md)
- Detect OS, shell, Docker, VS Code, and Compact; install missing tooling automatically.
- Configure PATH, update compiler, start proof server, and verify the full dev stack.

### [Midnight.js](/.agents/skills/midnight-js/SKILL.md)
- TypeScript SDK: provider wiring, wallet SDK (HDWallet, WalletFacade, Shielded/Unshielded/Dust).
- Contract deployment, circuit calls, DUST generation, private state, testkit.

### [Multinetwork](/.agents/skills/multinetwork/SKILL.md)
- Unified provider builder, wallet abstraction, proof server routing.
- Contract registry, deploy scripts, DUST flow per network.

### [NFT](/.agents/skills/nft/SKILL.md)
- Build shielded and unshielded NFTs on Midnight.
- OpenZeppelin NonFungibleToken, mint, transfer, metadata, privacy patterns.

### [Onchain Logic and State](/.agents/skills/midnight-onchain-logic/SKILL.md)
- Polkadot SDK WASM runtime with FRAME pallets including pallet-midnight.
- Proof verification, ZSwap and contract ops, Patricia-Merkle state commitments.

### [P2P Networking](/.agents/skills/midnight-p2p-networking/SKILL.md)
- Bootstrap, mDNS, and Kademlia DHT discovery strategies.
- Noise + Yamux upgrades; Ping, Request-Response, and Notification substreams.

### [React Wallet Connector](/.agents/skills/react-wallet-connector/SKILL.md)
- Scaffold a React + Vite app with DApp Connector API wallet connection.
- `window.midnight` enumeration, connect/disconnect UI, unshielded address display.

### [RPC Interface](/.agents/skills/midnight-rpc/SKILL.md)
- Custom midnight_* JSON-RPC methods for contract and ledger state.
- Polkadot SDK defaults, Partnerchain RPCs, and validator RPC security.

### [Security](/.agents/skills/security/SKILL.md)
- Privacy audit checklist, data leak patterns, commitment/nullifier design.
- Witness trust, front-running resistance, transaction semantics.

### [Storage](/.agents/skills/midnight-storage/SKILL.md)
- ParityDB key-value store with Patricia-Merkle trie state commitments.
- twoxhash for fast storage keys; inclusion proofs for on-chain data.

### [Testing](/.agents/skills/testing/SKILL.md)
- Static vs dynamic errors, reading compiler messages, `--skip-zk` dev loop.
- Version management across 6 components, common debugging patterns.

### [Token Transfers](/.agents/skills/token-transfers/SKILL.md)
- Shielded and unshielded token transfers.
- Balance queries, multi-party flows, transaction semantics.

### [Transactions](/.agents/skills/midnight-transactions/SKILL.md)
- Unsigned proof-embedded transactions from the Midnight Ledger.
- Pool well-formedness → runtime proof verification → state commit.

### [Why Midnight](/.agents/skills/why-midnight/SKILL.md)
- Data protection blockchain with public/private state, selective disclosure, and zk-SNARKs.
- Why it exists, how it works, and the privacy guarantees it provides.
<!-- /SKILLS_REGISTRY:SECTIONS -->
