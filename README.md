# Midnight Skills

This project extends the Midnight Network with additional developer tooling.

Knowledge skills for AI agents building on Midnight Network. Each skill is a standalone markdown file that agents fetch and read into their context.

## Skills

| Skill | Description |
|-------|-------------|
<!-- SKILLS_REGISTRY:README_TABLE -->
| [1AM Wallet](1am-wallet/SKILL.md) | Integrate 1AM wallet for dust-free contract deployment and transaction flow on Midnight Network. |
| [Android Example Voting](android-example-voting/SKILL.md) | Build a voting/poll dApp on Midnight Network using the Kuira Android SDK — Compact smart contract with create/cast/close circuits, passkey-derived identity, embedded wallet, Compose UI, reactive ledger reads via observeLedger(), and on-device ZK proving. |
| [Compact](compact/SKILL.md) | The Compact smart contract language for Midnight Network. TypeScript-like DSL that compiles to ZK circuits. |
| [Example Counter](example-counter/SKILL.md) | Complete Midnight DApp reference — headless wallet, CLI, counter contract, DUST generation, deploy, interaction. |
| [Example Hello World](example-hello-world/SKILL.md) | Build a complete Midnight Network hello-world DApp from scratch with Compact, vitest, and FluentWalletBuilder. |
| [Example Leaderboard Dapp](example-leaderboard-dapp/SKILL.md) | Privacy-preserving arcade leaderboard: submit scores with anonymous/public/custom names and prove ownership via ZK. |
| [Example Locker Dapp](example-locker-dapp/SKILL.md) | Time-lock vault dApp: lock unshielded NIGHT until a Unix deadline; beneficiary releases via blockTimeGte. |
| [Example Payment Dapp](example-payment-dapp/SKILL.md) | Privacy-preserving payment vault: deposit/withdraw tNIGHT via Compact + 1AM wallet. |
| [Indexer](indexer/SKILL.md) | Query and subscribe to Midnight blockchain data via Indexer GraphQL API v4. |
| [Midnight Consensus](midnight-consensus/SKILL.md) | AURA block production, GRANDPA finality, and Cardano Partnerchain validator selection with SPO stake delegation. |
| [Midnight Cryptography](midnight-cryptography/SKILL.md) | Node cryptographic primitives — Blake2-256, sr25519, ECDSA, Ed25519, and twoxhash storage keys. |
| [Midnight.js](midnight-js/SKILL.md) | TypeScript SDK — provider wiring, wallet SDK, contract deployment, DUST flow, testkit. |
| [Multinetwork](multinetwork/SKILL.md) | Build a single dApp that deploys across all networks (localnet, preview, preprod, mainnet) from one codebase. |
| [NFT](nft/SKILL.md) | Build shielded and unshielded NFTs on Midnight using OpenZeppelin Compact contracts. |
| [Onchain Logic and State](midnight-onchain-logic/SKILL.md) | WASM runtime, FRAME pallets, pallet-midnight ledger state machine, and proof-based state transitions. |
| [P2P Networking](midnight-p2p-networking/SKILL.md) | libp2p peer discovery, TCP/WebSocket transport, Noise encryption, Yamux multiplexing, and gossip protocols. |
| [React Wallet Connector](react-wallet-connector/SKILL.md) | Scaffold a React + Vite app with DApp Connector API wallet connection, connect/disconnect UI, and unshielded address display. |
| [RPC Interface](midnight-rpc/SKILL.md) | JSON-RPC methods for contract state, ZSwap chain state, ledger version, Polkadot SDK defaults, and Partnerchain RPCs. |
| [Security](security/SKILL.md) | Privacy audit checklist, data leak patterns, defensive Compact patterns. |
| [Storage](midnight-storage/SKILL.md) | ParityDB backend, Patricia-Merkle trie state commitments, and twoxhash storage key generation. |
| [Testing](testing/SKILL.md) | Debug Compact contracts and manage toolchain versions. Static vs dynamic errors, version sync, common traps. |
| [Token Transfers](token-transfers/SKILL.md) | Shielded and unshielded token transfers, balance queries, multi-party flows on Midnight. |
| [Transactions](midnight-transactions/SKILL.md) | Proof-based unsigned ledger transactions, pool validation, runtime verification, and state commit lifecycle. |
| [Why Midnight](why-midnight/SKILL.md) | What Midnight is, why it exists, and how it works — public/private state, selective disclosure, and ZK proofs. |
<!-- /SKILLS_REGISTRY:README_TABLE -->

