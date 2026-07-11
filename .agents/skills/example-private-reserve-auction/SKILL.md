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
- Use `createUnprovenDeployTx` + `submitTxAsync` — not `deployContract()` (hangs on preview)
- Wrap `indexerPublicDataProvider` with patched `queryContractState` (GraphQL `offset: null` bug)
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
│   └── sync-zk-assets.mjs          # → public/zk/private-reserve-auction/
└── public/zk/private-reserve-auction/        # keys + zkir (gitignored until sync)
```

---

## 2) Prerequisites

```bash
node --version   # 20+
docker --version # optional local devnet tests

curl --proto '=https' --tlsv1.2 -sSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
source $HOME/.local/bin/env
```

Browser: **1AM wallet** on `preview` with tNIGHT for bids and reserve payment.

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
    "@midnight-ntwrk/compact-js": "^2.5.0",
    "@midnight-ntwrk/compact-runtime": "0.16.0",
    "@midnight-ntwrk/ledger-v8": "8.0.3",
    "@midnight-ntwrk/midnight-js-contracts": "4.0.4",
    "@midnight-ntwrk/midnight-js-fetch-zk-config-provider": "4.0.4",
    "@midnight-ntwrk/midnight-js-indexer-public-data-provider": "4.0.4",
    "@midnight-ntwrk/midnight-js-network-id": "4.0.4",
    "@midnight-ntwrk/midnight-js-types": "4.0.4",
    "@midnight-ntwrk/wallet-sdk-address-format": "3.1.0",
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
    "compact": "compact compile src/private-reserve-auction.compact src/managed/private-reserve-auction"
  },
  "devDependencies": {
    "@midnight-ntwrk/compact-runtime": "0.16.0"
  }
}
```

Compile:

```bash
npm run compact
# → contract/src/managed/private-reserve-auction/{contract,keys,zkir}/
npm run sync:assets
# → public/zk/private-reserve-auction/
```

Expected circuits: `bid`, `closeAuction`, `revealPrice`, `claimItem`, `claimProceeds`.

---

## 5) `contract/src/private-reserve-auction.compact`

```compact
pragma language_version 0.23;
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

No witnesses — use `withVacantWitnesses`. **Use lazy `await import()` pattern** to avoid SSR issues and ensure `CompiledContract` is resolved from the correct module.

```typescript
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { sampleSigningKey, ContractState } from '@midnight-ntwrk/compact-runtime';

let _contractModule: any = null;
let _compiledContract: any = null;
let _ledgerFn: any = null;

export async function getCompiledContract(zkPath?: string): Promise<any> {
  if (!_compiledContract) {
    if (!_contractModule) {
      _contractModule = await import('./managed/private-reserve-auction/contract/index.js');
    }
    _compiledContract = CompiledContract.make(
      'private-reserve-auction',
      _contractModule.Contract,
    );
    _compiledContract = CompiledContract.withVacantWitnesses(_compiledContract);
  }
  return _compiledContract;
}

export async function getLedger(): Promise<any> {
  if (!_ledgerFn) {
    if (!_contractModule) {
      _contractModule = await import('./managed/private-reserve-auction/contract/index.js');
    }
    _ledgerFn = _contractModule.ledger;
  }
  return _ledgerFn;
}

