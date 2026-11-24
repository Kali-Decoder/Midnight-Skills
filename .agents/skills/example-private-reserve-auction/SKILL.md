---
name: example-private-reserve-auction-dapp
author: tusharpamnani
description: >
  Build a private reserve auction dApp on Midnight Network — hidden reserve price, public
  bids, private bidder identities. Covers private-reserve-auction.compact (no witnesses,
  persistentCommit, Map, Counter, disclose, receiveUnshielded/sendUnshielded), Next.js
  frontend, 1AM wallet integration, low-level deploy/call, indexer polling. Use for
  teaching privacy boundaries, commitment-based auctions, seller access control, or
  unshielded settlement. Triggers: private auction, reserve auction, silent auction,
  privacy boundary, persistentCommit, getDappPublicKey, unshielded claim, hidden price,
  bid commitment, seller reveal. Also use when extending locker-dapp or payment-dapp
  wallet/provider patterns to privacy-preserving auction flows.
---

# Midnight Network Private Reserve Auction DApp

> **Versions:** every pin in this skill comes from `references/versions.json`, the repo's single source of truth (checked in CI). Resolve the current set at use time with `references/volatile.md`. Never install `@latest`.

A **private reserve auction contract** lets a seller hide the reserve price on-chain while bidders place public bids with private identities. The winner crosses the **privacy boundary** when claiming the item via unshielded NIGHT payment.

