---
name: example-private-reserve-auction-dapp
author: tusharpamnani
description: >
  Build a private reserve auction dApp on Midnight Network — hidden reserve price, public
  bids, private bidder identities. Covers private-reserve-auction.compact (no witnesses,
  persistentCommit, Map, Counter, disclose, receiveUnshielded/sendUnshielded), Next.js
  frontend, 1AM wallet integration, deployContract/callTx, indexer polling. Use for
  teaching privacy boundaries, commitment-based auctions, seller access control, or
  unshielded settlement. Triggers: private auction, reserve auction, silent auction,
  privacy boundary, persistentCommit, getDappPublicKey, unshielded claim, hidden price,
  bid commitment, seller reveal. Also use when extending locker-dapp or payment-dapp
  wallet/provider patterns to privacy-preserving auction flows.
---

# Midnight Network Private Reserve Auction DApp

> **Versions:** every pin in this skill comes from `references/versions.json`, the repo's single source of truth (checked in CI). Resolve the current set at use time with `references/volatile.md`. Never install `@latest`.

A **private reserve auction contract** lets a seller hide the reserve price on-chain while bidders place public bids with private identities. The winner crosses the **privacy boundary** when claiming the item via unshielded NIGHT payment.

**Source of truth:** `templates/private-reserve-auction-dapp/` is the complete, runnable project, and this skill is the walkthrough for it. Copy the template rather than retyping files from this page, then adapt it (§15). The contract is shown in full because it is the lesson.

**Get the template:**

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/Kali-Decoder/Midnight-Skills.git
cd Midnight-Skills && git sparse-checkout set templates/private-reserve-auction-dapp
cp -R templates/private-reserve-auction-dapp ../my-auction && cd ../my-auction

npm install
npm run compact        # compact compile +0.36.1 → contract/src/managed/private-reserve-auction
npm run sync:assets    # copies compiler/ keys/ zkir/ to public/zk/private-reserve-auction
npm run dev            # http://localhost:3000/auction, 1AM wallet (Ledger 9 build) on preview
```

Without a checkout, read any file at `https://raw.githubusercontent.com/Kali-Decoder/Midnight-Skills/main/templates/private-reserve-auction-dapp/<path>`.

**Verified:** the contract compiles with 0.36.1 (5 circuits), the app type-checks, and `npm run build` produces `/` and `/auction`. Not yet run against a live network.

**What the template contains** (paths relative to `templates/private-reserve-auction-dapp/`):
- `contract/`: `private-reserve-auction.compact` (no witnesses, Map, Counter), barrel, compile script
- `app/auction/AuctionClient.tsx`: seller (deploy/close/reveal/claim proceeds) and bidder (bid/claim item) UI, Tailwind classes
- `lib/midnight.ts`: the canonical Ledger 9 session from `references/midnight-session.md`
- `lib/auction.ts`: `deployAuction`, `placeBid`, `closeAuction`, `revealPrice`, `claimItem`, `claimProceeds`, `fetchAuctionState`
- `lib/address.ts`, `lib/secret.ts`: Bech32m → `UserAddress`, and per-contract secrets in `localStorage`
- `scripts/sync-zk-assets.mjs`: ZK assets into `public/zk/private-reserve-auction/`

**Key architecture notes:**
- **No witnesses** — caller auth uses circuit-private `_secret` → `getDappPublicKey(_secret)` compared to on-chain `organizer`
- **Hidden reserve price** — committed via `persistentCommit(price, secret)`, revealed later by seller via `revealPrice`
- **Public bids, private identities** — `bid` discloses bid amount but identity is `getDappPublicKey(secret)` hash
- **Bid overwriting** — bidders can update their bid if higher; tracked in `Map<Bytes<32>, Uint<32>>`
- **Auto-close** — auction closes when `bidCount == maxBids`
- **Privacy boundary** — `claimItem` calls `receiveUnshielded(nativeToken(), publicPrice)` then `winnerClaimed.insert(disclose(address))`
- **Seller becomes public** — `claimProceeds` calls `sendUnshielded(...)` to seller's `UserAddress`
- **`disclose()` is a developer assertion** — it marks values safe for public domains; it does not perform the disclosure itself
- Use `deployContract` / `findDeployedContract` with providers typed to the contract (Midnight.js 5)
- Plain `indexerPublicDataProvider(network.indexer)`; the old `offset: null` patch is obsolete on indexer 4.4.101
- **Preview relaunched as a new chain on 7 Nov 2026**: auctions and addresses stored before then are gone, so clear saved state and redeploy
- Reserve price is `Uint<32>` on ledger (in Stars) but cast to `Uint<128>` for unshielded ops; 1 NIGHT = 1_000_000 Stars
- UI accepts/display NIGHT; converts to Stars (×1,000,000) for contract
- Persist seller/bidder `_secret` in `localStorage` — losing it means losing auth for that role
- **Network: Preview** (hardcoded in `AuctionClient.tsx`)

