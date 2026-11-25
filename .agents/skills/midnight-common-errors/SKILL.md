---
name: midnight-common-errors
description: Look up a Midnight error message or code and get the cause, the fix, and the skill that explains it. Use when a user pastes an error from the Compact compiler, compact-runtime, Midnight.js, a wallet / DApp Connector, the indexer, the node (`1010: Invalid Transaction: Custom error: N`), Docker, or Next.js, or asks "what does this Midnight error mean".
---

# Midnight Common Errors

Error string or code in, cause plus fix out. Every row comes from a skill in this repo and links to it, so follow the link when the one-line fix is not enough.

**Machine-readable source:** [`errors.json`](errors.json) (the same data powers the `lookup_error` tool in `midskills-mcp`).

## Workflow

1. Take the **most specific** part of the error: a numeric code, an error class name (`EraMismatchError`), or the stable text before any value (`Version mismatch: compiled code expects`).
2. Search the tables below for it (or `grep -i "<text>" errors.json`).
3. Apply the fix, then open the linked skill if the fix touches code you have not seen.
4. Version-shaped errors (`mismatch`, `ETARGET`, `decode`, `ProtocolVersion…`) almost always mean the project left the tested set. Run `midnight-doctor` before changing code.
5. **No match?** Do not guess a cause. Say the error is not in the table and report the raw message plus the versions from `midnight-doctor`. For a node `Custom error: N`, look the number up in the official Midnight docs / ledger source for **your** ledger version: the numbers are not stable across ledger versions.

## Lookup tables

<!-- SKILLS_REGISTRY:ERRORS -->
### Node rejections (`1010: Invalid Transaction: Custom error: N`)

| Error | Cause | Fix | Skill |
|---|---|---|---|
| **170** `InvalidDustSpendProof` | The wallet paying the fee had not synced every DUST event before building the fee offer | Wait for the paying wallet to sync, add the DUST fee offer again, then submit | [`dust-gas-sponsorship`](../dust-gas-sponsorship/SKILL.md) |
| **173** `InsufficientDustForRegistrationFee` | DUST registration attempted before enough DUST was generated | Wait for generation before registering (`waitForGeneratedDust` in the Wallet SDK) | [`dust-gas-sponsorship`](../dust-gas-sponsorship/SKILL.md) |
| **196** `DustDoubleSpend` | A stale wallet view reused DUST that was already spent | Resync the wallet and rebuild the transaction; do not run suites that share one wallet in parallel | [`dust-gas-sponsorship`](../dust-gas-sponsorship/SKILL.md) |
| `could not balance dust` | The paying wallet's DUST does not cover fee plus overhead | Confirm the wait-for-DUST step succeeded; DUST accrues over time, it does not appear at once | [`dust-gas-sponsorship`](../dust-gas-sponsorship/SKILL.md) |
| `INSUFFICIENT_DUST` | Wallet not funded or not registered for DUST generation | Fund with (t)NIGHT and register it for DUST generation | [`token-transfers`](../token-transfers/SKILL.md) |

### Compact compiler (static errors)

