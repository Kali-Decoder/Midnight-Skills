---
name: midnight-testing-checklist
description: Pass/fail testing checklist for a Midnight dApp — contract logic with the --skip-zk loop, negative tests for every assert and privacy property, local-devnet end-to-end tests with testkit-js, frontend and ZK-artifact checks, and CI. Use before a release, when adding tests to a template, when reviewing a PR, or when the user asks "what should I test" or "is this tested enough". Links to the skills that show how.
---

# Midnight Testing Checklist

What "tested" means for a Midnight dApp, as boxes to tick. For how to write each kind of test, follow the linked skills.

**What this skill produces:** a filled checklist, the missing tests named one per line, and the commands that run the suite.

## Workflow

1. Run `midnight-doctor` first. A version FAIL makes every test result meaningless.
2. Find the existing suites (`vitest.config.*`, `**/*.test.ts`, CI workflows) and run them once to get a baseline.
3. Walk sections A–E. For each missing item, name the test to add (file + what it asserts).
4. Write or extend tests starting with section B: negative tests catch the bugs that matter on a privacy chain.
5. Report what passes, what is missing, and the exact commands.

## A. Contract logic (fast loop, no proofs) — see `testing/` §3

- [ ] The contract compiles with the pinned toolchain; during iteration use `compact compile --skip-zk` to skip proving-key generation.
- [ ] Every exported circuit has at least one happy-path test that checks the resulting ledger state, not only that the call returned.
- [ ] Constructor arguments and initial ledger state are asserted.
- [ ] Boundary values are tested for every `Uint<N>` (0, max, max+1 at the TypeScript boundary) and every `Counter` near zero.
- [ ] State-machine contracts are tested in every state, including calls in the wrong state.

## B. Negative and privacy tests — see `midnight-security-checklist`

- [ ] Every `assert` has a test that makes it fail and checks the message.
- [ ] Every privileged circuit is called by a non-authorized identity and rejected.
- [ ] Every one-shot action is replayed and rejected (nullifier / round).
- [ ] Every witness is replaced with a dishonest implementation (wrong secret, out-of-range value) and the circuit rejects it.
- [ ] For each value meant to stay private: read the public ledger (and emitted events) after the call and assert the value does not appear.
- [ ] Two actions by the same user cannot be linked from public state when unlinkability is a requirement.

## C. End-to-end on a local devnet — see `hello-world/`, `example-counter/`

- [ ] A local devnet (node, indexer, proof server at the pinned images) starts from a committed compose file and is healthy before tests run.
- [ ] Tests deploy the contract, call each circuit through Midnight.js with real proofs, and read the result back from the indexer.
- [ ] Wallet setup uses testkit-js and funds/registers DUST inside the test setup, not by hand.
- [ ] Suites that share one devnet wallet run sequentially (parallel spends of the same UTXOs conflict).
- [ ] At least one test reconnects to an already deployed contract by address and reads its state.

## D. Frontend and artifacts — see `1am-wallet/`, `midnight-common-errors`

- [ ] The ZK asset sync copies `compiler/`, `keys/`, and `zkir/` from the current build; a check fails CI if they are stale.
- [ ] `next build` (or the bundler's production build) passes: wallet/SDK modules load client-side only.
- [ ] Wallet detection is tested with no extension, one extension, and several extensions.
- [ ] Rejected wallet prompts and failed transactions show an error instead of hanging.
- [ ] `npm ls @midnight-ntwrk/compact-runtime` shows a single version.

## E. CI and release

- [ ] CI installs with `npm ci` against a lockfile with exact pins.
- [ ] CI runs section A on every PR and section C at least before every release.
- [ ] CI runs `midnight-doctor --json` (or an equivalent version check) and fails on any FAIL.
- [ ] The network and versions each release was tested on are recorded (e.g. "preprod, Ledger 9.1 set").

## Related skills

| Task | Skill |
|------|-------|
| Compiler errors, the `--skip-zk` loop, version management | `testing/` |
| Full devnet test setup with vitest and testkit-js | `hello-world/` |
| Security properties to prove | `midnight-security-checklist/` |
| Version gate | `midnight-doctor/` |