---

## Workflow

When helping the user, follow this sequence:

1. **Copy the template** and run it unchanged once; then adapt `private-reserve-auction.compact` if needed (`npm run compact`, `npm run sync:assets`)
2. **Understand privacy boundary** — hidden price → public bids → reveal → claim (unshielded) → public settlement
3. **Providers** — `createConnectedSession` (from `references/midnight-session.md`)
4. **Deploy** — seller passes `(reservePriceStars, maxBidders, sellerSecret)` to constructor
5. **Bid** — bidders call `bid(bidAmountStars, userAddress, secret)` (public amount, private identity)
6. **Close** — seller calls `closeAuction(secret)` (or auto-closes when full)
7. **Reveal** — seller calls `revealPrice(reservePriceStars, secret)` (verified against commitment)
8. **Claim** — winner calls `claimItem(address, secret)` + pays reserve (crosses boundary)
9. **Proceeds** — seller calls `claimProceeds(address, secret)` after claim
10. **UI** — role cards (seller/bidder), auction status panel, indexer polling for public state

---

## 1) Project Structure

```
templates/private-reserve-auction-dapp/
├── package.json                    # scripts: dev, build (syncs assets first), compact, sync:assets
├── next.config.mjs                 # Node fallbacks, isomorphic-ws alias, WASM
├── postcss.config.mjs              # Tailwind v4 (@tailwindcss/postcss)
├── tsconfig.json                   # "@/*" path alias
├── lib/
│   ├── isomorphic-ws-fix.mjs
│   ├── midnight.ts                 # session, providers, hex helpers
│   ├── auction.ts                  # deploy, circuits, decode state
│   ├── address.ts                  # Bech32m → UserAddress bytes
│   └── secret.ts                   # crypto.getRandomValues + localStorage
├── app/
│   ├── globals.css                 # @import 'tailwindcss'
│   ├── layout.tsx
│   ├── page.tsx                    # landing page
│   └── auction/
│       ├── page.tsx                # loads AuctionClient with ssr: false
│       └── AuctionClient.tsx       # seller + bidder UI
├── contract/
│   ├── package.json                # compact script (toolchain pinned)
│   └── src/
│       ├── private-reserve-auction.compact
│       ├── index.ts                # CompiledContract.withVacantWitnesses
│       └── managed/private-reserve-auction/  # compiler output (gitignored)
├── scripts/
│   └── sync-zk-assets.mjs          # → public/zk/private-reserve-auction/{compiler,keys,zkir}/
└── public/zk/private-reserve-auction/        # gitignored until sync
```

---

## 2) Prerequisites

```bash
node --version   # 20+
docker --version # optional local devnet tests

curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/download/compact-v0.5.1/compact-installer.sh | sh
compact update 0.36.1      # Ledger 9.1 toolchain, language 0.28.0
```

Browser: a **Ledger 9 build of the 1AM wallet** on `preview`, with tNIGHT (from `https://faucet.preview.midnight.network/`) registered for DUST.

---

## 3) Template Files

| File | Role | Change it when |
|---|---|---|
| `package.json` | Next.js 15 + Tailwind v4 app; all deps at root | Adding dependencies (versions from `references/versions.json`) |
| `contract/package.json` | `compact compile +0.36.1 src/private-reserve-auction.compact src/managed/private-reserve-auction` | Renaming the contract |
| `contract/src/private-reserve-auction.compact` | The contract (§5) | Auction rules change |
| `contract/src/index.ts` | `CompiledAuctionContract` (§6) | Renaming, adding witnesses |
| `lib/midnight.ts` | Session and providers (§9) | Almost never |
| `lib/auction.ts` | Contract API (§10) | Circuits or ledger fields change |
| `app/auction/AuctionClient.tsx` | UI (§11) | UI changes, target network |
| `scripts/sync-zk-assets.mjs` | ZK asset copy (§12) | Renaming the contract |
| `next.config.mjs`, `postcss.config.mjs`, `app/layout.tsx`, `app/globals.css` | Build and styling config | Restyling |