## Architecture

<!-- SKILLS_REGISTRY:ARCHITECTURE -->
- **Site:** [MIDSKILLS](https://midnight-skills.netlify.app) — static HTML, CSS, and JavaScript
- **Hosting:** [Netlify](https://www.netlify.com) (static deploy + serverless functions in `netlify/functions/`)
- **API:** `/api/*` → Netlify functions (skill fetch, analytics, stats); `api/` also supports Vercel-style deployment
- **Database:** MongoDB (optional download tracking); Supabase (optional analytics)
- **Skills:** Markdown files served statically and via `/api/skill`
<!-- /SKILLS_REGISTRY:ARCHITECTURE -->

## Prerequisites

- Node.js >= 22
- Optional: MongoDB (Atlas or self-hosted) for download tracking
- Optional: Supabase for analytics (`/api/track`, `/api/analytics`)
- A [Netlify](https://www.netlify.com) account for deployment (recommended)

## Setup

```bash
# Install dependencies
npm install

# Set environment variables (see .env.example)
cp .env.example .env
# Edit .env with your values
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | No | MongoDB connection string (optional download tracking) |
| `MONGODB_DB` | No | Database name (default: `midnight-skills`) |
| `STATS_SECRET` | No | Secret key to access `/api/stats` |
| `SUPABASE_URL` | No | Supabase project URL (enables `/api/track` + `/api/analytics`) |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Supabase service role key (server-side only) |
| `ANALYTICS_SECRET` | No | (Deprecated) `/api/analytics` is public now |
| `ANALYTICS_IP_SALT` | No | Salt for daily IP hashing (recommended) |

### Database Setup

Create a MongoDB database (Atlas or self-hosted). The app will create the
`skill_downloads` collection automatically on first insert.

## Deployment

<!-- SKILLS_REGISTRY:DEPLOYMENT -->
The site deploys to **Netlify** at [midnight-skills.netlify.app](https://midnight-skills.netlify.app). Push to `main` to trigger a deploy.

Set environment variables in your Netlify project (Site settings → Environment variables). MongoDB and Supabase are optional — the static site and skill browser work without them.

For Vercel-style hosting, the `api/` folder can be used instead; set the same environment variables there.
<!-- /SKILLS_REGISTRY:DEPLOYMENT -->

### Optional: Supabase Analytics

- Apply `supabase/analytics_schema.sql` in your Supabase SQL editor.
- Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Netlify (or Vercel).
- Open `analytics.html` to view usage.

## Skill registry

`skills.json` is the **single source of truth** for site metadata, skills, learning paths, and featured flags. The site (`skill.html`, `index.html`), `meta.js`, and npm package list are synced from it via `npm run sync:registry`.

**Add or change a skill:**

1. Edit `skills.json` (add entry with `id`, `name`, `path`, `description`, `enabled`, etc.)
2. Create or update the skill folder and `SKILL.md`
3. Run `npm run sync:registry` to update `SKILL.md` router, `README.md`, `howto.html`, and `package.json` skills list
4. Commit both `skills.json` and the synced files

**Shared dApp references** live in `references/` — provider wiring and gotchas used by `example-payment-dapp`, `example-locker-dapp`, and `1am-wallet` skills.

**Runnable template:** `templates/locker-dapp/` — copy and run for the locker dApp skill.

**Skill journey map:** `skillLevels` in `skills.json` drives the animated beginner → intermediate → advanced mind map on the homepage.

## Contributing

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for contribution rules and a step-by-step guide to adding a new skill.

Quick summary: create `your-skill/SKILL.md` → register in `skills.json` → run `npm run sync:registry` → open a PR.

## License

MIT License

Copyright 2026 Tusharpamnani, Kali-Decoder

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