| Error | Cause | Fix | Skill |
|---|---|---|---|
| `potential witness-value disclosure must be declared` | A witness-derived value reaches a ledger write, a return, or another public sink without `disclose()` | Wrap the value in `disclose()` at the point it becomes public, and only if making it public is intended | [`testing`](../testing/SKILL.md) |
| `parse error / Syntax error: expected ';'` | Syntax the pinned language version does not accept, often code written for another version | Check `pragma language_version` against the toolchain in `midnight-version-matrix`; rewrite the construct | [`testing`](../testing/SKILL.md) |
| `unbound identifier` | Unknown name: typo, missing `import CompactStandardLibrary;`, or a stdlib function that does not exist | Check the spelling and imports; confirm the function exists in the stdlib for your language version | [`compact`](../compact/SKILL.md) |
| `return inside for loop` | `return` is not allowed inside a `for` body | Accumulate into a variable (or `fold`) and return after the loop | [`testing`](../testing/SKILL.md) |
| `recursive circuit / recursive struct` | Circuits and structs cannot refer to themselves | Unroll into a bounded loop, or restructure the data | [`testing`](../testing/SKILL.md) |
| `sealed ledger write` | A circuit writes to a `sealed` ledger field (only the constructor may) | Set the field in the constructor, or drop `sealed` | [`testing`](../testing/SKILL.md) |
| Counter assignment (`= undefined` type error) | `Counter` fields cannot be assigned | Do not initialise it in the constructor; use `.increment(n)` / `.decrement(n)` | [`example-private-reserve-auction`](../example-private-reserve-auction/SKILL.md) |
| `Uint<16> compile error on timestamp` | Integer too narrow for Unix seconds | Use `Uint<64>` for all Unix times | [`example-locker-dapp`](../example-locker-dapp/SKILL.md) |
| `Error: Unknown compiler version +X` | That toolchain version is not installed | `compact update <version>` (see `midnight-version-matrix`), or drop the `+X` | [`midnight-environment-setup`](../midnight-environment-setup/SKILL.md) |

### Contract runtime and version mismatches

| Error | Cause | Fix | Skill |
|---|---|---|---|
| `Version mismatch: compiled code expects X, runtime is Y` | Contract compiled by one toolchain, `@midnight-ntwrk/compact-runtime` from another | Pin the runtime from `midnight-version-matrix` and recompile with the matching `compact compile +<toolchain>` | [`testing`](../testing/SKILL.md) |
| Overflow on cast (e.g. `1000 as Uint<8>`) | Narrowing cast of a value that does not fit | Check bounds with `assert` before casting, or widen the type | [`testing`](../testing/SKILL.md) |
| `Counter underflow` | `Counter` decremented below zero | Guard with `assert` on the current value first | [`testing`](../testing/SKILL.md) |
| `Uninitialized nested ledger value` | `map.lookup(k).lookup(k2)` before the inner value was inserted | Insert the inner ADT first, or check membership before the lookup | [`testing`](../testing/SKILL.md) |
| `Merkle tree full` | Insert into a tree that `isFull()` | Pick a larger depth up front; check `isFull()` before inserting | [`midnight-security`](../security/SKILL.md) |
| `expected instance of ChargedState` | Two copies of a WASM package (mixed `@midnight-ntwrk` / `@midnightntwrk` scopes, or duplicate runtimes), or the read object was passed instead of the decoded state | One copy per package (`npm ls`); decode with `read.contractState.deserialize({ v9: ContractState }).data` | [`midnight-js`](../midnight-js/SKILL.md) |
| `ContractMaintenanceAuthority WASM identity error` | Two different `compact-runtime` copies loaded (root and `contract/`) | `npm ls @midnight-ntwrk/compact-runtime`; make both resolve one version, or delete `contract/node_modules` | [`example-private-party-dapp`](../example-private-party-dapp/SKILL.md) |
| `ProtocolVersionMismatchError / Transaction decode / mainnet rejects tx` | Built with `ledger-v8`, Midnight.js 4, or Wallet SDK 1.x against a Ledger 9 network | Move the whole project to the Ledger 9 set in `midnight-version-matrix` | [`midnight-js`](../midnight-js/SKILL.md) |

### Midnight.js, ZK artifacts, and private state