export { sampleSigningKey, ContractState };
```

---

## 7) `lib/address.ts`

Decode Bech32 unshielded addresses for `UserAddress` circuit args.

```typescript
import { MidnightBech32m, UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk-address-format';

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

```typescript
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { ContractState } from '@midnight-ntwrk/compact-runtime';
import type { MidnightProvider, WalletProvider } from '@midnight-ntwrk/midnight-js-types';

export type ConnectedSession = {
  api: any;
  config: any;
  providers: {
    privateStateProvider: ReturnType<typeof createPrivateStateProvider>;
    publicDataProvider: ReturnType<typeof createPatchedPublicDataProvider>;
    zkConfigProvider: FetchZkConfigProvider<any>;
    proofProvider: { proveTx: (unprovenTx: any) => Promise<any> };
    walletProvider: WalletProvider;
    midnightProvider: MidnightProvider;
  };
  unshieldedAddress: string;
  coinPublicKeyBytes: Uint8Array;
};

export function fromHex(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Uint8Array.from(h.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function coinPublicKeyToBytes(pk: unknown): Uint8Array {
  if (pk instanceof Uint8Array) return pk.length === 32 ? pk : pk.slice(0, 32);
  if (typeof pk === 'string') {
    const hex = pk.startsWith('0x') ? pk.slice(2) : pk;
    if (hex.length === 64 && /^[0-9a-fA-F]+$/.test(hex)) return fromHex(hex);
    return new Uint8Array(32);
  }
  if (Array.isArray(pk)) {
    return new Uint8Array(pk.length >= 32 ? pk.slice(0, 32) : [...pk, ...new Uint8Array(32 - pk.length)]);
  }
  if (pk && typeof pk === 'object' && 'bytes' in (pk as object)) {
    return coinPublicKeyToBytes((pk as { bytes: unknown }).bytes);
  }
  return new Uint8Array(32);
}

function createPrivateStateProvider() {
  let scope = '';
  const stateStore = new Map<string, unknown>();
  const signingKeyStore = new Map<string, unknown>();
  const key = (id: string) => `${scope}:${id}`;
  return {
    setContractAddress(address: string) {
      scope = address;
    },
    async set(id: string, state: unknown) {
      stateStore.set(key(id), state);
    },
    async get(id: string) {
      return stateStore.get(key(id)) ?? null;
    },
    async remove(id: string) {
      stateStore.delete(key(id));
    },
    async clear() {
      stateStore.clear();
    },
    async setSigningKey(addr: string, k: unknown) {
      signingKeyStore.set(addr, k);
    },
    async getSigningKey(addr: string) {
      return signingKeyStore.get(addr) ?? null;
    },
    async removeSigningKey(addr: string) {
      signingKeyStore.delete(addr);
    },
    async clearSigningKeys() {
      signingKeyStore.clear();
    },
    async exportPrivateStates(): Promise<never> {
      throw new Error('Not implemented.');
    },
    async importPrivateStates(): Promise<never> {
      throw new Error('Not implemented.');
    },
    async exportSigningKeys(): Promise<never> {
      throw new Error('Not implemented.');
    },
    async importSigningKeys(): Promise<never> {
      throw new Error('Not implemented.');
    },
  };
}

function createPatchedPublicDataProvider(queryUrl: string, subscriptionUrl: string) {
  const base = indexerPublicDataProvider(queryUrl, subscriptionUrl);
  return {
    ...base,
    async queryContractState(contractAddress: string, config?: unknown) {
      if (config) return base.queryContractState(contractAddress, config as never);
      const res = await fetch(queryUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: `query LATEST_CONTRACT_STATE($address: HexEncoded!) {
            contractAction(address: $address) { state }
          }`,
          variables: { address: contractAddress },
        }),
      });
      if (!res.ok) throw new Error(`Indexer HTTP error: ${res.status}`);
      const payload = await res.json();
      if (payload.errors?.length) {
        throw new Error(payload.errors.map((e: { message: string }) => e.message).join('; '));
      }
      const action = payload.data?.contractAction ?? null;
      return action ? ContractState.deserialize(fromHex(action.state)) : null;
    },
  };
}

export async function createConnectedSession(
  api: any,
  zkAssetBasePath: string,
): Promise<ConnectedSession> {
  const [config, unshieldedAddress, shieldedAddress] = await Promise.all([
    api.getConfiguration(),
    api.getUnshieldedAddress(),
    api.getShieldedAddresses(),
  ]);

  setNetworkId(config.networkId);

  const zkConfigProvider = new FetchZkConfigProvider(
    new URL(zkAssetBasePath, window.location.origin).toString(),
    window.fetch.bind(window),
  );
  const provingProvider = await api.getProvingProvider(zkConfigProvider);

  const proofProvider = {
    async proveTx(unprovenTx: any) {
      const { CostModel } = await import('@midnight-ntwrk/ledger-v8');
      return unprovenTx.prove(provingProvider, CostModel.initialCostModel());
    },
  };

  const walletProvider: WalletProvider = {
    getCoinPublicKey: () => shieldedAddress.shieldedCoinPublicKey,
    getEncryptionPublicKey: () => shieldedAddress.shieldedEncryptionPublicKey,
    balanceTx: async (tx: any) => {
      const txHex = toHex(tx.serialize());
      const balanced = await api.balanceUnsealedTransaction(txHex);
      if (!balanced?.tx) throw new Error('balanceUnsealedTransaction returned invalid result');
      const { Transaction } = await import('@midnight-ntwrk/ledger-v8');
      return Transaction.deserialize('signature', 'proof', 'binding', fromHex(balanced.tx));
    },
  };

  const midnightProvider: MidnightProvider = {
    submitTx: async (tx: any) => {
      const txHex = toHex(tx.serialize());
      const result = await api.submitTransaction(txHex);
      if (typeof result === 'string' && result) return result;
      if (result?.transactionId) return result.transactionId;
      if (result?.id) return result.id;
      return txHex.slice(0, 64);
    },
  };

  return {
    api,
    config,
    providers: {
      privateStateProvider: createPrivateStateProvider(),
      publicDataProvider: createPatchedPublicDataProvider(config.indexerUri, config.indexerWsUri),
      zkConfigProvider,
      proofProvider,
      walletProvider,
      midnightProvider,
    },
    unshieldedAddress: unshieldedAddress.unshieldedAddress,
    coinPublicKeyBytes: coinPublicKeyToBytes(shieldedAddress.shieldedCoinPublicKey),
  };
}

export async function pollForState(
  queryUrl: string,
  contractAddress: string,
  maxAttempts = 120,
  intervalMs = 2000,
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: `query LATEST_CONTRACT_STATE($address: HexEncoded!) {
          contractAction(address: $address) { state }
        }`,
        variables: { address: contractAddress },
      }),
    });
    if (res.ok) {
      const payload = await res.json();
      const state = payload.data?.contractAction?.state;
      if (state) return state;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Contract state not indexed after ${(maxAttempts * intervalMs) / 1000}s`);
}