**Runnable template:** Run `npm install && npm run compact && npm run sync:assets && npm run dev` after installing the [1AM wallet](https://1am.dev).

**What this skill produces:**
- `contract/` — `private-reserve-auction.compact` (no witnesses, Map, Counter) + compile scripts
- `app/auction/` — Next.js client UI (seller deploy/close/reveal/claim + bidder place bid/claim item)
- `lib/midnight.ts` — wallet session + patched indexer provider
- `lib/auction.ts` — deploy, `bid`, `closeAuction`, `revealPrice`, `claimItem`, `claimProceeds`, ledger decode
- `lib/address.ts` — Bech32 unshielded address → `{ bytes: Uint8Array }` for `UserAddress` circuit args
- `lib/secret.ts` — generate/store 32-byte DApp secrets in `localStorage`
- `public/zk/private-reserve-auction/` — ZK proving assets synced from contract build

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

1. **Contract** — write `private-reserve-auction.compact`; compile with `npm run compact`
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
private-reserve-auction-dapp/
├── package.json
├── next.config.mjs
├── postcss.config.mjs
├── lib/
│   ├── isomorphic-ws-fix.mjs
│   ├── midnight.ts                 # session, patched provider, hex helpers
│   ├── auction.ts                  # deploy, circuits, decode state
│   ├── address.ts                  # Bech32 → UserAddress bytes
│   └── secret.ts                   # crypto.getRandomValues + localStorage
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx                    # landing page
│   └── auction/
│       ├── page.tsx                # server shell
│       └── AuctionClient.tsx       # seller + bidder UI
├── contract/
│   ├── package.json
│   └── src/
│       ├── private-reserve-auction.compact
│       ├── index.ts                # CompiledContract.withVacantWitnesses
│       └── managed/private-reserve-auction/  # compiler output (gitignored)
├── scripts/
│   └── sync-zk-assets.mjs          # → public/zk/private-reserve-auction/{compiler,keys,zkir}/  (compiler/ is required by Midnight.js 5)
└── public/zk/private-reserve-auction/        # keys + zkir (gitignored until sync)
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

## 3) Root `package.json`

```json
{
  "name": "private-reserve-auction-dapp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "npm run sync:assets && next build",
    "compact": "npm run compact --prefix contract",
    "sync:assets": "node scripts/sync-zk-assets.mjs",
    "postinstall": "echo 'All deps at root level'"
  },
  "dependencies": {
    "@midnight-ntwrk/compact-js": "3.0.2",
    "@midnight-ntwrk/compact-runtime": "0.21.0",
    "@midnightntwrk/ledger-v9": "1.0.2",
    "@midnightntwrk/midnight-js-contracts": "5.0.2",
    "@midnightntwrk/midnight-js-fetch-zk-config-provider": "5.0.2",
    "@midnightntwrk/midnight-js-indexer-public-data-provider": "5.0.2",
    "@midnightntwrk/dapp-connector-api": "4.1.0",
    "@midnightntwrk/midnight-js-dapp-connector-proof-provider": "5.0.2",
    "@midnightntwrk/midnight-js-level-private-state-provider": "5.0.2",
    "@midnightntwrk/midnight-js-types": "5.0.2",
    "@midnightntwrk/midnight-js-utils": "5.0.2",
    "@midnightntwrk/wallet-sdk-address-format": "4.0.1",
    "@tailwindcss/postcss": "^4.3.2",
    "next": "^15.0.0",
    "postcss": "^8.5.16",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwindcss": "^4.3.2"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0"
  }
}
```

---

## 4) `contract/package.json`

```json
{
  "name": "@private-reserve-auction/contract",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "compact": "compact compile +0.36.1 src/private-reserve-auction.compact src/managed/private-reserve-auction"
  },
  "devDependencies": {
    "@midnight-ntwrk/compact-runtime": "0.21.0"
  }
}
```

Compile:

```bash
npm run compact
# → contract/src/managed/private-reserve-auction/{compiler,contract,keys,zkir}/
npm run sync:assets
# → public/zk/private-reserve-auction/{compiler,keys,zkir}/  (compiler/ is required by Midnight.js 5)
```

Expected circuits: `bid`, `closeAuction`, `revealPrice`, `claimItem`, `claimProceeds`.

---

## 5) `contract/src/private-reserve-auction.compact`

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

```typescript
import { fromHex, toHex } from './midnight';

export function generateSecret(): Uint8Array {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function saveSecret(
  role: 'seller' | 'bidder',
  contractAddress: string,
  secret: Uint8Array,
) {
  localStorage.setItem(`private-auction:${role}:${contractAddress}`, toHex(secret));
}

export function loadSecret(
  role: 'seller' | 'bidder',
  contractAddress: string,
): Uint8Array | null {
  const hex = localStorage.getItem(`private-auction:${role}:${contractAddress}`);
  return hex ? fromHex(hex) : null;
}
```

---

## 9) Provider Setup — `lib/midnight.ts`

Use the canonical Ledger 9 session (`references/midnight-session.md`) unchanged:

```typescript
import type { ConnectedAPI, InitialAPI } from '@midnightntwrk/dapp-connector-api';
import {
  dappConnectorNetwork,
  dappConnectorProofProvider,
  dappConnectorWalletProviders,
} from '@midnightntwrk/midnight-js-dapp-connector-proof-provider';
import { indexerPublicDataProvider } from '@midnightntwrk/midnight-js-indexer-public-data-provider';
import { FetchZkConfigProvider } from '@midnightntwrk/midnight-js-fetch-zk-config-provider';
import { levelPrivateStateProvider } from '@midnightntwrk/midnight-js-level-private-state-provider';
import type { MidnightProviders } from '@midnightntwrk/midnight-js-types';
import type { MidnightNetwork } from '@midnightntwrk/midnight-js-utils';
import { CostModel } from '@midnightntwrk/ledger-v9';
import { ContractState } from '@midnight-ntwrk/compact-runtime';
import { MidnightBech32m, ShieldedCoinPublicKey } from '@midnightntwrk/wallet-sdk-address-format';

export type ConnectedSession = {
  api: ConnectedAPI;
  /** Network id + endpoints, read from the wallet. There is no global setNetworkId any more. */
  network: MidnightNetwork;
  providers: MidnightProviders;
  unshieldedAddress: string;
  coinPublicKeyBytes: Uint8Array;
};

export function fromHex(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Uint8Array.from(h.match(/.{1,2}/g) ?? [], (b) => parseInt(b, 16));
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Demo-grade password for the encrypted IndexedDB private-state store: random, kept in localStorage.
 * Production apps should ask the user or derive it from wallet-held material.
 */
function demoStoragePassword(): Promise<string> {
  const k = 'midnight-private-storage-password';
  let pw = localStorage.getItem(k);
  if (!pw) {
    pw = `Mn-${crypto.randomUUID()}-${crypto.randomUUID()}`;
    localStorage.setItem(k, pw);
  }
  return Promise.resolve(pw);
}

export async function detectWallet(): Promise<InitialAPI> {
  const midnight = (window as unknown as { midnight?: Record<string, InitialAPI> }).midnight ?? {};
  const w = midnight['1am'] ?? Object.values(midnight)[0];
  if (!w) throw new Error('No Midnight wallet extension found');
  return w;
}

export async function createConnectedSession(api: ConnectedAPI, zkAssetPath: string): Promise<ConnectedSession> {
  const network = await dappConnectorNetwork(api);
  const [{ unshieldedAddress }, shielded] = await Promise.all([
    api.getUnshieldedAddress(),
    api.getShieldedAddresses(),
  ]);

  // zkAssetPath must serve compiler/ (contract-manifest.json, contract-info.json), keys/ and zkir/.
  const zkConfigProvider = new FetchZkConfigProvider<string>(
    new URL(zkAssetPath, window.location.origin).toString(),
    { fetchFunc: window.fetch.bind(window) },
  );
  const proofProvider = await dappConnectorProofProvider(api, zkConfigProvider, CostModel.initialCostModel());
  const { walletProvider, midnightProvider } = await dappConnectorWalletProviders(api);

  return {
    api,
    network,
    providers: {
      privateStateProvider: levelPrivateStateProvider({
        accountId: unshieldedAddress,
        privateStoragePasswordProvider: demoStoragePassword,
      }),
      publicDataProvider: indexerPublicDataProvider(network.indexer),
      zkConfigProvider,
      proofProvider,
      walletProvider,
      midnightProvider,
      config: { networkId: network.networkId, ttlSeconds: 3600 },
    },
    unshieldedAddress,
    // The connector returns keys in Bech32m, not hex.
    coinPublicKeyBytes: new Uint8Array(
      ShieldedCoinPublicKey.codec.decode(network.networkId, MidnightBech32m.parse(shielded.shieldedCoinPublicKey)).data,
    ),
  };
}

/** Latest on-chain state of a contract, decoded with this app's own compact-runtime copy. */
export async function queryLatestState(session: ConnectedSession, contractAddress: string) {
  const read = await session.providers.publicDataProvider.queryContractState(contractAddress);
  if (!read) return null;
  return read.contractState.deserialize({ v9: ContractState });
}
```

**Why this shape (Midnight.js 5):**
- No `setNetworkId`: `dappConnectorNetwork(api)` gives the network id + endpoints, and the id goes in `providers.config`.
- No hand-rolled providers: `dappConnectorProofProvider` / `dappConnectorWalletProviders` are era-aware and do the hex round-trips, so the old lazy `import('@midnightntwrk/ledger-v9')` dance for `CostModel` / `Transaction` is gone.
- No patched indexer provider: indexer 4.4.101 handles no-offset queries.
- `levelPrivateStateProvider` (IndexedDB) replaces the in-memory `setContractAddress()` store, which no longer satisfies the 5.x interface.

---

## 10) `lib/auction.ts`

```typescript
import type { ProvableCircuitId } from '@midnight-ntwrk/compact-js';
import { deployContract, findDeployedContract } from '@midnightntwrk/midnight-js-contracts';
import type { MidnightProviders } from '@midnightntwrk/midnight-js-types';
import { CompiledAuctionContract, ledger, type AuctionContract, type AuctionPrivateState } from '../contract/src/index';
import { queryLatestState, type ConnectedSession } from './midnight';
import { bech32ToUserAddress } from './address';

const PRIVATE_STATE_ID = 'PrivateAuctionState';
export const ZK_PATH = '/zk/private-reserve-auction';
const AUCTION_STATE_NAMES = ['OPEN', 'CLOSED', 'SETTLED'] as const;
export type AuctionStateName = (typeof AUCTION_STATE_NAMES)[number];

type AuctionProviders = MidnightProviders<ProvableCircuitId<AuctionContract>, typeof PRIVATE_STATE_ID, AuctionPrivateState>;
const providersFor = (s: ConnectedSession) => s.providers as unknown as AuctionProviders;
const stars = (night: number) => BigInt(Math.round(night * 1_000_000));

export async function deployAuction(session: ConnectedSession, reservePriceNight: number, maxBidders: number, sellerSecret: Uint8Array) {
  const deployed = await deployContract(providersFor(session), {
    compiledContract: CompiledAuctionContract,
    args: [stars(reservePriceNight), BigInt(maxBidders), sellerSecret],
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: {},
  });
  return deployed.deployTxData.public.contractAddress;
}

const connect = (session: ConnectedSession, contractAddress: string) =>
  findDeployedContract(providersFor(session), {
    compiledContract: CompiledAuctionContract,
    contractAddress,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: {},
  });

export const placeBid = async (session: ConnectedSession, contractAddress: string, bidNight: number, user: { bytes: Uint8Array }, bidderSecret: Uint8Array) =>
  (await connect(session, contractAddress)).callTx.bid(stars(bidNight), user, bidderSecret);

export const closeAuction = async (session: ConnectedSession, contractAddress: string, sellerSecret: Uint8Array) =>
  (await connect(session, contractAddress)).callTx.closeAuction(sellerSecret);

export const revealPrice = async (session: ConnectedSession, contractAddress: string, reservePriceNight: number, sellerSecret: Uint8Array) =>
  (await connect(session, contractAddress)).callTx.revealPrice(stars(reservePriceNight), sellerSecret);

export const claimItem = async (session: ConnectedSession, contractAddress: string, user: { bytes: Uint8Array }, bidderSecret: Uint8Array) =>
  (await connect(session, contractAddress)).callTx.claimItem(user, bidderSecret);

export const claimProceeds = async (session: ConnectedSession, contractAddress: string, seller: { bytes: Uint8Array }, sellerSecret: Uint8Array) =>
  (await connect(session, contractAddress)).callTx.claimProceeds(seller, sellerSecret);

export async function fetchAuctionState(session: ConnectedSession, contractAddress: string) {
  const state = await queryLatestState(session, contractAddress);
  if (!state) return null;
  const l = ledger(state.data);
  const stateIdx = Number(l.auctionState);
  return {
    auctionState: (AUCTION_STATE_NAMES[stateIdx] ?? `UNKNOWN(${stateIdx})`) as AuctionStateName | string,
    auctionStateIndex: stateIdx,
    maxBidders: Number(l.maxBids),
    publicPriceNight: Number(l.publicPrice) / 1_000_000,
    highestBidNight: Number(l.highestBid) / 1_000_000,
    bidCount: Number(l.bidCount),             // Counter → bigint
    bidderCount: Number(l.bidders.size()),    // ledger Map/Set → size()
  };
}

export const userAddressFromSession = (session: ConnectedSession) =>
  bech32ToUserAddress(session.unshieldedAddress, session.network.networkId);
```

**Key details:**
- Argument shapes come from the generated `.d.ts`: `Uint<…>` → `bigint`, `Bytes<32>` secrets → plain `Uint8Array`, `UserAddress` → `{ bytes }`
- Typed providers mean wrong shapes fail at compile time instead of at proving time
- Reserve price and bids in NIGHT are converted to Stars (×1,000,000) before reaching the contract

---

## 11) Frontend — `app/auction/AuctionClient.tsx`

```tsx
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { detectWallet, createConnectedSession } from '@/lib/midnight';
import {
  deployAuction,
  placeBid,
  closeAuction,
  revealPrice,
  claimItem,
  claimProceeds,
  fetchAuctionState,
  userAddressFromSession,
  ZK_PATH,
} from '@/lib/auction';
import { generateSecret, loadSecret, saveSecret } from '@/lib/secret';
import type { ConnectedSession } from '@/lib/midnight';

type Role = 'seller' | 'bidder';

const STATE_LABELS: Record<string, string> = {
  OPEN: 'Open for Bids',
  CLOSED: 'Bidding Closed',
  SETTLED: 'Settled',
};

export default function AuctionClient() {
  const [session, setSession] = useState<ConnectedSession | null>(null);
  const [role, setRole] = useState<Role>('bidder');
  const [contractAddress, setContractAddress] = useState('');
  const [auctionState, setAuctionState] = useState<Awaited<ReturnType<typeof fetchAuctionState>> | null>(null);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [walletInstalled, setWalletInstalled] = useState<boolean | null>(null);
  const mountedRef = useRef(true);

  const [reservePriceNight, setReservePriceNight] = useState('0.01');
  const [maxBidders, setMaxBidders] = useState('5');
  const [bidAmountNight, setBidAmountNight] = useState('0.02');

  useEffect(() => {
    detectWallet()
      .then((w) => setWalletInstalled(w !== null))
      .catch(() => setWalletInstalled(false));
    return () => { mountedRef.current = false; };
  }, []);

  const withLoading = useCallback(async <T,>(
    message: string,
    fn: (setStatus: (msg: string) => void) => Promise<T>,
  ): Promise<T> => {
    setBusy(true);
    setError('');
    setStatusMessage(message);
    try {
      const result = await fn((msg: string) => {
        if (mountedRef.current) setStatusMessage(msg);
      });
      return result;
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : String(e));
      }
      throw e;
    } finally {
      if (mountedRef.current) {
        setBusy(false);
        setStatusMessage('');
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!session || !contractAddress) return;
    try {
      const state = await fetchAuctionState(session, contractAddress);
      if (mountedRef.current) setAuctionState(state);
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : 'Refresh failed');
    }
  }, [session, contractAddress]);

  useEffect(() => { void refresh(); }, [refresh]);

  const connectWallet = useCallback(async () => {
    setConnecting(true);
    setError('');
    try {
      const wallet = await detectWallet();
      if (!wallet) {
        setError('1AM wallet not detected. Please install the 1AM browser extension.');
        return;
      }
      const api = await wallet.connect('preview');
      const s = await createConnectedSession(api, ZK_PATH);
      setSession(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect wallet');
    } finally {
      setConnecting(false);
    }
  }, []);

  const handleDeploy = useCallback(async () => {
    if (!session) return;
    await withLoading('Deploying auction contract…', async (setStatus) => {
      const secret = generateSecret();
      const addr = await deployAuction(
        session,
        Number(reservePriceNight),
        Number(maxBidders),
        secret,
      );
      setContractAddress(addr);
      saveSecret('seller', addr, secret);

      setStatus('Waiting for indexer…');
      const state = await fetchAuctionState(session, addr);
      setAuctionState(state);
    });
  }, [session, withLoading, reservePriceNight, maxBidders]);

  const handlePlaceBid = useCallback(async () => {
    if (!session || !contractAddress) return;
    await withLoading('Placing bid (proving + submitting)…', async (setStatus) => {
      let secret = loadSecret('bidder', contractAddress);
      if (!secret) {
        secret = generateSecret();
        saveSecret('bidder', contractAddress, secret);
      }
      await placeBid(session, contractAddress, Number(bidAmountNight), userAddressFromSession(session), secret);

      setStatus('Waiting for indexer…');
      const state = await fetchAuctionState(session, contractAddress);
      setAuctionState(state);
    });
  }, [session, contractAddress, withLoading, bidAmountNight]);

  const handleCloseAuction = useCallback(async () => {
    if (!session || !contractAddress) return;
    const secret = loadSecret('seller', contractAddress);
    if (!secret) { setError('Seller secret not found.'); return; }
    await withLoading('Closing auction…', async (setStatus) => {
      await closeAuction(session, contractAddress, secret);
      setStatus('Waiting for indexer…');
      const state = await fetchAuctionState(session, contractAddress);
      setAuctionState(state);
    });
  }, [session, contractAddress, withLoading]);

  const handleRevealPrice = useCallback(async () => {
    if (!session || !contractAddress) return;
    const secret = loadSecret('seller', contractAddress);
    if (!secret) { setError('Seller secret not found.'); return; }
    await withLoading('Revealing reserve price…', async (setStatus) => {
      await revealPrice(session, contractAddress, Number(reservePriceNight), secret);
      setStatus('Waiting for indexer…');
      const state = await fetchAuctionState(session, contractAddress);
      setAuctionState(state);
    });
  }, [session, contractAddress, withLoading, reservePriceNight]);

  const handleClaimItem = useCallback(async () => {
    if (!session || !contractAddress) return;
    const secret = loadSecret('bidder', contractAddress);
    if (!secret) { setError('Bidder secret not found. Place a bid first.'); return; }
    await withLoading('Claiming item (proving + submitting)…', async (setStatus) => {
      await claimItem(session, contractAddress, userAddressFromSession(session), secret);
      setStatus('Waiting for indexer…');
      const state = await fetchAuctionState(session, contractAddress);
      setAuctionState(state);
    });
  }, [session, contractAddress, withLoading]);

  const handleClaimProceeds = useCallback(async () => {
    if (!session || !contractAddress) return;
    const secret = loadSecret('seller', contractAddress);
    if (!secret) { setError('Seller secret not found.'); return; }
    await withLoading('Claiming proceeds…', async (setStatus) => {
      await claimProceeds(session, contractAddress, userAddressFromSession(session), secret);
      setStatus('Waiting for indexer…');
      const state = await fetchAuctionState(session, contractAddress);
      setAuctionState(state);
    });
  }, [session, contractAddress, withLoading]);

  const reset = useCallback(() => {
    setContractAddress('');
    setAuctionState(null);
    setError('');
  }, []);

  if (walletInstalled === false) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold mb-4">1AM Wallet Required</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          Please install the <strong>1AM</strong> browser extension for Midnight Network.
        </p>
        <a
          href="https://1am.xyz"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Install 1AM Wallet
        </a>
      </div>
    );
  }

  const state = auctionState;

  return (
    <div className="mx-auto max-w-lg w-full">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Private Reserve Auction</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Hidden reserve price, public bids, private bidder identities
        </p>
      </div>

      {!session && (
        <div className="text-center">
          <button
            onClick={connectWallet}
            disabled={connecting}
            className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-900 px-8 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {connecting ? 'Connecting…' : 'Connect 1AM Wallet'}
          </button>
        </div>
      )}

      {session && (
        <div className="mb-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="font-medium text-zinc-500 uppercase tracking-wider mb-2">Wallet</p>
          <p className="text-zinc-700 dark:text-zinc-300 truncate">
            <span className="text-zinc-400">Unshielded: </span>
            {session.unshieldedAddress}
          </p>
          <p className="text-zinc-500 mt-1">
            Network: <span className="font-medium text-zinc-700 dark:text-zinc-300">{session.network.networkId}</span>
          </p>
        </div>
      )}

      {session && !contractAddress && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => setRole('seller')}
            className={`rounded-lg border p-5 text-left transition ${
              role === 'seller'
                ? 'border-zinc-900 dark:border-white bg-zinc-100 dark:bg-zinc-800'
                : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
            }`}
          >
            <p className="text-sm font-semibold">I&apos;m a Seller</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Deploy an auction with a hidden reserve price
            </p>
          </button>
          <button
            onClick={() => setRole('bidder')}
            className={`rounded-lg border p-5 text-left transition ${
              role === 'bidder'
                ? 'border-zinc-900 dark:border-white bg-zinc-100 dark:bg-zinc-800'
                : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
            }`}
          >
            <p className="text-sm font-semibold">I&apos;m a Bidder</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Place private bids on an existing auction
            </p>
          </button>
        </div>
      )}

      {/* Deploy form — seller only, no contract yet */}
      {session && !contractAddress && role === 'seller' && !busy && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
              Reserve price (NIGHT)
              <input
                type="number"
                min={0.000001}
                step={0.01}
                value={reservePriceNight}
                onChange={(e) => setReservePriceNight(e.target.value)}
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
              Max bidders
              <input
                type="number"
                min={1}
                value={maxBidders}
                onChange={(e) => setMaxBidders(e.target.value)}
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
          </div>
          <button
            onClick={handleDeploy}
            className="w-full h-11 rounded-full bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Deploy Auction
          </button>
        </div>
      )}

      {/* Bidder hint — no contract yet */}
      {session && !contractAddress && role === 'bidder' && !busy && (
        <div className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-8">
          <p>Paste a deployed auction contract address to participate.</p>
          <p className="mt-2">Ask the seller for the contract address.</p>
        </div>
      )}

      {/* Auction state + actions */}
      {session && contractAddress && (
        <div className="space-y-6">
          <div className="flex items-center justify-center gap-2 text-xs">
            <span className="rounded-full border border-zinc-200 dark:border-zinc-800 px-3 py-1 text-zinc-500 dark:text-zinc-400">
              Viewing as <strong className="text-zinc-700 dark:text-zinc-300 capitalize">{role}</strong>
            </span>
            <button
              onClick={reset}
              className="text-zinc-400 underline underline-offset-2 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              switch role
            </button>
          </div>

          {state && (
            <div className="rounded-lg border border-zinc-200 p-6 text-center dark:border-zinc-800">
              <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Auction State</p>
              <p className="text-2xl font-bold tracking-tight">
                {STATE_LABELS[state.auctionState] ?? state.auctionState}
              </p>
              <div className="mt-4 flex justify-center gap-6 text-sm text-zinc-500 dark:text-zinc-400">
                <span>Bids: <strong className="text-zinc-700 dark:text-zinc-300">{state.bidCount}</strong> / {state.maxBidders}</span>
                {state.highestBidNight > 0 && (
                  <span>Highest: <strong className="text-zinc-700 dark:text-zinc-300">{state.highestBidNight}</strong> NIGHT</span>
                )}
              </div>
              {state.publicPriceNight > 0 && (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Reserve: <strong className="text-zinc-700 dark:text-zinc-300">{state.publicPriceNight}</strong> NIGHT
                </p>
              )}
            </div>
          )}

          {/* Seller actions */}
          {role === 'seller' && (
            <div className="space-y-3">
              {state?.auctionState === 'OPEN' && (
                <button
                  onClick={handleCloseAuction}
                  disabled={busy}
                  className="w-full h-12 rounded-full bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {busy ? statusMessage || 'Processing…' : 'Close Auction'}
                </button>
              )}
              {state?.auctionState === 'CLOSED' && (
                <>
                  <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Reveal reserve price (NIGHT) — must match deploy value
                    <input
                      type="number"
                      min={0.000001}
                      step={0.01}
                      value={reservePriceNight}
                      onChange={(e) => setReservePriceNight(e.target.value)}
                      className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </label>
                  <button
                    onClick={handleRevealPrice}
                    disabled={busy}
                    className="w-full h-12 rounded-full bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    {busy ? statusMessage || 'Processing…' : 'Reveal Reserve Price'}
                  </button>
                </>
              )}
              {state?.auctionState === 'SETTLED' && (
                <button
                  onClick={handleClaimProceeds}
                  disabled={busy}
                  className="w-full h-12 rounded-full bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {busy ? statusMessage || 'Processing…' : 'Claim Proceeds'}
                </button>
              )}
            </div>
          )}

          {/* Bidder actions */}
          {role === 'bidder' && (
            <div className="space-y-3">
              {state?.auctionState === 'OPEN' && (
                <>
                  <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Your bid (NIGHT)
                    <input
                      type="number"
                      min={0.000001}
                      step={0.01}
                      value={bidAmountNight}
                      onChange={(e) => setBidAmountNight(e.target.value)}
                      className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </label>
                  <button
                    onClick={handlePlaceBid}
                    disabled={busy}
                    className="w-full h-12 rounded-full bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    {busy ? statusMessage || 'Processing…' : 'Place Bid'}
                  </button>
                </>
              )}
              {state?.auctionState === 'SETTLED' && state.highestBidNight >= state.publicPriceNight && (
                <button
                  onClick={handleClaimItem}
                  disabled={busy}
                  className="w-full h-12 rounded-full bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {busy ? statusMessage || 'Processing…' : 'Claim Item (pays reserve → public)'}
                </button>
              )}
            </div>
          )}

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-zinc-500">
              <span className="text-zinc-400">Contract: </span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300 break-all">{contractAddress}</span>
            </p>
          </div>

          <div className="flex justify-center gap-3">
            <button
              onClick={() => void refresh()}
              disabled={busy}
              className="text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-600 disabled:opacity-40 dark:hover:text-zinc-300"
            >
              refresh
            </button>
            <button
              onClick={reset}
              disabled={busy}
              className="text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-600 disabled:opacity-40 dark:hover:text-zinc-300"
            >
              new contract
            </button>
          </div>
        </div>
      )}

      {busy && !contractAddress && (
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-400 animate-pulse" />
            {statusMessage}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
```

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

```javascript
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'contract/src/managed/private-reserve-auction');
const dest = join(root, 'public/zk/private-reserve-auction');

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
for (const dir of ['keys', 'zkir']) {
  cpSync(join(src, dir), join(dest, dir), { recursive: true });
}
```

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

## 15) Agent Checklist

When generating this dApp for a user:

- [ ] Write `private-reserve-auction.compact` with all five exported circuits + helper circuits
- [ ] Compile; sync ZK assets to `public/zk/private-reserve-auction/`
- [ ] Use `CompiledContract.withVacantWitnesses` from `@midnight-ntwrk/compact-js` (not `compact-runtime`)
- [ ] Single copy of each WASM package (`npm ls`); page loads the client with `ssr: false`
- [ ] Wire `createConnectedSession` with patched indexer
- [ ] Constructor args: `[BigInt(reservePriceStars), BigInt(maxBidders), rawUint8Array]`
- [ ] Decode unshielded Bech32 via `wallet-sdk-address-format`
- [ ] Store seller/bidder secrets in `localStorage` per contract address
- [ ] UI explains privacy boundary before claim button
- [ ] Next.js: `asyncWebAssembly: true` + `topLevelAwait: true` in webpack config; `resolve.fallback` for `fs`, `net`, `tls`, `child_process`; alias `isomorphic-ws`
- [ ] Delete `contract/node_modules` if present — root-level `node_modules` must be the sole `compact-runtime` copy
- [ ] Tailwind: counter dapp pattern — Geist fonts, `rounded-full` buttons, `prefers-color-scheme` dark mode
- [ ] Document: reserve price in NIGHT (UI) / Stars (contract); 1 NIGHT = 1,000,000 Stars

---

## 16) Related Skills

| Next step | Skill |
|---|---|
| Wallet connect only | `react-wallet-connector/` |
| Unshielded token flows | `token-transfers/` |
| Payment vault pattern | `example-payment-dapp/` |
| Privacy audit | `security/` |
| Compact language reference | `compact/` |
| Local vitest harness | `example-hello-world/` |
