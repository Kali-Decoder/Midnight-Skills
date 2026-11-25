---
name: midnight-security-checklist
description: Pre-ship security and privacy gate for a Midnight dApp — a short pass/fail checklist over the Compact contract, witnesses, transaction semantics, frontend, and keys. Use before deploying to preprod or mainnet, before a release or audit, when reviewing a PR that touches a `.compact` file or witness, or when the user asks "is this contract safe / private enough to ship". Each item links to the midnight-security section that explains it.
---

# Midnight Security Checklist

A gate, not a tutorial: go through every box, mark it pass / fail / n.a., and report the failures. The *why* and the fixes live in `midnight-security/` (section numbers below).

**What this skill produces:** a filled checklist with a verdict (`ship` / `fix first`) and one line per failed item.

## Workflow

1. List every `.compact` file, every witness implementation (`witnesses.ts`), and every place the frontend handles secrets.
2. Walk sections A–F in order. Answer each item for **each** contract; quote the line when something fails.
3. Any fail in A, B, or C blocks a mainnet deploy. Fails in D–F are reported with a severity.
4. Run `midnight-testing-checklist` too: every security property you rely on needs a negative test that proves it.
5. Report: the verdict, then the failures with file:line and the matching `midnight-security` section.

## A. What is public (midnight-security §1–§4)

- [ ] Every `export ledger` field is meant to be public; per-user data that only its owner needs stays in private state.
- [ ] No sensitive value is a circuit **argument** (all arguments are in the public transcript); secrets come from witnesses.
- [ ] Every `disclose()` is intentional: you can say in one sentence why that value may become public.
- [ ] `Map` keys are not sensitive (keys are public on insert and lookup).
- [ ] Anonymous membership uses `MerkleTree` / `HistoricMerkleTree`, not `Set.member` (which reveals the element).
- [ ] Every `emit(...)` sends only disclosed values: events are public, indexed, and permanent (§5b).
- [ ] Calling the circuit at all does not leak intent you meant to hide (e.g. a `submitVote` call reveals that someone voted).

## B. Cryptography (midnight-security §2, §4, §9)

- [ ] No `persistentHash` over a small value space (bool, vote, role, small amount): use `persistentCommit` with a fresh nonce.
- [ ] No nonce is reused across commitments.
- [ ] Every hash / commitment has a unique domain separator; a commitment and its nullifier use different ones.
- [ ] Ledger-stored hashes use `persistent*`, never `transient*`.
- [ ] Signatures (`secp256k1EcdsaVerify`) verify a hash you computed in-circuit with domain separation, the result is `assert`ed, and no signature or signature hash is used as a nullifier or replay key (§5b).

## C. Authorization and witnesses (midnight-security §2, §5, §7)

- [ ] Every witness output is validated with `assert` before it drives logic: the proof only guarantees what the circuit checks.
- [ ] Every privileged circuit checks authority in-circuit (hash-based key, Merkle membership, or `kernel.caller()` with `is_some` checked); none trusts the frontend.
- [ ] Replay is impossible: one-shot actions use a nullifier set, repeated auth includes a round or counter.
- [ ] Cross-contract callees are compared against a stored address before their results are trusted (§5b).
- [ ] Every invariant the contract relies on is an `assert`, not a comment.

## D. Transaction semantics (midnight-security §6)

- [ ] Nothing consequential happens in the guaranteed phase if the fallible phase can still fail (partial success is permanent).
- [ ] No `assert` in a fallible path can be tripped by state an attacker changes between proving and submission (fees are forfeited).
- [ ] Order-sensitive actions (swaps, auctions) carry bounds or use commit-reveal against front-running.
- [ ] `Uint<N>` widths hold every value (`Uint<64>` for Unix seconds, `bigint` amounts in Stars); casts are bounds-checked.
- [ ] Merkle tree depth covers the expected maximum (inserting into a full tree fails) (§8).

## E. Keys, secrets, and the frontend

- [ ] No mnemonic, seed, private key, Blockfrost token, or `.env` file is committed (`git log -p` / a secret scanner).
- [ ] User secrets (commitment nonces, private state) are stored where the user can recover them, and the UI says what is lost if they are cleared.
- [ ] Private-state storage uses a strong password provider (16+ chars, 3 classes).
- [ ] The UI explains the privacy boundary before any action that discloses something (e.g. an unshielded payout reveals the recipient).

## F. Build and deploy

- [ ] `midnight-doctor` reports `0 fail`: the deployed contract was compiled by the pinned toolchain.
- [ ] Deployed artifacts (`compiler/`, `keys/`, `zkir/`) come from the same build as the audited source.
- [ ] After a recompile that changes verifier keys, callers and callees are re-audited together and redeployed (§5b).
- [ ] Who holds the contract maintenance authority, and what they can change, is written down for users.

## Related skills

| Task | Skill |
|------|-------|
| Explanations, leak patterns, defensive code | `midnight-security/` |
| Prove each property with tests | `midnight-testing-checklist/` |
| Version and toolchain gate | `midnight-doctor/` |