export async function detectWallet(): Promise<any> {
  const w =
    (window as any).midnight?.['1am'] ??
    Object.values((window as any).midnight ?? {})[0];
  if (!w) throw new Error('No Midnight wallet extension found');
  return w;
}
```

**Key implementation details:**

- `createPatchedPublicDataProvider` wraps the SDK's `indexerPublicDataProvider` and intercepts `queryContractState`. When no config is passed (the polling path), it falls back to a raw `fetch` + hand-written GraphQL query that omits the `offset` parameter entirely — this sidesteps the GraphQL `offset: null` bug without needing a separate SDK version fix.

- `coinPublicKeyToBytes` defensively normalizes four input shapes: `Uint8Array`, hex string, plain `number[]`, and `{ bytes: ... }` wrapper. This is necessary because different wallet SDK versions return coin public keys in different formats.

- `createPrivateStateProvider` is a clean in-memory Map-based provider with no `@midnight-ntwrk` dependency — avoids pulling in the SDK's own private state provider which would add another WASM bundle.

- **Lazy WASM imports** — `proofProvider.proveTx` dynamically imports `@midnight-ntwrk/ledger-v8` for `CostModel`, and `balanceTx` does the same for `Transaction`. This avoids loading WASM-backed modules at module-evaluation time, which matters because the same pattern prevents the "dual WASM instance" bug (see troubleshooting). If you statically import `ledger-v8` at the top of this file, it will conflict with `compact-runtime`'s own WASM instance.

- `createConnectedSession` front-loads `getConfiguration`, `getUnshieldedAddress`, and `getShieldedAddresses` into a single `Promise.all`. If any of these throw (e.g. wallet not fully initialized, or user rejected the connection prompt), the entire session creation fails. The caller should catch this and surface a meaningful error — see `connectWallet` in `AuctionClient.tsx`.

- `detectWallet` throws if no wallet is found rather than returning `null`. Callers must `.catch()` or the rejection will be unhandled. The UI component uses `.then().catch()` to translate this into a `false` state — see the bug note in troubleshooting.

---

## 10) `lib/auction.ts`

Uses `getCompiledContract()` (lazy singleton) and the correct arg format for Compact 0.23+.

```typescript
import { createUnprovenDeployTx, submitCallTxAsync, submitTxAsync } from '@midnight-ntwrk/midnight-js-contracts';
import { getCompiledContract, getLedger, sampleSigningKey, ContractState } from '../contract/src/index';
import type { ConnectedSession } from './midnight';
import { fromHex, pollForState } from './midnight';
import { bech32ToUserAddress } from './address';