---

## 4) Compile and Sync

```bash
npm run compact
npm run sync:assets
```

Expected circuits: `bid`, `closeAuction`, `revealPrice`, `claimItem`, `claimProceeds`.

---

## 5) `contract/src/private-reserve-auction.compact`

Source: `templates/private-reserve-auction-dapp/contract/src/private-reserve-auction.compact`.

```compact
pragma language_version >= 0.28.0;
import CompactStandardLibrary;

export enum AuctionState {
    OPEN,
    CLOSED,
    SETTLED
}

export sealed ledger organizer: Bytes<32>;
export sealed ledger hiddenPrice: Bytes<32>;
export sealed ledger maxBids: Uint<16>;
export ledger publicPrice: Uint<32>;
export ledger auctionState: AuctionState;
export ledger bidders: Map<Bytes<32>, Uint<32>>;
export ledger bidCount: Counter;
export ledger highestBid: Uint<32>;
export ledger winnerClaimed: Set<UserAddress>;

constructor(minPrice: Uint<32>, maxBidCount: Uint<16>, _secret: Bytes<32>) {
    assert(minPrice > 0, "Reserve price must be greater than zero");
    assert(maxBidCount > 0, "Max bids must be greater than zero");

    const pubKey = getDappPublicKey(_secret);
    organizer = disclose(pubKey);

    hiddenPrice = commitPrice(minPrice as Bytes<32>, _secret);
    maxBids = disclose(maxBidCount);
    publicPrice = 0;
    highestBid = 0;
    auctionState = AuctionState.OPEN;
}

export circuit bid(bidAmount: Uint<32>, _address: UserAddress, _secret: Bytes<32>): [] {
    assert(auctionState == AuctionState.OPEN, "Auction is not open");
    assert(bidCount < maxBids, "Bids are full");
    assert(bidAmount > 0, "Bid must be greater than zero");

    const pubKey = getDappPublicKey(_secret);
    assert(pubKey != organizer, "Organizer cannot bid");

    const bidderId = disclose(pubKey);
    const publicBid = disclose(bidAmount);

    if (bidders.member(bidderId)) {
        assert(bidders.lookup(bidderId) < publicBid, "New bid must be higher");
    }

    bidders.insert(bidderId, publicBid);
    bidCount.increment(1);

    if (publicBid > highestBid) {
        highestBid = publicBid;
    }

    if (bidCount == maxBids) {
        auctionState = AuctionState.CLOSED;
    }
}

export circuit closeAuction(_secret: Bytes<32>): [] {
    const pubKey = getDappPublicKey(_secret);
    assert(organizer == pubKey, "Only organizer can close");
    assert(auctionState == AuctionState.OPEN, "Auction already closed");

    auctionState = AuctionState.CLOSED;
}

export circuit revealPrice(minPrice: Uint<32>, _secret: Bytes<32>): [] {
    const pubKey = getDappPublicKey(_secret);
    assert(organizer == pubKey, "Only organizer can reveal");
    assert(auctionState == AuctionState.CLOSED, "Auction not closed");

    const hashedPrice = commitPrice(minPrice as Bytes<32>, _secret);
    assert(hashedPrice == hiddenPrice, "Price mismatch — cannot change reserve");

    publicPrice = disclose(minPrice);
    auctionState = AuctionState.SETTLED;
}

export circuit claimItem(_address: UserAddress, _secret: Bytes<32>): [] {
    assert(auctionState == AuctionState.SETTLED, "Auction not settled");
    assert(highestBid >= publicPrice, "No valid winning bid");
    assert(!winnerClaimed.member(disclose(_address)), "Already claimed");

    const pubKey = getDappPublicKey(_secret);
    const bidderId = disclose(pubKey);
    assert(bidders.lookup(bidderId) == highestBid, "Not the highest bidder");

    // Privacy boundary: winner pays reserve, identity revealed
    receiveUnshielded(nativeToken(), publicPrice as Uint<128>);
    winnerClaimed.insert(disclose(_address));
}

export circuit claimProceeds(_address: UserAddress, _secret: Bytes<32>): [] {
    const pubKey = getDappPublicKey(_secret);
    assert(organizer == pubKey, "Not organizer");
    assert(auctionState == AuctionState.SETTLED, "Auction not settled");
    assert(winnerClaimed.size() > 0, "No winner claimed");

    sendUnshielded(
        nativeToken(),
        publicPrice as Uint<128>,
        right<ContractAddress, UserAddress>(disclose(_address))
    );
}

circuit commitPrice(_price: Bytes<32>, _secret: Bytes<32>): Bytes<32> {
    return persistentCommit<Bytes<32>>(_price, _secret);
}

circuit getDappPublicKey(_secret: Bytes<32>): Bytes<32> {
    return persistentHash<Vector<2, Bytes<32>>>([pad(32, "private-auction:pk:"), _secret]);
}
```

