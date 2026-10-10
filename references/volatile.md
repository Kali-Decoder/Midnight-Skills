# Resolving Volatile Facts

Anything that changes release-to-release: package versions, SDK call signatures,
API surface. Skills should point here instead of embedding a point-in-time copy.

## Why not just `npm install @latest`

`@midnight-ntwrk/*` packages are **co-versioned** — they only work as a tested
set. npm's latest is a documented trap:

| Package | npm latest (Oct 2026) | Matrix says | Why it matters |
|---------|----------------------|-------------|----------------|
| `@midnight-ntwrk/compact-runtime` | `0.20.0` | `0.16.0` | 0.19/0.20 target ledger 9; breaks Midnight.js 4.1.1 with `Failed to configure constructor context with coin public key` |
| `@midnight-ntwrk/onchain-runtime-v3` | `3.1.2` | `3.0.0` | Midnight.js 4.1.1 pins 3.0.0 |

A bare `compact update` and a bare `npm install @midnight-ntwrk/compact-runtime`
both pick the newest — the incompatible one. Never do either in a project that
doesn't already pin.

## Versions — always from the support matrix

1. Fetch <https://docs.midnight.network/relnotes/support-matrix> (plain fetch;
   the page also has "Copy page as Markdown" and every docs page is in
   <https://docs.midnight.network/llms.txt>).
2. Pick the **network** row set (Preview / Preprod / Mainnet) you target.
3. Take the **whole set together** — devtools, toolchain, runtime, Compact JS,
   Platform JS, on-chain runtime, wallet SDK, Midnight.js, testkit-js, DApp
   Connector, indexer, proof server.
4. Map each matrix component to its npm package via the table below, then install
   the exact versions as a unit.
5. `npm view <pkg> version` only to confirm a package exists — never to choose the
   version.

`references/versions.json` holds the package-name set this repo's templates use;
the matrix holds the numbers. Matrix = versions, versions.json = names.

## Component → package map

| Matrix component | npm package / source |
|------------------|----------------------|
| Compact devtools / toolchain | `compact` binary — `compact --version`, `compact compile --version` (not npm) |
| Compact runtime | `@midnight-ntwrk/compact-runtime` |
| Compact JS | `@midnight-ntwrk/compact-js` |
| On-chain runtime | `@midnight-ntwrk/onchain-runtime-v3` (v3 = ledger 8) |
| Midnight.js | `@midnight-ntwrk/midnight-js-*` — `contracts`, `types`, `network-id`, `fetch-zk-config-provider`, `indexer-public-data-provider` |
| testkit-js | `@midnight-ntwrk/testkit-js` |
| DApp Connector API | `@midnight-ntwrk/dapp-connector-api` |
| Wallet SDK | `@midnight-ntwrk/wallet-sdk` |
| Ledger | `@midnight-ntwrk/ledger-v8` |
| Proof server | Docker image, not npm (tag = matrix "Proof server" version) |
| Node, Indexer | services, not npm (provider package comes via Midnight.js) |

Uncertain names (verify against the package's own README before pinning):
Platform JS, Wallet API.

## Docs / API surface (only when you need signatures)

The version path above always works. For *current* prose docs and call
signatures, these resolve live — optional upgrade, not required:

- **Kapa MCP** (official): `claude mcp add --transport http midnight https://midnight.mcp.kapa.ai`
- **midnight-manual (`mnm`)** (community RAG over docs + source)
- **Midnight Expert** (official Claude Code plugins, incl. `midnight-verify`)
- **`docs.midnight.network/llms.txt`** — always-available fallback, no MCP needed.

Keep durable reasoning (patterns, decision tables, privacy guidance) in the
skills; send only the drift-prone facts here.

<!-- snapshot checked 2026-10-10; re-check the matrix before trusting any number above -->