const PRIVATE_STATE_ID = 'PrivateAuctionState';
export const ZK_PATH = '/zk/private-reserve-auction';

const AUCTION_STATE_NAMES = ['OPEN', 'CLOSED', 'SETTLED'] as const;

export type AuctionStateName = (typeof AUCTION_STATE_NAMES)[number];

let _compiledContract: any = null;
async function makeCompiledContract() {
  if (!_compiledContract) {
    _compiledContract = await getCompiledContract(ZK_PATH);
  }
  return _compiledContract;
}

function setSize(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'size' in value) {
    const size = (value as { size: unknown }).size;
    if (typeof size === 'function') return Number((size as () => number)());
    if (typeof size === 'number') return size;
  }
  return 0;
}

export async function deployAuction(
  session: ConnectedSession,
  reservePriceNight: number,
  maxBidders: number,
  sellerSecret: Uint8Array,
): Promise<string> {
  const reservePriceStars = reservePriceNight * 1_000_000;
  const cc = await makeCompiledContract();
  const deployTxData = await (createUnprovenDeployTx as any)(
    {
      zkConfigProvider: session.providers.zkConfigProvider,
      walletProvider: session.providers.walletProvider,
    },
    {
      compiledContract: cc,
      args: [BigInt(reservePriceStars), BigInt(maxBidders), sellerSecret],
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: {},
      signingKey: sampleSigningKey(),
    },
  );

  const contractAddress = deployTxData.public.contractAddress;
  await (submitTxAsync as any)(session.providers, { unprovenTx: deployTxData.private.unprovenTx });
  await session.providers.privateStateProvider.setContractAddress(contractAddress);
  await session.providers.privateStateProvider.set(PRIVATE_STATE_ID, {});
  await session.providers.privateStateProvider.setSigningKey(
    contractAddress,
    deployTxData.private.signingKey,
  );
  return contractAddress;
}

async function call(
  session: ConnectedSession,
  contractAddress: string,
  circuitId: string,
  args: unknown[],
) {
  const cc = await makeCompiledContract();
  await (submitCallTxAsync as any)(session.providers, {
    compiledContract: cc,
    contractAddress,
    circuitId,
    args,
    privateStateId: PRIVATE_STATE_ID,
  });
}

export const placeBid = (session: ConnectedSession, contractAddress: string, bidAmountNight: number, userAddress: { bytes: Uint8Array }, bidderSecret: Uint8Array) =>
  call(session, contractAddress, 'bid', [BigInt(bidAmountNight * 1_000_000), userAddress, bidderSecret]);

export const closeAuction = (session: ConnectedSession, contractAddress: string, sellerSecret: Uint8Array) =>
  call(session, contractAddress, 'closeAuction', [sellerSecret]);

export const revealPrice = (session: ConnectedSession, contractAddress: string, reservePriceNight: number, sellerSecret: Uint8Array) =>
  call(session, contractAddress, 'revealPrice', [BigInt(reservePriceNight * 1_000_000), sellerSecret]);

export const claimItem = (session: ConnectedSession, contractAddress: string, userAddress: { bytes: Uint8Array }, bidderSecret: Uint8Array) =>
  call(session, contractAddress, 'claimItem', [userAddress, bidderSecret]);

export const claimProceeds = (session: ConnectedSession, contractAddress: string, sellerAddress: { bytes: Uint8Array }, sellerSecret: Uint8Array) =>
  call(session, contractAddress, 'claimProceeds', [sellerAddress, sellerSecret]);

export async function decodeAuctionState(stateHex: string) {
  const contractState = ContractState.deserialize(fromHex(stateHex));
  const ledger = await getLedger();
  const l = ledger(contractState.data) as any;
  const stateIdx = Number(l.auctionState);
  return {
    auctionState: (AUCTION_STATE_NAMES[stateIdx] ?? `UNKNOWN(${stateIdx})`) as AuctionStateName | string,
    auctionStateIndex: stateIdx,
    maxBidders: Number(l.maxBids),
    publicPriceNight: Number(l.publicPrice) / 1_000_000,
    highestBidNight: Number(l.highestBid) / 1_000_000,
    bidCount: setSize(l.bidCount),
    bidderCount: setSize(l.bidders),
  };
}

export async function fetchAuctionState(queryUrl: string, contractAddress: string) {
  const hex = await pollForState(queryUrl, contractAddress);
  return decodeAuctionState(hex);
}

