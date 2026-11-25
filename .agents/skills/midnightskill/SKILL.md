---
name: midnightskill
description: Set of skills for developing/building apps on Midnight Network. Always start with this skill to pick the right midnight skill for the task.
---

It is very likely that you have stale knowledge about building on Midnight Network. 

This file will guide to the right skill with the latest knowledge about Midnight Network.

## Start of every session: load the live version pins

**Package versions and SDK signatures in these skills are point-in-time.** Before you install, pin, or write version-dependent code, fetch the current tested set once per session:

```bash
curl -fsS --max-time 5 https://midskills.sevryn.xyz/api/versions
```

It returns the same JSON shape as `references/versions.json` (`toolchain`, `packages`, `nodePackages`, `removed`, `scopeNote`). No key, no identifiers sent.

- **It answered:** use those pins for the rest of the session. Where a skill's inline version differs, the live value wins; mention the difference to the user once.
- **It failed** (offline, timeout, non-JSON): fall back to `midnight-version-matrix/` (the copy from the last skills release) and say you are using the offline set.
- **Never** install `@latest`, and never guess a version that is in neither. The [support matrix](https://docs.midnight.network/relnotes/support-matrix) outranks both; see `references/volatile.md`.

Then run `midnight-doctor/` on an existing project before debugging anything version-shaped, and use `midnight-common-errors/` to decode error messages.

**Need a specific topic?** Each skill below is standalone. Fetch only the ones relevant to your task. If you are starting from scratch, start with scaffold skill.

## What to Fetch by Task

Skills are split into two tracks. Building a dApp? Stay in **Build a dApp**. **Protocol internals** explain how the node works and are not needed to ship a dApp.

<!-- SKILLS_REGISTRY:TASK_TABLE -->
### Build a dApp

Everything you need to write, test, and ship a Midnight dApp: setup, Compact, wallets, SDK, and full templates.

| I'm doing... | Fetch these skills |
|--------------|-------------------|
| Set up Compact, Docker, and proof server before building | `midnight-environment-setup/` |
| Understand Midnight's architecture, privacy model, and ZK approach | `why-midnight/` |
| Compare ZK vs FHE vs MPC for privacy-preserving computation | `zk-vs-fhe-vs-mpc/` |
| Integrate 1AM wallet for dust-free flow | `1am-wallet/` |
| Build a React app with wallet connect/disconnect via DApp Connector API | `react-wallet-connector/` |
| Integrate Dynamic.xyz Midnight wallets (external 1AM or embedded MPC) | `dynamic-midnight-wallet/` |
| Connect a dApp to Gero Wallet (DApp Connector, DUST, proof servers) | `gero-wallet/` |
| Build and run the Midnight Passport foundations dApp | `example-passport-dapp/` |
| Integrate Midnight Passport (passkey Night ID + custody account) | `midnight-passport/` |
| Write Compact smart contracts | `compact/` |
| Debug Compact contracts, read errors, manage versions | `testing/` |
| Look up an error message or code and fix it | `midnight-common-errors/` |
| Pick package versions that work together, or upgrade safely | `midnight-version-matrix/` |
| Check my setup and project against the tested versions | `midnight-doctor/` |
| Run a pre-ship security and privacy gate | `midnight-security-checklist/` |
| Decide what to test and find gaps before a release | `midnight-testing-checklist/` |
| Build or fix Compact parsers, grammars, highlighters, or language servers | `compact-language-engineering/` |
| Build a single dApp targeting all networks from one codebase | `multinetwork/` |
| Wire up SDK providers, wallets, deploy/call contracts | `midnight-js/` |
| Sponsor DUST fees so users with zero DUST can transact (gasless UX) | `dust-gas-sponsorship/` |
| Query blockchain data, watch contract state, subscribe to events | `midnight-indexer/` |
| Integrate Ankr RPC for Midnight testnet and mainnet | `ankr-midnight/` |
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
| Plan or write a MIP/MPS, or check a MIP's status | `midnight-mip-planning/` |

### Protocol internals

How the Midnight node works under the hood (consensus, storage, networking, runtime, RPC, transactions). For node operators and the protocol-curious. You do not need these to build a dApp.

| I'm doing... | Fetch these skills |
|--------------|-------------------|
| Understand Midnight consensus — AURA, GRANDPA, and Partnerchain validators | `midnight-consensus/` |
| Explain Midnight node cryptography — hashes and signature schemes | `midnight-cryptography/` |
| Explain Midnight on-chain logic — runtime, pallets, and pallet-midnight | `midnight-onchain-logic/` |
| Configure or debug Midnight P2P networking and peer discovery | `midnight-p2p-networking/` |
| Query Midnight node RPC — contract state, ZSwap, and ledger methods | `midnight-rpc/` |
| Explain Midnight on-chain storage — ParityDB, trie, and state roots | `midnight-storage/` |
| Explain Midnight transaction lifecycle — proofs, pool, and execution | `midnight-transactions/` |
<!-- /SKILLS_REGISTRY:TASK_TABLE -->
<!-- SKILLS_REGISTRY:SECTIONS -->
## Skills: Build a dApp

### [1AM Wallet](/.agents/skills/1am-wallet/SKILL.md)
- Detect, connect, and wire 1AM browser extension into frontend.
- Provider setup, contract deployment, and dust-free transaction flow.

### [Android Example Voting](/.agents/skills/android-example-voting/SKILL.md)
- Build a voting/poll dApp on Midnight using the Kuira Android SDK.
- Compact smart contract, passkey-derived identity, embedded wallet, Compose UI, on-device ZK proving.

### [Ankr Midnight RPC](/.agents/skills/ankr-midnight/SKILL.md)
- Create Ankr project, copy HTTPS/WSS Midnight endpoints with API key.
- JSON-RPC client for midnight_*, system_*, chain_*; wire into midnight-js node URL.

### [Common Errors](/.agents/skills/midnight-common-errors/SKILL.md)
- Error string or numeric code in; cause, fix, and the skill that explains it out.
- Covers compiler, runtime, Midnight.js, wallets, indexer, node rejections, Docker, and Next.js.

### [Compact](/.agents/skills/compact/SKILL.md)
- The four mandatory pieces of every contract, type system, circuits as constraints.
- Witnesses, `disclose()`, ledger ADTs, standard library, and security patterns.

### [Compact Language Engineering](/.agents/skills/compact-language-engineering/SKILL.md)
- Grammar source of truth (parser.ss/lexer.ss at the toolchain tag), full token spec, precedence table, verified ambiguity hazards.
- tree-sitter-compact gaps, Grammar-Kit/JFlex port, Nite LSP design, differential test harness with the compiler as oracle.

### [Doctor](/.agents/skills/midnight-doctor/SKILL.md)
- Read-only script: Node, Compact devtools/toolchain, Docker images, proof server, package.json pins, pragmas.
- FAIL/WARN report with one exact fix per finding; run it before debugging version errors.

### [DUST Gas Sponsorship](/.agents/skills/dust-gas-sponsorship/SKILL.md)
- Two-sided flow: user balances ['shielded','unshielded'] and finalizes, sponsor balances ['dust'] and submits.
- Sponsor service policy (auth, rate limit, cap, contract check), DUST sizing and monitoring, NIGHTGATE and Capacity Exchange.

### [Dynamic Midnight Wallet](/.agents/skills/dynamic-midnight-wallet/SKILL.md)
- DynamicContextProvider + MidnightWalletConnectors or DynamicWaasMidnightConnectors.
- Three surfaces (unshielded, shielded, DUST), balances, sendBalance, registerDust.

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

### [Example Passport Dapp](/.agents/skills/example-passport-dapp/SKILL.md)
- Clone templates/passport-dapp; Docker localnet + Compact + Vite one-command demo.
- Passkey onboarding, identity registry, deposit_night, restore, E2E checks.

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

### [Gero Wallet](/.agents/skills/gero-wallet/SKILL.md)
- Standard DApp Connector detection (UUID keys, apiVersion 4), session reuse, delegated proving.
- In-wallet DUST from NIGHT/cNIGHT, proof-server choice, Stagenet; Ledger 9 support NEEDS CHECK.

### [Indexer](/.agents/skills/indexer/SKILL.md)
- GraphQL queries and subscriptions, contract state reads, transaction lookups.
- Real-time event watching, offset/null bug workaround, TypeScript helpers.

### [Midnight Environment Setup](/.agents/skills/midnight-environment-setup/SKILL.md)
- Detect OS, shell, Docker, VS Code, and Compact; install missing tooling automatically.
- Configure PATH, update compiler, start proof server, and verify the full dev stack.

### [Midnight Passport](/.agents/skills/midnight-passport/SKILL.md)
- WebAuthn PRF device secrets, per-user custody Compact contracts, Night ID registry.
- PassportAccount + IdentityRegistry client APIs, witnesses, session rules (no secret storage).

### [Midnight.js](/.agents/skills/midnight-js/SKILL.md)
- TypeScript SDK: provider wiring, wallet SDK (HDWallet, WalletFacade, Shielded/Unshielded/Dust).
- Contract deployment, circuit calls, DUST generation, private state, testkit.

### [MIP Planning](/.agents/skills/midnight-mip-planning/SKILL.md)
- MIP vs MPS vs CoIP, the real template, editor feedback patterns, and the Draft → Proposed → Accepted → Active path.
- Skill verdicts (BUILDABLE NOW / DRAFT AGAINST PROPOSAL / WATCH / NO MIP) and the MidSkills-to-MIP watchlist.

### [Multinetwork](/.agents/skills/multinetwork/SKILL.md)
- Unified provider builder, wallet abstraction, proof server routing.
- Contract registry, deploy scripts, DUST flow per network.

### [NFT](/.agents/skills/nft/SKILL.md)
- Build shielded and unshielded NFTs on Midnight.
- OpenZeppelin NonFungibleToken, mint, transfer, metadata, privacy patterns.

### [React Wallet Connector](/.agents/skills/react-wallet-connector/SKILL.md)
- Scaffold a React + Vite app with DApp Connector API wallet connection.
- `window.midnight` enumeration, connect/disconnect UI, unshielded address display.

### [Security](/.agents/skills/security/SKILL.md)
- Privacy audit checklist, data leak patterns, commitment/nullifier design.
- Witness trust, front-running resistance, transaction semantics.

### [Security Checklist](/.agents/skills/midnight-security-checklist/SKILL.md)
- Pass/fail checklist over disclosure, crypto, witnesses, auth, transaction phases, keys, and deploy.
- Each item links to the midnight-security section that explains it.

### [Testing](/.agents/skills/testing/SKILL.md)
- Static vs dynamic errors, reading compiler messages, `--skip-zk` dev loop.
- Version management across 6 components, common debugging patterns.

### [Testing Checklist](/.agents/skills/midnight-testing-checklist/SKILL.md)
- Checklist across --skip-zk logic tests, negative/privacy tests, devnet E2E with testkit-js, frontend, and CI.
- Names the missing tests and links to the skills that show how to write them.

### [Token Transfers](/.agents/skills/token-transfers/SKILL.md)
- Shielded and unshielded token transfers.
- Balance queries, multi-party flows, transaction semantics.

### [Version Compatibility Matrix](/.agents/skills/midnight-version-matrix/SKILL.md)
- Pinned toolchain, language version, packages, and Docker images as one tested set.
- Exact install commands, package scopes, and removed packages. Live copy at /api/versions.

### [Why Midnight](/.agents/skills/why-midnight/SKILL.md)
- Data protection blockchain with public/private state, selective disclosure, and zk-SNARKs.
- Why it exists, how it works, and the privacy guarantees it provides.

### [ZK vs FHE vs MPC](/.agents/skills/zk-vs-fhe-vs-mpc/SKILL.md)
- Tradeoffs across zero-knowledge proofs, fully homomorphic encryption, and secure multi-party computation.
- When each fits a privacy DApp, and why Midnight uses zk-SNARKs via Compact.

## Skills: Protocol internals

### [Midnight Consensus](/.agents/skills/midnight-consensus/SKILL.md)
- Modified Substrate consensus: AURA for block production, GRANDPA for finality.
- Custom validator set with Cardano SPO delegation and optional permissioned validators.

### [Midnight Cryptography](/.agents/skills/midnight-cryptography/SKILL.md)
- Blake2-256 for block hashes; twoxhash for trie storage keys.
- sr25519 (AURA), ECDSA (Partnerchain), Ed25519 (GRANDPA + libp2p).

### [Onchain Logic and State](/.agents/skills/midnight-onchain-logic/SKILL.md)
- Polkadot SDK WASM runtime with FRAME pallets including pallet-midnight.
- Proof verification, ZSwap and contract ops, Patricia-Merkle state commitments.

### [P2P Networking](/.agents/skills/midnight-p2p-networking/SKILL.md)
- Bootstrap, mDNS, and Kademlia DHT discovery strategies.
- Noise + Yamux upgrades; Ping, Request-Response, and Notification substreams.

### [RPC Interface](/.agents/skills/midnight-rpc/SKILL.md)
- Custom midnight_* JSON-RPC methods for contract and ledger state.
- Polkadot SDK defaults, Partnerchain RPCs, and validator RPC security.

### [Storage](/.agents/skills/midnight-storage/SKILL.md)
- ParityDB key-value store with Patricia-Merkle trie state commitments.
- twoxhash for fast storage keys; inclusion proofs for on-chain data.

### [Transactions](/.agents/skills/midnight-transactions/SKILL.md)
- Unsigned proof-embedded transactions from the Midnight Ledger.
- Pool well-formedness → runtime proof verification → state commit.
<!-- /SKILLS_REGISTRY:SECTIONS -->
