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
| Understand Midnight's architecture, privacy model, and ZK approach | `why-midnight/` |
| Debug Compact contracts, read errors, manage versions | `testing/` |
| Build a single dApp targeting all networks from one codebase | `multinetwork/` |
| Integrate 1AM wallet for dust-free flow | `1am-wallet/` |
| Write Compact smart contracts | `compact/` |
| Wire up SDK providers, wallets, deploy/call contracts | `midnight-js/` |


## Skills

### [Why Midnight](/why-midnight/SKILL.md)
- Data protection blockchain with public/private state, selective disclosure, and zk-SNARKs.
- Why it exists, how it works, and the privacy guarantees it provides.

### [1AM Wallet](/1am-wallet/SKILL.md)
- Detect, connect, and wire 1AM browser extension into frontend.
- Provider setup, contract deployment, and dust-free transaction flow.

### [Compact](/compact/SKILL.md)
- The four mandatory pieces of every contract, type system, circuits as constraints.
- Witnesses, `disclose()`, ledger ADTs, standard library, and security patterns.

### [Testing](/testing/SKILL.md)
- Static vs dynamic errors, reading compiler messages, `--skip-zk` dev loop.
- Version management across 6 components, common debugging patterns.

### [Multinetwork](/multinetwork/SKILL.md)
- Unified provider builder, wallet abstraction, proof server routing.
- Contract registry, deploy scripts, DUST flow per network.

### [Midnight.js](/midnight-js/SKILL.md)
- TypeScript SDK: provider wiring, wallet SDK (HDWallet, WalletFacade, Shielded/Unshielded/Dust).
- Contract deployment, circuit calls, DUST generation, private state, testkit.