| Error | Cause | Fix | Skill |
|---|---|---|---|
| `EraMismatchError: artifact-era-undeclared` | ZK asset sync copied only `keys/` and `zkir/` | Also serve `compiler/` (`contract-manifest.json`, `contract-info.json`) next to them | [`1am-wallet`](../1am-wallet/SKILL.md) |
| `ZkArtifactIntegrityError` | Served artifacts do not match the manifest (partial or stale sync) | Re-run the asset sync after every recompile; serve all three dirs from one build | [`1am-wallet`](../1am-wallet/SKILL.md) |
| `queryContractState(...).data is undefined / ledger() fails on the result` | Midnight.js 5 returns era-tagged bytes, not a `ContractState` | `ledger(read.contractState.deserialize({ v9: ContractState }).data)` | [`midnight-js`](../midnight-js/SKILL.md) |
| `setNetworkId is not a function / midnight-js-network-id not found` | Removed in Midnight.js 5 | Pass `networkId` in `providers.config` and the wallet configuration | [`midnight-js`](../midnight-js/SKILL.md) |
| `setContractAddress is not a function / private state lost` | `PrivateStateProvider` is `forContract(address)`-scoped in 5.x | Use `levelPrivateStateProvider({ accountId, privateStoragePasswordProvider })` | [`midnight-js`](../midnight-js/SKILL.md) |
| `PasswordValidationError` | Private-storage password too weak | At least 16 characters, 3 character classes, no long repeats or sequences | [`midnight-js`](../midnight-js/SKILL.md) |
| `CompiledContract is not exported / withVacantWitnesses type error` | Imported from `compact-runtime` | Import `CompiledContract` from `@midnight-ntwrk/compact-js` | [`example-private-party-dapp`](../example-private-party-dapp/SKILL.md) |
| `'bytes' does not exist in type Uint8Array` | `Bytes<32>` parameters are plain `Uint8Array`; only `UserAddress` / `ZswapCoinPublicKey` structs are `{ bytes }` | Check the generated `contract/index.d.ts` for each parameter's shape | [`compact`](../compact/SKILL.md) |
| `Invalid character 'm' at position 0` | A Bech32m address string was parsed as hex or bytes | Decode with `wallet-sdk-address-format` and pass `{ bytes: Uint8Array }` to circuits | [`example-payment-dapp`](../example-payment-dapp/SKILL.md) |
| `Coin public key is all zeros` | The connector returns Bech32m keys; an old helper only parsed hex | `ShieldedCoinPublicKey.codec.decode(networkId, MidnightBech32m.parse(key)).data` | [`1am-wallet`](../1am-wallet/SKILL.md) |
| `bigint type mismatch on constructor / circuit args` | Passed `number` where the generated types want `bigint` | Wrap with `BigInt(value)` for every `Uint<N>` / `Field` argument | [`compact`](../compact/SKILL.md) |
| `Failed to clone intent` | Wallet SDK 1.x signing bug | Upgrade to Wallet SDK 2.x; do not patch | [`example-counter`](../example-counter/SKILL.md) |
| `WalletFacade.init is not a function` | Old `new WalletFacade()` usage or wrong package | Use the `WalletFacade.init()` static factory from the pinned `wallet-sdk-facade` | [`example-counter`](../example-counter/SKILL.md) |

### Wallets and the DApp Connector

| Error | Cause | Fix | Skill |
|---|---|---|---|
| `window.midnight is undefined` | No extension installed, or the page read it before async injection | Poll for a few seconds; then ask the user to install a Midnight wallet | [`react-wallet-connector`](../react-wallet-connector/SKILL.md) |
| `Wrong wallet detected` | Several Midnight extensions installed | Let the user choose from `Object.values(window.midnight)`; never hardcode one key | [`react-wallet-connector`](../react-wallet-connector/SKILL.md) |
| `getProvingProvider() fails` | The wallet cannot fetch ZK material from the dApp | Serve `compiler/`, `keys/`, and `zkir/` from the dApp | [`gero-wallet`](../gero-wallet/SKILL.md) |
| `balanceTx ignores your TTL` | The DApp Connector takes no TTL | Expected: the wallet picks the expiry | [`1am-wallet`](../1am-wallet/SKILL.md) |
| `RP_ID_MISMATCH` | Passkey domain changed | Delete the credential in the password manager and create it again | [`midnight-passport`](../midnight-passport/SKILL.md) |

### Indexer, RPC, and networks

