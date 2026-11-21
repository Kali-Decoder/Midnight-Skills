# Midnight Browser DApp Gotchas (Ledger 9)

Shared troubleshooting for DApp Connector wallets (1AM, Lace) + Next.js + Midnight.js 5 on preview / preprod / mainnet.
Checked 21 Nov 2026 against the Ledger 9.1 set in [versions.json](versions.json).

| Symptom | Cause | Fix |
|---------|-------|-----|
| `setNetworkId is not a function` / `midnight-js-network-id` has no 5.x | Removed in Midnight.js 5 | Put `networkId` in `providers.config` and in the wallet configuration; see [midnight-session.md](midnight-session.md) |
| `Transaction decode` / `ProtocolVersionMismatchError` / mainnet rejects tx | Built with `ledger-v8` / Midnight.js 4 / Wallet SDK 1.x | Move to the Ledger 9 set: `@midnightntwrk/ledger-v9` 1.0.2, Midnight.js 5.0.x, Wallet SDK 2.0.1 |
| `Compact toolchain … version mismatch` on load | Contract compiled by 0.36.x but `compact-runtime` 0.16 installed | Pin `@midnight-ntwrk/compact-runtime@0.21.0` (and recompile with `compact compile +0.36.1`) |
| `EraMismatchError: artifact-era-undeclared` | ZK asset sync copied only `keys/` + `zkir/` | Also copy `compiler/` (`contract-manifest.json`, `contract-info.json`) into `public/zk/<contract>/` |
| `ZkArtifactIntegrityError` | Served artifacts don't match the manifest (partial/stale sync) | Re-run the asset sync after every recompile; serve all three dirs from the same build |
| Circuit arg error `'bytes' does not exist in type Uint8Array` | `Bytes<32>` params are plain `Uint8Array`; only `UserAddress` / `ZswapCoinPublicKey` structs are `{ bytes }` | Check the generated `contract/index.d.ts` for each parameter's shape |
| Coin public key is all zeros | Connector returns keys in **Bech32m**, old helper only parsed hex | `ShieldedCoinPublicKey.codec.decode(networkId, MidnightBech32m.parse(key)).data` |
| `ledger()` throws `expected instance of ChargedState` | Decoded by a different runtime copy, or passed the read object | `ledger(read.contractState.deserialize({ v9: ContractState }).data)` with your own `compact-runtime` import |
| `queryContractState(...).data` is undefined | Midnight.js 5 returns era-tagged bytes, not a `ContractState` | Use `read.contractState.deserialize({ v9: ContractState })` |
| Private state lost / `setContractAddress is not a function` | `PrivateStateProvider` is `forContract(address)`-scoped in 5.x | Use `levelPrivateStateProvider({ accountId, privateStoragePasswordProvider })` (IndexedDB in browsers) |
| `PasswordValidationError` | Private-storage password too weak | ≥16 chars, 3 character classes, no long repeats/sequences |
| `next build` fails prerendering (`No native build was found … classic-level`) | Server render evaluates wallet/SDK modules | Load the client component with `dynamic(() => import(...), { ssr: false })` from a `'use client'` page |
| `UnhandledSchemeError: node:url` in the browser bundle | `contract/src/index.ts` builds a filesystem path with `node:path` | Use a plain string for `withCompiledFileAssets` in browser code |
| `CompiledContract` is not exported | Imported from `compact-runtime` | Import from `@midnight-ntwrk/compact-js` |
| Indexer `410 ENDPOINT_DECOMMISSIONED` | `indexer.preprod/mainnet.midnight.network` retired 9 Oct 2026 | Preprod/mainnet indexer + RPC are Blockfrost (`?project_id=<token>`); in browsers use the wallet's endpoints via `dappConnectorNetwork(api)` |
| Blockfrost `403 Missing/Invalid project token` | No token, or a token for the other network | Per-network tokens (`nightpreprod…` / `nightmainnet…`); `networks.preprod(token)` from `midnight-js-utils` |
| Indexer `404` on `/api/v3/graphql` locally | Old path | Local and preview indexers are `/api/v4/graphql` (WS `/api/v4/graphql/ws`) |
| Contract subscription only sees new actions | Indexer 4.4.101 semantics without an offset | Midnight.js 5 passes an explicit offset itself; custom subscriptions should pass `{ blockHeight: 0 }` to replay |
| Contract / balance missing on Preview | Preview relaunched as a new chain on 7 Nov 2026 | Redeploy, re-request tNIGHT, re-register DUST |
| No DUST on Preprod after 9 Nov 2026 | Upgrade cleared DUST registrations not backed by cNIGHT | Register tNIGHT for DUST generation again |
| `balanceTx` ignores your TTL | DApp Connector takes no TTL (connector issue #102) | Expected; the wallet picks the expiry |
| WASM / top-level-await errors | Missing webpack experiments | Next 15: enable `asyncWebAssembly` + `topLevelAwait` in `next.config.mjs` (the `--webpack` flag is Next 16 only) |
| Wrong wallet detected | Multiple extensions | Prefer `window.midnight['1am']`, else `Object.values(window.midnight)[0]` |

**Token units:** 1 NIGHT = 1_000_000 Stars. Use `BigInt` for amounts.
**DUST:** cap 5 DUST per NIGHT, 10^15 Specks per DUST, ~1 week to cap, 3 h grace. Read it with `state.dust.balance(new Date())` (Wallet SDK 2.x), or `api.getDustBalance()` through the connector.