### Privacy model summary

| Phase | Bidder identity | On-chain data |
|---|---|---|
| Deploy | Seller hidden | `hiddenPrice` = `persistentCommit(price, secret)` hash |
| Bid | **Hidden** (hash only) | Bid amount **public** in `Map`; bidder identity = hash |
| Close | Hidden | `auctionState = CLOSED` |
| Reveal | Hidden | `publicPrice` disclosed; verified against commitment |
| **Claim** | **Public** | `receiveUnshielded` + address in `winnerClaimed` — **privacy boundary** |
| Proceeds | Seller **public** | `sendUnshielded` to seller address |

### Always-public Compact domains

- Ledger fields (after `disclose()` or safe commits)
- Circuit return values from exported circuits
- Contract-to-contract calls
- **Unshielded token transfers** (`receiveUnshielded`, `sendUnshielded`)
- **Bid amounts** (disclosed in `bid` circuit)

---

## 6) `contract/src/index.ts`

No witnesses, so use `withVacantWitnesses`. `CompiledContract` comes from `@midnight-ntwrk/compact-js`. A plain static import is fine with Midnight.js 5: keep a single copy of each WASM package and load the page client-only (`ssr: false`), and the old lazy-import workaround isn't needed.

```typescript
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { Contract } from './managed/private-reserve-auction/contract/index.js';
export { ledger } from './managed/private-reserve-auction/contract/index.js';

export type AuctionPrivateState = Record<string, never>;
export type AuctionContract = Contract<AuctionPrivateState>;

export const CompiledAuctionContract = CompiledContract.make<AuctionContract>('private-reserve-auction', Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets('/zk/private-reserve-auction'), // label only in the browser
);
```

---

## 7) `lib/address.ts`

Decode Bech32 unshielded addresses for `UserAddress` circuit args.

```typescript
import { MidnightBech32m, UnshieldedAddress } from '@midnightntwrk/wallet-sdk-address-format';

export function bech32ToUserAddress(bech32: string, networkId: string): { bytes: Uint8Array } {
  const parsed = MidnightBech32m.parse(bech32).decode(UnshieldedAddress, networkId);
  return { bytes: new Uint8Array(parsed.data) };
}
```

Never pass raw Bech32 strings or shielded coin public keys where `UserAddress` is expected. The `{ bytes }` wrapper is required for `UserAddress` but **not** for `Bytes<32>` — those are raw `Uint8Array`.

---

## 8) `lib/secret.ts`

`generateSecret()` returns 32 random bytes; `saveSecret` / `loadSecret` keep seller and bidder secrets in `localStorage` per role and contract address. Losing one loses that role's authority; there is no on-chain recovery.

---

## 9) Provider Setup — `lib/midnight.ts`

The canonical Ledger 9 session (`references/midnight-session.md`), unchanged.

**Why this shape (Midnight.js 5):**
- No `setNetworkId`: `dappConnectorNetwork(api)` gives the network id + endpoints, and the id goes in `providers.config`.
- No hand-rolled providers: `dappConnectorProofProvider` / `dappConnectorWalletProviders` are era-aware and do the hex round-trips, so the old lazy `import('@midnightntwrk/ledger-v9')` dance for `CostModel` / `Transaction` is gone.
- No patched indexer provider: indexer 4.4.101 handles no-offset queries.
- `levelPrivateStateProvider` (IndexedDB) replaces the in-memory `setContractAddress()` store, which no longer satisfies the 5.x interface.

---

---

## 10) `lib/auction.ts`

Source: `templates/private-reserve-auction-dapp/lib/auction.ts`. Each circuit wrapper connects with `findDeployedContract` and calls `callTx.<circuit>`.