| Error | Cause | Fix | Skill |
|---|---|---|---|
| **410** `ENDPOINT_DECOMMISSIONED` | Old `indexer.preprod/mainnet.midnight.network` hosts (retired 9 Oct 2026) | Preprod/mainnet indexer and RPC are Blockfrost (`?project_id=<token>`); in browsers use the wallet's endpoints | [`midnight-indexer`](../indexer/SKILL.md) |
| **403** `Blockfrost Missing/Invalid project token` | No token, or a token for the other network | Use the per-network token with `networks.preprod(token)` / `networks.mainnet(token)` | [`midnight-indexer`](../indexer/SKILL.md) |
| **404** `404 on /api/v3/graphql` | Old indexer path | Local and preview indexers are `/api/v4/graphql` (WS `/api/v4/graphql/ws`) | [`midnight-indexer`](../indexer/SKILL.md) |
| `Contract subscription only sees new actions` | No offset passed to a custom subscription | Pass `{ blockHeight: 0 }` to replay from the start | [`midnight-indexer`](../indexer/SKILL.md) |
| `Contract or balance missing on Preview` | Preview relaunched as a new chain on 7 Nov 2026 | Redeploy, re-request tNIGHT, re-register DUST | [`multinetwork`](../multinetwork/SKILL.md) |
| `method not found (RPC)` | Method not exposed on this node | Call `rpc_methods`; fall back to the official Midnight RPC | [`ankr-midnight`](../ankr-midnight/SKILL.md) |

### Toolchain, Docker, and bundlers

| Error | Cause | Fix | Skill |
|---|---|---|---|
| `compact: command not found` | The Compact binary is not on PATH | Open a new shell or source the installer's env file, then check `compact --version` | [`midnight-environment-setup`](../midnight-environment-setup/SKILL.md) |
| `ECONNREFUSED 127.0.0.1:6300` | Proof server not running | Start the pinned `midnightntwrk/proof-server` image on port 6300 | [`midnight-environment-setup`](../midnight-environment-setup/SKILL.md) |
| `Port 6300 in use` | Another container holds the port | Stop it, or map another host port (`-p 6301:6300`) and point the proof provider there | [`testing`](../testing/SKILL.md) |
| `ETARGET No matching version found` | A version that is not in the tested set | Install the pins from `midnight-version-matrix`; never fall back to `@latest` | [`midnight-version-matrix`](../midnight-version-matrix/SKILL.md) |
| `Wallet sync timeout (tests)` | Local devnet containers not healthy | Wait until node, indexer, and proof server are all healthy before running tests | [`hello-world`](../example-hello-world/SKILL.md) |
| `No native build was found ... classic-level (next build)` | Server render evaluates wallet/SDK modules | Load the client component with `dynamic(() => import(...), { ssr: false })` | [`1am-wallet`](../1am-wallet/SKILL.md) |
| `UnhandledSchemeError: node:url` | Browser bundle builds a filesystem path with `node:path` | Use a plain string for `withCompiledFileAssets` in browser code | [`1am-wallet`](../1am-wallet/SKILL.md) |
| `WASM / top-level-await errors in Next.js` | Missing webpack experiments | Enable `asyncWebAssembly` and `topLevelAwait` in `next.config.mjs` | [`1am-wallet`](../1am-wallet/SKILL.md) |
| `ERR_UNSUPPORTED_DIR_IMPORT` | Node tried to import a directory | Import the file (or `dist/index.js`) explicitly; clear caches | [`testing`](../testing/SKILL.md) |
<!-- /SKILLS_REGISTRY:ERRORS -->

## Adding an error

Edit `errors.json` (`layer`, optional `code`, `match`, `cause`, `fix`, `skill`), then run `npm run sync:registry`. Add only errors you have reproduced, and point `skill` at the skill that explains the fix.

## Related skills

| Task | Skill |
|------|-------|
| Check installed versions against the pins | `midnight-doctor/` |
| See the pinned, tested version set | `midnight-version-matrix/` |
| Read compiler errors, the `--skip-zk` loop | `testing/` |
