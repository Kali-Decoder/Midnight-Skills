# Resolving Volatile Facts

Anything that changes release-to-release: package versions, SDK call signatures,
API surface. Skills should point here instead of embedding a point-in-time copy.

## Why not just `npm install @latest`

Midnight packages are **co-versioned**. They only work as a tested set, and
npm's latest is a documented trap. Two traps are live as of Nov 2026:

| Trap | What happens |
|------|--------------|
| Scope split | New Midnight.js releases (5.0.2+) publish **only** under `@midnightntwrk`; `@midnight-ntwrk/midnight-js-*` stops at 5.0.1. `compact-runtime`, `compact-js` and `platform-js` are still published **only** under `@midnight-ntwrk`. Mixing the wrong scopes installs two copies of the ledger WASM. |
| Mixed eras | `compact-runtime` 0.16 with a 0.36.x-compiled contract throws a version mismatch; Midnight.js 4.x / Wallet SDK 1.x cannot transact on Ledger 9 networks; `ledger-v9` < 1.0.2 fails with Midnight.js 5.0.0. |

A bare `compact update` installs the newest toolchain and makes it the default.
Prefer `compact update 0.36.1` (or `--no-set-default` plus
`compact compile +0.36.1 ...`) so the compiler matches the pinned runtime.

## Versions: always from the support matrix

1. Fetch <https://docs.midnight.network/relnotes/support-matrix> with a plain
   fetch. The page also has "Copy page as Markdown", and every docs page is listed in
   <https://docs.midnight.network/llms.txt>.
2. Pick the **network** row set (Preview / Preprod / Mainnet) you target. As of
   Ledger 9.1 all three are identical.
3. Take the **whole set together**: devtools, toolchain, runtime, Compact JS,
   Platform JS, on-chain runtime, wallet SDK, Midnight.js, testkit-js, DApp
   Connector, indexer, proof server.
4. Map each matrix component to its npm package via the table below, then install
   the exact versions as a unit.
5. Use `npm view <pkg> version` only to confirm which scope a package exists under,
   never to choose the version.

`references/versions.json` holds the Ledger 9.1 set this repo's templates use
(names **and** versions, checked against npm and the matrix on 21 Nov 2026).

## Component → package map (Ledger 9.1)

| Matrix component | Version | npm package / source |
|------------------|---------|----------------------|
| Compact devtools | 0.5.1 | `compact` binary (`compact --version`) |
| Compact toolchain | 0.36.1 (language 0.28.0) | `compact compile --version`, `compact compile --language-version` |
| Compact runtime | 0.21.0 | `@midnight-ntwrk/compact-runtime` (old scope only) |
| Compact JS | 3.0.2 | `@midnight-ntwrk/compact-js` (old scope only; exports `CompiledContract`) |
| Platform JS | 3.0.0 | `@midnight-ntwrk/platform-js` |
| On-chain runtime | 4.0.x | `@midnightntwrk/onchain-runtime-v4` (v4 = Ledger 9; pulled in by compact-runtime) |
| Ledger | 1.0.2 | `@midnightntwrk/ledger-v9` (replaces `@midnight-ntwrk/ledger-v8`) |
| Midnight.js | 5.0.1 (matrix) / 5.0.2 (maintenance) | `@midnightntwrk/midnight-js-*`: `contracts`, `types`, `utils`, `indexer-public-data-provider`, `fetch-zk-config-provider`, `node-zk-config-provider`, `http-client-proof-provider`, `level-private-state-provider`, `dapp-connector-proof-provider`. There is **no** `network-id` package any more. |
| testkit-js | 5.0.x | `@midnightntwrk/testkit-js` |
| DApp Connector API | 4.1.0 | `@midnightntwrk/dapp-connector-api` |
| Wallet SDK | 2.0.1 | `@midnightntwrk/wallet-sdk` (barrel), or individually `wallet-sdk-facade` 5.0.1, `-shielded` 4.0.1, `-unshielded-wallet` 4.0.1, `-dust-wallet` 5.1.0, `-hd` 4.0.0, `-address-format` 4.0.1 |
| Proof server | 9.0.2 | Docker `midnightntwrk/proof-server:9.0.2` |
| Indexer | 4.4.101 | Docker `midnightntwrk/indexer-standalone:4.4.101` |
| Node | 2.1.101 | Docker `midnightntwrk/midnight-node:2.1.101` |

## Endpoints (unchanged by the Ledger 9 upgrade, but preprod/mainnet moved to Blockfrost on 9 Oct 2026)

| Network | Indexer (HTTP / WS) | Node RPC |
|---------|---------------------|----------|
| undeployed (local) | `http://localhost:8088/api/v4/graphql` / `ws://localhost:8088/api/v4/graphql/ws` | `http://localhost:9944` |
| preview | `https://indexer.preview.midnight.network/api/v4/graphql` / `wss://indexer.preview.midnight.network/api/v4/graphql/ws` | `https://rpc.preview.midnight.network` |
| preprod | `https://midnight-preprod.blockfrost.io/api/v0?project_id=<token>` / `wss://midnight-preprod.blockfrost.io/api/v0/ws?project_id=<token>` | `https://rpc.midnight-preprod.blockfrost.io?project_id=<token>` |
| mainnet | `https://midnight-mainnet.blockfrost.io/api/v0?project_id=<token>` / `wss://midnight-mainnet.blockfrost.io/api/v0/ws?project_id=<token>` | `https://rpc.midnight-mainnet.blockfrost.io?project_id=<token>` |

`networks.preview()`, `networks.preprod(token)` and `networks.mainnet(token)` from
`@midnightntwrk/midnight-js-utils` build these. The proof server always runs locally
(`http://localhost:6300`). Faucets: preview `https://faucet.preview.midnight.network/`,
preprod `https://midnight-tmnight-preprod.nethermind.dev/`.

## Docs / API surface (only when you need signatures)

The version path above always works. For *current* prose docs and call
signatures, these resolve live. They're an optional upgrade, not required:

- **Kapa MCP** (official): `claude mcp add --transport http midnight https://midnight.mcp.kapa.ai`
- **midnight-manual (`mnm`)**: community RAG over docs and source
- **Midnight Expert**: official Claude Code plugins, incl. `midnight-verify`
- **`docs.midnight.network/llms.txt`**: always-available fallback, no MCP needed.
- **Package READMEs**: `node_modules/@midnightntwrk/*/README.md` are kept current with each release and are the fastest source for 5.x call shapes.

Keep durable reasoning (patterns, decision tables, privacy guidance) in the
skills; send only the drift-prone facts here.

<!-- snapshot checked 2026-11-21 (Ledger 9.1 support matrix + npm); re-check the matrix before trusting any number above -->