export function userAddressFromSession(session: ConnectedSession) {
  return bech32ToUserAddress(session.unshieldedAddress, session.config.networkId);
}
```

**Key details:**
- `args` use `BigInt(...)` for `Uint<32>` fields, not plain numbers
- `Bytes<32>` args are passed as raw `Uint8Array`, **not** wrapped in `{ bytes: ... }`. `UserAddress` args require the `{ bytes }` wrapper
- `ledger()` is resolved via `getLedger()` from the contract's own compiled module
- `setSize()` handles both `.size` (property) and `.size()` (method) since compiled `Set`/`Counter` ledger fields vary by SDK version
- Reserve price in NIGHT is converted to Stars (×1,000,000) before passing to contract

---

## 11) Frontend — `app/auction/AuctionClient.tsx`

```tsx
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { detectWallet, createConnectedSession, pollForState } from '@/lib/midnight';
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
      const state = await fetchAuctionState(session.config.indexerUri, contractAddress);
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
      const state = await fetchAuctionState(session.config.indexerUri, addr);
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
      const state = await fetchAuctionState(session.config.indexerUri, contractAddress);
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
      const state = await fetchAuctionState(session.config.indexerUri, contractAddress);
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
      const state = await fetchAuctionState(session.config.indexerUri, contractAddress);
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
      const state = await fetchAuctionState(session.config.indexerUri, contractAddress);
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
      const state = await fetchAuctionState(session.config.indexerUri, contractAddress);
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
            Network: <span className="font-medium text-zinc-700 dark:text-zinc-300">{session.config.networkId}</span>
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
| Deploy hangs 30–120s | Used `deployContract()` | Use `createUnprovenDeployTx` + `submitTxAsync` |
| GraphQL `offset: null` | Default indexer provider | Use patched `queryContractState` |
| ZK 404 | Assets not synced | `npm run sync:assets` |
| Lost seller secret | No recovery on-chain | Redeploy contract; store secret in localStorage |
| `CompiledContract.withVacantWitnesses` TypeScript error | `compact-runtime` vs `compact-js` mismatch | Import `CompiledContract` from `@midnight-ntwrk/compact-js` |
| `ContractMaintenanceAuthority` WASM identity error | Dual `compact-runtime` instances | Delete `contract/node_modules` |
| `bigint` type mismatch on constructor args | Passed `number` where `bigint` expected | Wrap in `BigInt(value)` for `Uint<32>` fields |
| `Bytes<32>` wrapped in `{ bytes: ... }` mismatch | Confusing it with `UserAddress` | Raw `Uint8Array` for `Bytes<32>`; `{ bytes }` only for `UserAddress` |
| `bidCount` shows NaN | Field name mismatch (`maxBidders` vs `maxBids`) | Access `l.maxBids` not `l.maxBidders` |
| `Counter` type `= undefined` error | Counter doesn't support assignment | Don't initialize in constructor; use `.increment(1)` |
| Network mismatch | `wallet.connect('preprod')` but targeting Preview | Use `wallet.connect('preview')` |
| `walletInstalled` stuck at `null` (loading forever) | `detectWallet()` throws but no `.catch()` handler | Add `.catch(() => setWalletInstalled(false))` — see `AuctionClient.tsx` useEffect |
| `getProvingProvider` or `getConfiguration` throws during connect | Wallet not fully initialized or user rejected prompt | Wrap `createConnectedSession` call in try/catch; surface `e.message` as connection error |
| `CostModel` or `Transaction` identity mismatch | Static `import '@midnight-ntwrk/ledger-v8'` at module top level loads a second WASM instance | Use dynamic `await import('@midnight-ntwrk/ledger-v8')` inside the function body (see `proofProvider.proveTx` and `walletProvider.balanceTx`) |

---

## 15) Agent Checklist

When generating this dApp for a user:

- [ ] Write `private-reserve-auction.compact` with all five exported circuits + helper circuits
- [ ] Compile; sync ZK assets to `public/zk/private-reserve-auction/`
- [ ] Use `CompiledContract.withVacantWitnesses` from `@midnight-ntwrk/compact-js` (not `compact-runtime`)
- [ ] Lazy `getCompiledContract()` / `getLedger()` singleton pattern (avoid dual WASM instance bug)
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
