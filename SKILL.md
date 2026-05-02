---
name: zamaskill
description: Set of skills for developing/building apps on Zama FHEVM. Always start with this skill to pick the right Zama skill for the task.
---

It is very likely that you have stale knowledge about building on Zama FHEVM. 

This file will guide to the right skill with the latest knowledge about Zama FHEVM.

**Need a specific topic?** Each skill below is standalone. Fetch only the ones relevant to your task. If you are starting from scratch, start with scaffold skill.

## What to Fetch by Task

| I'm doing... | Fetch these skills |
|--------------|-------------------|
| Building a counter app with FHEVM Hardhat | `scaffold/` |
| Canonical addresses and services | `addresses/` |
| Public decryption flow | `decryption/` |
| Build a private token (ERC7984) | `private-token/` |
| Build a confidential vesting wallet | `vesting-wallet/` |
| Wrap ERC-20 into ERC-7984 | `erc20-wrapper/` |
| Build a confidential ERC-7984 token | `erc7984-standard/` |
| Build a confidential payroll system | `confidential-payroll/` |

## Skills

### [Addresses](/addresses/SKILL.md)
### [Addresses](/addresses/SKILL.md)
- Canonical Zama FHEVM Sepolia addresses and services.
- Never hallucinate an address. Wrong address = lost funds.

### [Scaffold](/scaffold/SKILL.md)
- End-to-end guide to build a Zama FHEVM counter app with Hardhat.
- Setup, Counter.sol, FHECounter tests.

### [Decryption](/decryption/SKILL.md)
- Public decryption workflow in Zama FHEVM.
- On-chain makePubliclyDecryptable, off-chain publicDecrypt, on-chain checkSignatures.
- Ordering constraints and verification pitfalls.

### [Private Token](/private-token/SKILL.md)
- Template for building a confidential ERC7984 token on Zama FHEVM.
- Contract, Hardhat config, deploy script, and npm scripts.

### [Vesting Wallet](/vesting-wallet/SKILL.md)
- Confidential vesting wallet example for ERC7984 tokens.
- Solidity contract + Hardhat test.

### [ERC-20 Wrapper](/erc20-wrapper/SKILL.md)
- Wrap a standard ERC-20 into a confidential ERC-7984.
- Solidity contract + Hardhat test.

### [ERC7984 Standard](/erc7984-standard/SKILL.md)
- Full Hardhat project template for ERC-7984 confidential token.
- Contract, tests, and deployment scripts.

### [Confidential Payroll](/confidential-payroll/SKILL.md)
- Full Hardhat project for private payroll with ERC7984 token.
- Contracts + deploy/fund/claim scripts.
