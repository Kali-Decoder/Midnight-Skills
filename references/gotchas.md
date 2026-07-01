# Midnight Browser DApp Gotchas

Shared troubleshooting for 1AM wallet + Next.js + midnight-js on preprod/preview.

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Invalid character 'm' at position 0` | `encodeUserAddress()` with raw coin pk | Use `coinPublicKeyToBytes()` → pass `{ bytes: ... }` to circuits |
| Deploy hangs 30–120s silently | `deployContract()` calls `watchForTxData` | Use `createUnprovenDeployTx` + `submitTxAsync` |
| Proof fails | Missing CostModel in prove path | `unprovenTx.prove(provingProvider, CostModel.initialCostModel())` |
| GraphQL `offset: null` | Default `queryContractState` | Use patched provider in [midnight-session.md](midnight-session.md) |
| `balanceUnsealedTransaction()` null | Wallet returned empty result | Guard: `if (!balanced?.tx) throw ...` |
| Tx ID not found after submit | Object response not string | Normalize: string → `.transactionId` → `.id` |
| `ledger()` type error | Wrong argument | Pass `contractState.data` to `ledger()`, not raw `ContractState` |
| ZK asset 404 | Assets not in `public/zk/` | Run `npm run sync:assets`; verify prover URL in browser |
| WASM / top-level-await errors | Turbopack / missing webpack flags | `next dev --webpack`; enable `asyncWebAssembly` |
| Wrong wallet detected | Multiple extensions | Prefer `window.midnight['1am']` or `Object.values(window.midnight)` |

**Token units:** 1 NIGHT = 1_000_000 Stars. Use `BigInt` for amounts.
