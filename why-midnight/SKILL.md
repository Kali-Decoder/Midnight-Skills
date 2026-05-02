---
name: why-midnight
description: What Midnight is, why it exists, and how it works (public/private state, selective disclosure, and zero-knowledge proofs).
---

# What is Midnight?

Midnight is a **data protection blockchain platform**. It addresses a fundamental challenge in blockchain technology: how to use the benefits of distributed ledgers while maintaining the privacy required for sensitive data.

Unlike traditional blockchains where every transaction is permanently visible to all participants, Midnight introduces **selective disclosure** — the ability to prove facts about data without revealing the data itself. This enables blockchain adoption in regulated industries like healthcare, finance, and government services where data protection is not just important, but legally required.

---

# Core concepts

## Data protection blockchain

Midnight maintains two parallel states:

- **Public state:** Traditional blockchain data stored on-chain, visible to all network participants. This includes transaction proofs, contract code, and any intentionally public information.
- **Private state:** Encrypted data stored locally by users, never exposed to the network. This includes personal information, business data, and any sensitive content that must remain confidential.

## Zero-knowledge proofs

The bridge between public and private states is zero-knowledge cryptography. Using zk-SNARKs (Zero-Knowledge Succinct Non-Interactive Arguments of Knowledge), Midnight can:

- Verify computations without seeing the input data
- Prove statements are true without revealing why they're true
- Generate compact proofs (**128 bytes**) regardless of computation complexity
- Validate proofs in milliseconds on-chain

For example:

- A healthcare application can prove a patient qualifies for treatment without revealing medical history.
- A financial system can verify sufficient account balance without exposing the actual amount.

## Compact programming language

Midnight introduces **Compact**, a domain-specific language based on TypeScript that makes privacy-preserving smart contracts accessible to mainstream developers. Instead of requiring cryptographic expertise, developers write familiar code that compiles into zero-knowledge circuits.

---

# Why Midnight

## Regulations require controlled data use

Privacy laws demand strong data protection, but public blockchains make all on-chain activity visible by default.

Frameworks such as GDPR, CCPA, and HIPAA require tight control over personal data. Midnight helps by enabling controlled, provable disclosure so teams can share only the information that is necessary.

## Public chains expose too much

Organizations need decentralization but cannot place sensitive information on fully open ledgers.

Public chains reveal balances, actions, and metadata on a shared ledger. Private chains improve confidentiality but reduce decentralization. Midnight combines public and private state, giving teams decentralization with programmable confidentiality.

## Privacy tooling is often inaccessible

Most teams cannot build ZK systems because they require specialized cryptographic expertise.

Traditional ZK development demands circuit design and proof-system knowledge. Midnight’s Compact language lowers this barrier by compiling TypeScript-like code into circuits and proofs automatically.

## Private computation must still be verifiable

Sensitive logic needs privacy, but it must still prove correctness to the network.

Midnight lets users compute on private data locally and submit zero-knowledge proofs instead of raw inputs. Validators verify correctness without learning the underlying data, preserving both privacy and trust.

---

# How Midnight works

## Transaction flow

When a user initiates a transaction on Midnight, the process follows a specific sequence to maintain privacy while ensuring validity:

1. Users perform computations on private data locally, never exposing it to the network.
2. The Midnight runtime generates a zero-knowledge proof of this computation.
3. This proof, along with any intended public outputs, is submitted to the blockchain.
4. Network validators verify the proof using the zk-SNARK verification algorithm (milliseconds on-chain).
5. Once verified, both public and private states update according to the proven computation — public state on-chain and private state in users' local storage.

## Network architecture

Midnight operates as a proof-of-stake blockchain. Validators can participate permissionlessly through stake delegation, contributing to network security while earning rewards.

The platform maintains a native bridge to Cardano for asset transfers, enabling interoperability between the two chains.

The network processes two types of transactions:

- Standard public transactions that function like traditional blockchain operations
- Shielded transactions that use zero-knowledge proofs to maintain privacy

Both transaction types are validated by the same set of validators, ensuring consistent security across the network.

## Privacy guarantees

Midnight implements several layers of privacy protection:

- **Data minimization:** only essential data goes on-chain; sensitive information remains in local storage.
- **Forward secrecy:** even if encryption keys are compromised in the future, past transactions remain private.
- **Selective disclosure:** users choose precisely what information to reveal and to whom.
- **Optional compliance mechanisms:** required reporting to authorities without compromising user privacy or exposing data to unauthorized parties.
