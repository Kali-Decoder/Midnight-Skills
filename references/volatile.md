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
It is the **single source of truth**: every version literal in a skill or
reference must equal it, and CI enforces that (see "Keeping skills in sync" below).

## Resolve pins at use time

Skills show the pinned versions inline so their code blocks stay copy-pasteable.
To be sure you have the **current** pins, resolve them from the live pin file
instead of trusting a copy you fetched earlier. Node 18+:

```bash
PINS=https://raw.githubusercontent.com/Kali-Decoder/Midnight-Skills/main/references/versions.json

# Print pkg@version for the packages you need; exits 1 if any is not pinned
midnight_pins() {
  node -e '
  const [url, ...want] = process.argv.slice(1);
  fetch(url).then(r => { if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); }).then(v => {
    const all = { ...v.packages, ...v.nodePackages };
    const missing = want.filter(n => !(n in all));
    if (missing.length) { console.error("not in versions.json:", missing.join(" ")); process.exit(1); }
    console.log(want.map(n => `${n}@${all[n]}`).join(" "));
  }).catch(e => { console.error(e.message); process.exit(1); });' "$PINS" "$@"
}

npm install --save-exact $(midnight_pins \
  @midnightntwrk/midnight-js-contracts \
  @midnightntwrk/midnight-js-types \
  @midnight-ntwrk/compact-runtime) || echo "resolve failed: do not fall back to @latest"

# Toolchain and images come from the same file
compact update "$(node -e 'fetch(process.argv[1]).then(r=>r.json()).then(v=>console.log(v.toolchain.compact))' "$PINS")"
```

If the pin file and the support matrix disagree, the matrix wins: report it
(open an issue) and use the matrix set as a unit. A package the snippet says
is "not in versions.json" has no tested pin. Do not guess one.

## Keeping skills in sync (contributors)

- Change versions **only** in `references/versions.json`, then run
  `npm run sync:versions`. It rewrites every literal in `.agents/skills/**` and
  `references/*.md` from the pin file.
- `npm run check:versions` (also run in CI) fails on any literal that differs
  from the pin file, on a package that is not in it, and on a package listed
  under `removed`. It checks `pkg@1.2.3`, `"pkg": "1.2.3"`, the three Docker
  image tags, `compact update X`, `compact compile +X`, the devtools release
  URL and `pragma language_version >= X`.
- Instructions ("pin X", "install Y") cite `references/versions.json`, or use one of
  the checked forms above, so they can never drift. Do not restate the set in
  prose tables.
- Verification records ("ported on 21 Nov 2026 with Compact 0.36.1, tests
  pass") keep their numbers, since they say what was actually tested.
- A deliberate off-pin literal (an error-message example, a third-party
  package's own dependency) gets `<!-- pin-ok -->` at the end of its line.

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