| Export | Circuit / effect |
|---|---|
| `deployAuction(session, reservePriceNight, maxBidders, sellerSecret)` | Constructor `[stars(reserve), BigInt(maxBidders), sellerSecret]` |
| `placeBid(session, address, bidNight, user, bidderSecret)` | `bid` |
| `closeAuction(session, address, sellerSecret)` | `closeAuction` |
| `revealPrice(session, address, reservePriceNight, sellerSecret)` | `revealPrice` (checked against the commitment) |
| `claimItem(session, address, user, bidderSecret)` | `claimItem` (pays the reserve, address becomes public) |
| `claimProceeds(session, address, seller, sellerSecret)` | `claimProceeds` |
| `fetchAuctionState(session, address)` | `auctionState` (`OPEN`, `CLOSED`, `SETTLED`), `maxBidders`, `publicPriceNight`, `highestBidNight`, `bidCount`, `bidderCount` |
| `userAddressFromSession(session)` | The connected wallet's `UserAddress` |

---

## 11) Frontend — `app/auction/AuctionClient.tsx`

Role cards for seller and bidder, an auction status panel, and indexer polling. It connects with `wallet.connect('preview')`. Two patterns worth reusing:

### `withLoading` pattern

Every circuit call is wrapped in `withLoading(message, fn)` — a reusable helper that centralizes busy/error/status state:

- Sets `busy = true` and `statusMessage = message` before execution
- Passes a `setStatus` callback into `fn` so the async operation can update the status mid-flight (e.g. "Waiting for indexer…")
- Catches errors and surfaces `e.message` in the `error` state
- Resets `busy` and `statusMessage` in `finally`
- Uses `mountedRef` to avoid setting state on unmounted components

This pattern is worth reusing for any Midnight dApp UI — it eliminates repetitive try/catch/setError blocks across every handler.

### Bidder auto-generate secret

In `handlePlaceBid`, the bidder secret is loaded from `localStorage`. If none exists (first bid), a new one is generated and saved immediately. This means bidders never need to manually manage secrets — the UI handles it transparently. The seller path does **not** auto-generate; the secret is created once during deploy and must be recovered from `localStorage` for close/reveal/proceeds.

---

## 12) ZK Asset Sync — `scripts/sync-zk-assets.mjs`

Copies `contract/src/managed/private-reserve-auction/{compiler,keys,zkir}` into `public/zk/private-reserve-auction/`. `compiler/` is required; without it proving fails with `EraMismatchError: artifact-era-undeclared`.

Verify: `http://localhost:3000/zk/private-reserve-auction/keys/bid.prover` returns 200.

---

## 13) End-to-End Browser Flow

```
1. npm install && npm run compact && npm run sync:assets
2. npm run dev
3. Seller: Connect 1AM → Select "I'm a Seller" → Deploy (0.01 NIGHT reserve, 5 max bidders) → copy contract address
4. Bidder (other browser/wallet): Connect → Select "I'm a Bidder" → Paste address → Place bid (0.02 NIGHT)
5. Seller: Close auction (or auto-closes when 5 bids received)
6. Seller: Reveal reserve price (must match deploy value: 0.01 NIGHT)
7. Bidder: Claim item (pays 0.01 NIGHT unshielded — address now public on ledger)
8. Seller: Claim proceeds (0.01 NIGHT to unshielded address)
9. Poll indexer — verify bidCount, highestBid, publicPrice, auctionState transitions
```

---

## 14) Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Organizer cannot bid` | Seller secret used for bid | Use separate bidder secret |
| `New bid must be higher` | Bid amount <= previous bid | Increase bid amount |
| `Auction is not open` | Bid after close | Bid only in OPEN state |
| `Only organizer can close` | Wrong seller secret | Reload from `localStorage` or redeploy |
| `Price mismatch — cannot change reserve` | Wrong price in revealPrice | Use same reserve price as deploy |
| `Not the highest bidder` | Claiming with non-winning secret | Use the secret of the highest bidder |
| `Invalid character 'm' at position 0` | Bech32 passed as bytes | Use `bech32ToUserAddress()` |
| `Version mismatch: compiled code expects 0.21.0, runtime is 0.16.0` | Old runtime | `compact-runtime@0.21.0` + `compact compile +0.36.1` |
| Saved auction not found on Preview | Preview relaunched as a new chain (7 Nov 2026) | Clear stored addresses and redeploy |
| `EraMismatchError: artifact-era-undeclared` | `public/zk/...` lacks `compiler/` | Re-run `npm run sync:assets` |
| ZK 404 | Assets not synced | `npm run sync:assets` |
| Lost seller secret | No recovery on-chain | Redeploy contract; store secret in localStorage |
| `CompiledContract.withVacantWitnesses` TypeScript error | `compact-runtime` vs `compact-js` mismatch | Import `CompiledContract` from `@midnight-ntwrk/compact-js` |
| `ContractMaintenanceAuthority` WASM identity error | Dual `compact-runtime` instances | Delete `contract/node_modules` |
| `bigint` type mismatch on constructor args | Passed `number` where `bigint` expected | Wrap in `BigInt(value)` for `Uint<32>` fields |
| `Bytes<32>` wrapped in `{ bytes: ... }` mismatch | Confusing it with `UserAddress` | Raw `Uint8Array` for `Bytes<32>`; `{ bytes }` only for `UserAddress` |
| `bidCount` shows NaN | Field name mismatch (`maxBidders` vs `maxBids`) | Access `l.maxBids` not `l.maxBidders` (typed `ledger()` now flags this at compile time) |
| `Counter` type `= undefined` error | Counter doesn't support assignment | Don't initialize in constructor; use `.increment(1)` |
| Network mismatch | `wallet.connect('preprod')` but targeting Preview | Use `wallet.connect('preview')` |
| `walletInstalled` stuck at `null` (loading forever) | `detectWallet()` throws but no `.catch()` handler | Add `.catch(() => setWalletInstalled(false))` — see `AuctionClient.tsx` useEffect |
| `getProvingProvider` or `getConfiguration` throws during connect | Wallet not fully initialized or user rejected prompt | Wrap `createConnectedSession` call in try/catch; surface `e.message` as connection error |
| `expected instance of ChargedState` / identity mismatch | Two copies of a WASM package (mixed `@midnight-ntwrk` / `@midnightntwrk` Midnight.js, or duplicate runtimes) | One copy per package: `npm ls @midnight-ntwrk/compact-runtime @midnightntwrk/ledger-v9`; decode state with your own runtime import |

---

## 15) Adapting This Template

1. **Copy, run, then change.** Copy `templates/private-reserve-auction-dapp/` and get it working unchanged first.
2. **Contract.** Edit `contract/src/private-reserve-auction.compact`. If you rename it, update the `compact` script, the `managed/<name>` imports and ZK path in `contract/src/index.ts`, `ZK_PATH` in `lib/auction.ts`, and the folder in `scripts/sync-zk-assets.mjs`.
3. **Witnesses.** None today (`withVacantWitnesses`). Adding some means `CompiledContract.withWitnesses(...)`, a real `AuctionPrivateState`, and a real `initialPrivateState` in `lib/auction.ts`.
4. **Circuits and state.** Add wrappers in `lib/auction.ts`; keep `AUCTION_STATE_NAMES` in the contract's enum order; extend `fetchAuctionState` for new fields. Convert NIGHT to Stars with `stars()` before calling circuits.
5. **UI.** Add handlers in `AuctionClient.tsx` with `withLoading`; change `wallet.connect('preview')` to target another network.
6. **Secrets.** Seller/bidder secrets and the private-state password (`demoStoragePassword`) live in `localStorage`. Demo-grade; for production, back them up or derive them from wallet-held material.
7. **Recompile and resync** after every contract change.
8. **Versions.** Add dependencies only at the versions in `references/versions.json`.

---

## 16) Agent Checklist

When generating this dApp for a user:

- [ ] Start from `templates/private-reserve-auction-dapp/`; do not retype it
- [ ] Keep the five exported circuits unless the user's rules differ
- [ ] `npm run compact`, then `npm run sync:assets` (with `compiler/`)
- [ ] Use `CompiledContract.withVacantWitnesses` from `@midnight-ntwrk/compact-js` (not `compact-runtime`)
- [ ] Single copy of each WASM package (`npm ls`); the auction page loads the client with `ssr: false`
- [ ] Keep `createConnectedSession` with the plain indexer provider (no patch on Ledger 9)
- [ ] Constructor args: `[BigInt(reservePriceStars), BigInt(maxBidders), rawUint8Array]`
- [ ] Decode unshielded Bech32m via `wallet-sdk-address-format`
- [ ] Store seller/bidder secrets in `localStorage` per contract address
- [ ] UI explains privacy boundary before claim button
- [ ] Document: reserve price in NIGHT (UI) / Stars (contract); 1 NIGHT = 1,000,000 Stars

---

## 17) Related Skills

| Next step | Skill |
|---|---|
| Wallet connect only | `react-wallet-connector/` |
| Unshielded token flows | `token-transfers/` |
| Payment vault pattern | `example-payment-dapp/` |
| Privacy audit | `security/` |
| Compact language reference | `compact/` |
| Local vitest harness | `example-hello-world/` |
