---
name: example-private-party-dapp
author: tusharpamnani
description: >
  Build a private party RSVP dApp on Midnight Network — attendees stay private until
  unshielded NIGHT check-in crosses the privacy boundary. Covers private-party.compact
  (no witnesses, persistentCommit, DApp-specific public keys, receiveUnshielded/sendUnshielded),
  Next.js frontend, 1AM wallet integration, low-level deploy/call, indexer polling, and
  optional vitest local devnet tests. Use for teaching privacy boundaries, commitment-based
  guest lists, organizer access control, or unshielded entry fees. Triggers: private party,
  RSVP dApp, privacy boundary, persistentCommit, getDappPublicKey, unshielded check-in,
  example-private-party, party organizer, guest list commitment. Also use when extending
  locker-dapp or payment-dapp wallet/provider patterns to privacy-preserving social flows.
---

# Midnight Network Private Party DApp

A **private party contract** lets an organizer collect RSVPs while attendee identities stay private until guests **check in** and pay the entry fee in **unshielded NIGHT**. That payment is the **privacy boundary** — unshielded token flows are always public on Midnight.

**Runnable template:** Copy `templates/private-party-dapp/` for a complete Next.js project (contract + UI). Run `npm install && npm run compact && npm run sync:assets && npm run dev` after installing the [1AM wallet](https://1am.dev).

**Official reference:** `github.com/midnightntwrk/example-private-party` — Compact tutorial + vitest harness (`yarn test:local` on Docker devnet).

**Two ways to use this skill:**
- **Scaffold mode (default)** — the user wants a working dApp. Use every code block below verbatim; they are the tested reference implementation. Don't rederive them.
- **Tutorial mode** — the user explicitly wants to learn Compact by writing it themselves. In that case walk through `private-party.compact` circuit-by-circuit (§5) and let them type it, but still scaffold the surrounding TS/UI from the code blocks — those aren't the teaching surface.

**What this skill produces:**
- `contract/` — `private-party.compact` (no witnesses) + compile scripts
- `app/party/` — Next.js client UI (organizer deploy/start/close/claim + attendee RSVP/check-in)
- `lib/midnight.ts` — wallet session + patched indexer provider (full implementation in §9)
- `lib/party.ts` — deploy, `rsvp`, `startParty`, `checkIn`, `closeEntry`, `claimFees`, ledger decode
- `lib/address.ts` — Bech32 unshielded address → `{ bytes: Uint8Array }` for `UserAddress` circuit args
- `lib/secret.ts` — generate/store 32-byte DApp secrets in `localStorage`
- `public/zk/private-party/` — ZK proving assets synced from contract build

**Shared references** (canonical provider + troubleshooting — do not duplicate in prompts):
- `references/gotchas.md` — preprod deploy hangs, GraphQL `offset: null`, ZK asset paths
- `references/versions.json` — pinned `@midnight-ntwrk/*` versions

**Primary references:**
- `example-locker-dapp/` / `templates/locker-dapp/` — Next.js + 1AM, low-level deploy/call
- `example-payment-dapp/` — unshielded `receiveUnshielded` / `sendUnshielded` patterns
- `example-hello-world/` — vitest + Docker devnet test harness (test script provided in official repo)
- `compact/` — `disclose()`, `persistentCommit`, `persistentHash`, `Set`, sealed ledger, enums
- `security/` — privacy boundary checklist, what becomes public and when
- `token-transfers/` — unshielded NIGHT units (Stars), Bech32 address decoding

**Key architecture notes:**
- **No witnesses** — caller auth uses circuit-private `_secret` → `getDappPublicKey(_secret)` compared to on-chain `organizer`
- **RSVP privacy** — guest `UserAddress` + secret committed via `persistentCommit`; only the hash is stored in `hashedPartyGoers`
- **Privacy boundary** — `checkIn` calls `receiveUnshielded(nativeToken(), entryFee)` then `checkedInParty.insert(disclose(address))` — guest address becomes public
- **Organizer becomes public** — `claimFees` calls `sendUnshielded(...)` to organizer's `UserAddress`
- **`disclose()` is a developer assertion** — it marks values safe for public domains; it does not perform the disclosure itself
- **`persistentCommit` output is safe on ledger without `disclose()`** — sufficiently random salt (`_secret`) required
- Use `createUnprovenDeployTx` + `submitTxAsync` — not `deployContract()` (hangs on preprod)
- Wrap `indexerPublicDataProvider` with patched `queryContractState` (GraphQL `offset: null` bug)
- Entry fee is `Uint<16>` on ledger but cast to `Uint<128>` for unshielded ops; 1 NIGHT = 1_000_000 Stars
- Persist organizer/attendee `_secret` in `localStorage` — losing it means losing auth for that role
- **Network: this template targets `preprod` everywhere** (wallet connect, indexer, proof server). If your deployment target is `preview`, change `DEFAULT_NETWORK` in `lib/midnight.ts` (§9) — that's the single source of truth; nothing else should hardcode a network string.

---

## Workflow

When helping the user, follow this sequence:

1. **Contract** — write/scaffold `private-party.compact` (§5); compile with `yarn compile`
2. **Understand privacy boundary** — private RSVP → public check-in (unshielded) → public payout
3. **Providers** — `createConnectedSession` (§9, `lib/midnight.ts`)
4. **Deploy** — organizer passes `(partySize, entryFee, organizerSecret)` to constructor
5. **RSVP** — attendees call `rsvp(userAddress, secret)` before party starts
6. **Start** — organizer calls `startParty(secret)` when ready (or auto when list full → `READY`)
7. **Check in** — RSVP'd guests call `checkIn(address, secret)` + pay entry fee (crosses boundary)
8. **Close** — organizer `closeEntry(secret)` if not everyone checked in; or auto when full
9. **Claim** — organizer `claimFees(organizerAddress, secret)` after doors closed
10. **UI** — role picker, party status panel, indexer polling for public state

---

## 1) Project Structure

```
private-party-dapp/
├── package.json
├── next.config.mjs
├── postcss.config.mjs
├── lib/
│   ├── isomorphic-ws-fix.mjs
│   ├── midnight.ts                 # session, patched provider, hex helpers
│   ├── party.ts                    # deploy, circuits, decode state
│   ├── address.ts                  # Bech32 → UserAddress bytes
│   └── secret.ts                   # crypto.getRandomValues + localStorage
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   └── party/
│       └── PartyClient.tsx         # organizer + attendee UI
├── contract/
│   ├── package.json
│   └── src/
│       ├── private-party.compact
│       ├── index.ts                # CompiledContract.withVacantWitnesses
│       └── managed/private-party/  # compiler output (gitignored)
├── scripts/
│   └── sync-zk-assets.mjs          # → public/zk/private-party/
└── public/zk/private-party/        # keys + zkir (gitignored until sync)
```

**Optional test harness** (official repo — not in browser template):

```
example-private-party/
├── contract/private-party.compact
├── src/test/party.test.ts          # vitest: Alice organizer, Bob/Claire guests
├── compose.yml                     # node + indexer + proof-server
└── package.json                    # yarn test:local
```

---

## 2) Prerequisites

```bash
node --version   # 22+ for vitest harness; 20+ for Next.js frontend
docker --version # optional local devnet tests

curl --proto '=https' --tlsv1.2 -sSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
source $HOME/.local/bin/env
```

Browser: **1AM wallet**, network set to match `DEFAULT_NETWORK` in `lib/midnight.ts` (preprod by default), funded with tNIGHT for entry fees.

---

## 3) Root `package.json`

```json
{
  "name": "private-party-dapp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --webpack",
    "build": "npm run sync:assets && next build --webpack",
    "compact": "npm run compact --prefix contract",
    "sync:assets": "node scripts/sync-zk-assets.mjs",
    "postinstall": "npm install --prefix contract"
  },
  "dependencies": {
    "@midnight-ntwrk/compact-runtime": "0.16.0",
    "@midnight-ntwrk/compact-js": "4.0.4",
    "@midnight-ntwrk/ledger-v8": "8.0.3",
    "@midnight-ntwrk/midnight-js-contracts": "4.0.4",
    "@midnight-ntwrk/midnight-js-fetch-zk-config-provider": "4.0.4",
    "@midnight-ntwrk/midnight-js-indexer-public-data-provider": "4.0.4",
    "@midnight-ntwrk/midnight-js-network-id": "4.0.4",
    "@midnight-ntwrk/midnight-js-types": "4.0.4",
    "@midnight-ntwrk/wallet-sdk-address-format": "3.1.0",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0",
    "stream-browserify": "^3.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "tailwindcss": "^4.0.0"
  }
}
```

---

## 4) `contract/package.json`

```json
{
  "name": "@private-party/contract",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "compact": "compact compile src/private-party.compact src/managed/private-party"
  },
  "dependencies": {
    "@midnight-ntwrk/compact-runtime": "0.16.0"
  }
}
```

**Do not run `npm install` inside `contract/`** — a second copy of `@midnight-ntwrk/compact-runtime` there causes the dual-WASM-instance bug (`ContractMaintenanceAuthority` identity error). All deps live at root; `contract/package.json` exists only for the `compact` compile script.

Compile:

```bash
npm run compact
# → contract/src/managed/private-party/{contract,keys,zkir}/
npm run sync:assets
# → public/zk/private-party/
```

Expected circuits: `rsvp`, `startParty`, `checkIn`, `closeEntry`, `claimFees`.

---

## 5) `contract/src/private-party.compact`

In scaffold mode, use this exactly. In tutorial mode, build it up circuit by circuit in this order: ledger declarations → constructor → `rsvp` → `startParty` → `checkIn` → `closeEntry` → `claimFees` → helper circuits.

```compact
pragma language_version 0.23;
import CompactStandardLibrary;

export enum PartyState {
    NOT_STARTED,
    READY,
    STARTED,
    DOORS_CLOSED,
    FEES_CLAIMED
}

export sealed ledger organizer: Bytes<32>;
export sealed ledger maxListSize: Uint<16>;
export sealed ledger entryFee: Uint<16>;
export ledger partyState: PartyState;
export ledger hashedPartyGoers: Set<Bytes<32>>;
export ledger checkedInParty: Set<UserAddress>;

constructor (partySize: Uint<16>, fee: Uint<16>, _secret: Bytes<32>) {
    assert(partySize > 0, "The party size must be greater than zero");
    assert(fee > 0, "Fee must be greater than zero");

    const pubKey = getDappPublicKey(_secret);
    organizer = disclose(pubKey);

    entryFee = disclose(fee);
    maxListSize = disclose(partySize);
    partyState = PartyState.NOT_STARTED;
}

export circuit rsvp(_address: UserAddress, _secret: Bytes<32>): [] {
    const pubKey = getDappPublicKey(_secret);
    assert(pubKey != organizer, "Organizer cannot RSVP to the party");
    assert(partyState == PartyState.NOT_STARTED, "The party has already started");
    assert(hashedPartyGoers.size() < maxListSize, "The list is full");

    const commitHash = commitAddress(_secret, _address.bytes);
    assert(!hashedPartyGoers.member(commitHash), "You are already on the list");
    hashedPartyGoers.insert(commitHash);

    if (hashedPartyGoers.size() == maxListSize) {
        partyState = PartyState.READY;
    }
}

export circuit startParty(_secret: Bytes<32>): [] {
    const pubKey = getDappPublicKey(_secret);
    assert(organizer == pubKey, "Only the organizer can start the party");
    assert(partyState == PartyState.READY || partyState == PartyState.NOT_STARTED,
        "The party is not in the correct state for this operation");

    partyState = PartyState.STARTED;
}

export circuit checkIn(address: UserAddress, _secret: Bytes<32>): [] {
    assert(partyState == PartyState.STARTED, "The party has not been started. Call the party police");
    assert(checkedInParty.size() < hashedPartyGoers.size(), "All guests have already checked in");

    const commitHash = commitAddress(_secret, address.bytes);

    assert(hashedPartyGoers.member(commitHash), "You are not on the list");
    assert(!checkedInParty.member(disclose(address)), "You have already checked in");

    // Privacy boundary: unshielded payment makes guest address public
    receiveUnshielded(nativeToken(), entryFee as Uint<128>);
    checkedInParty.insert(disclose(address));

    if (checkedInParty.size() == maxListSize) {
        partyState = PartyState.DOORS_CLOSED;
    }
}

export circuit closeEntry(_secret: Bytes<32>): [] {
    const pubKey = getDappPublicKey(_secret);
    assert(organizer == pubKey, "Only organizer can close the doors");
    assert(partyState == PartyState.STARTED, "Party in wrong state");

    partyState = PartyState.DOORS_CLOSED;
}

export circuit claimFees(address: UserAddress, _secret: Bytes<32>): [] {
    const pubKey = getDappPublicKey(_secret);
    assert(organizer == pubKey, "You are not the organizer");

    assert(partyState == PartyState.DOORS_CLOSED, "The doors are not yet closed");
    assert(checkedInParty.size() > 0, "No fees to claim");

    const totalCollected = checkedInParty.size() * entryFee;
    assert(unshieldedBalanceGte(nativeToken(), totalCollected), "Contract balance wrong");

    sendUnshielded(
        nativeToken(),
        disclose(totalCollected) as Uint<128>,
        right<ContractAddress, UserAddress>(disclose(address))
    );
    partyState = PartyState.FEES_CLAIMED;
}

circuit commitAddress(_address: Bytes<32>, _secret: Bytes<32>): Bytes<32> {
    return persistentCommit<Bytes<32>>(_address, _secret);
}

circuit getDappPublicKey(_secret: Bytes<32>): Bytes<32> {
    return persistentHash<Vector<2, Bytes<32>>>([pad(32, "private-party:pk:"), _secret]);
}
```

### Privacy model summary

| Phase | Attendee identity | On-chain data |
|---|---|---|
| RSVP | Private | Commitment hash in `hashedPartyGoers` only |
| Before check-in | Private | Hash count visible; no addresses |
| Check-in | **Public** | `receiveUnshielded` + address in `checkedInParty` |
| Claim fees | Organizer **public** | `sendUnshielded` to organizer address |

### Always-public Compact domains

- Ledger fields (after `disclose()` or safe commits)
- Circuit return values from exported circuits
- Contract-to-contract calls
- **Unshielded token transfers** (`receiveUnshielded`, `sendUnshielded`)

---

## 6) `contract/src/index.ts`

No witnesses — use `withVacantWitnesses`. **Use lazy `await import()` pattern** to avoid SSR issues and ensure `CompiledContract` is resolved from the correct module.

```typescript
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { sampleSigningKey, ContractState } from '@midnight-ntwrk/compact-runtime';

let _contractModule: any = null;
let _compiledContract: any = null;
let _ledgerFn: any = null;

export async function getCompiledContract(): Promise<any> {
  if (!_compiledContract) {
    if (!_contractModule) {
      _contractModule = await import('./managed/private-party/contract/index.js');
    }
    _compiledContract = CompiledContract.make(
      'private-party',
      _contractModule.Contract,
    );
    _compiledContract = CompiledContract.withVacantWitnesses(_compiledContract);
  }
  return _compiledContract;
}

export async function getLedger(): Promise<any> {
  if (!_ledgerFn) {
    if (!_contractModule) {
      _contractModule = await import('./managed/private-party/contract/index.js');
    }
    _ledgerFn = _contractModule.ledger;
  }
  return _ledgerFn;
}

export { sampleSigningKey, ContractState };
```

Key points:
- `CompiledContract` imported from `@midnight-ntwrk/compact-js` (not `compact-runtime`) — the two packages both export something with this name and only one matches the runtime's `withVacantWitnesses`.
- Lazy singleton (`getCompiledContract`, `getLedger`) — avoids the dual-instance WASM identity bug.
- `ContractState` and `sampleSigningKey` re-exported from `compact-runtime` so callers never import that package directly (keeps the single-copy guarantee from §4).

---

## 7) `lib/address.ts`

Decode Bech32 unshielded addresses for `UserAddress` circuit args. The `{ bytes: Uint8Array }` format is required for `UserAddress` — **not** for `Bytes<32>` args, which take a raw `Uint8Array`.

```typescript
import { MidnightBech32m, UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk-address-format';

export function bech32ToUserAddress(bech32: string, networkId: string): { bytes: Uint8Array } {
  const parsed = MidnightBech32m.parse(bech32).decode(UnshieldedAddress, networkId);
  return { bytes: new Uint8Array(parsed.data) };
}
```

---

## 8) `lib/secret.ts`

```typescript
import { toHex, fromHex } from './midnight';

export function generateSecret(): Uint8Array {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function saveSecret(role: 'organizer' | 'attendee', contractAddress: string, secret: Uint8Array) {
  localStorage.setItem(`private-party:${role}:${contractAddress}`, toHex(secret));
}

export function loadSecret(role: 'organizer' | 'attendee', contractAddress: string): Uint8Array | null {
  const hex = localStorage.getItem(`private-party:${role}:${contractAddress}`);
  return hex ? fromHex(hex) : null;
}
```

---

## 9) `lib/midnight.ts` — full implementation

This is the file that causes the most real-world breakage (see §15). It is given in full here rather than as bullets — do not improvise it.

```typescript
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';

export type NetworkName = 'preprod' | 'preview';

// Single source of truth for network — change this, not any hardcoded
// 'preprod' string elsewhere in the app, if you target a different network.
export const DEFAULT_NETWORK: NetworkName = 'preprod';

export interface NetworkConfig {
  networkId: NetworkName;
  indexerUri: string;
  indexerWsUri: string;
  proofServerUri: string;
}

const NETWORKS: Record<NetworkName, NetworkConfig> = {
  preprod: {
    networkId: 'preprod',
    indexerUri: 'https://indexer.preprod.midnight.network/api/v1/graphql',
    indexerWsUri: 'wss://indexer.preprod.midnight.network/api/v1/graphql/ws',
    proofServerUri: 'https://proof-server.preprod.midnight.network',
  },
  preview: {
    networkId: 'preview',
    indexerUri: 'https://indexer.preview.midnight.network/api/v1/graphql',
    indexerWsUri: 'wss://indexer.preview.midnight.network/api/v1/graphql/ws',
    proofServerUri: 'https://proof-server.preview.midnight.network',
  },
};

export interface ConnectedSession {
  unshieldedAddress: string;
  config: NetworkConfig;
  providers: {
    walletProvider: any;
    zkConfigProvider: any;
    privateStateProvider: any;
    publicDataProvider: any;
  };
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

// Wallet APIs return coin public keys in inconsistent shapes depending on
// wallet version — normalize all of them to a 32-byte Uint8Array.
export function coinPublicKeyToBytes(cpk: unknown): Uint8Array {
  if (cpk instanceof Uint8Array) return cpk;
  if (typeof cpk === 'string') return fromHex(cpk);
  if (Array.isArray(cpk)) return new Uint8Array(cpk);
  if (cpk && typeof cpk === 'object' && 'bytes' in (cpk as any)) {
    return coinPublicKeyToBytes((cpk as any).bytes);
  }
  throw new Error(`Unrecognized coin public key shape: ${JSON.stringify(cpk)}`);
}

export async function detectWallet(): Promise<any> {
  const w = (window as any).midnight;
  if (!w) throw new Error('No Midnight-compatible wallet found in window.midnight');
  if (w['1am']) return w['1am'];
  const first = Object.values(w)[0];
  if (!first) throw new Error('window.midnight is present but empty');
  return first;
}

function createPrivateStateProvider() {
  const store = new Map<string, unknown>();
  const contractAddresses = new Map<string, string>();
  const signingKeys = new Map<string, unknown>();
  return {
    async get(id: string) { return store.get(id) ?? null; },
    async set(id: string, state: unknown) { store.set(id, state); },
    async remove(id: string) { store.delete(id); },
    async setContractAddress(address: string) { contractAddresses.set('__current__', address); },
    async getContractAddress() { return contractAddresses.get('__current__') ?? null; },
    async setSigningKey(contractAddress: string, key: unknown) { signingKeys.set(contractAddress, key); },
    async getSigningKey(contractAddress: string) { return signingKeys.get(contractAddress) ?? null; },
  };
}

// The default indexer provider throws on `offset: null` against the
// preprod/preview indexer (see §15). This wraps it with a raw fetch that
// omits the offending field.
function createPatchedPublicDataProvider(queryUrl: string, subscriptionUrl: string) {
  const base = indexerPublicDataProvider(queryUrl, subscriptionUrl);
  return {
    ...base,
    async queryContractState(contractAddress: string) {
      const res = await fetch(queryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query ContractState($address: String!) {
              contractAction(address: $address) {
                state
              }
            }
          `,
          variables: { address: contractAddress },
        }),
      });
      const json = await res.json();
      const state = json?.data?.contractAction?.state;
      return state ? { state } : null;
    },
  };
}

export async function pollForState(
  queryUrl: string,
  contractAddress: string,
  { retries = 20, delayMs = 1500 }: { retries?: number; delayMs?: number } = {},
): Promise<string> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query ContractState($address: String!) {
            contractAction(address: $address) { state }
          }
        `,
        variables: { address: contractAddress },
      }),
    });
    const json = await res.json();
    const state = json?.data?.contractAction?.state;
    if (state) return state as string;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`Timed out waiting for contract state at ${contractAddress}`);
}

export async function createConnectedSession(
  walletApi: any,
  zkPath: string,
  network: NetworkName = DEFAULT_NETWORK,
): Promise<ConnectedSession> {
  const config = NETWORKS[network];
  const state = await walletApi.state();
  const unshieldedAddress: string = state.address ?? state.unshieldedAddress;

  const walletProvider = {
    coinPublicKey: coinPublicKeyToBytes(state.coinPublicKey),
    balanceTx: (tx: unknown) => walletApi.balanceTransaction(tx),
    submitTx: (tx: unknown) => walletApi.submitTransaction(tx),
  };

  const zkConfigProvider = new FetchZkConfigProvider(zkPath);
  const privateStateProvider = createPrivateStateProvider();
  const publicDataProvider = createPatchedPublicDataProvider(config.indexerUri, config.indexerWsUri);

  return {
    unshieldedAddress,
    config,
    providers: { walletProvider, zkConfigProvider, privateStateProvider, publicDataProvider },
  };
}
```

---

## 10) `lib/party.ts`

Uses `getCompiledContract()` (lazy singleton) and the correct arg format for Compact 0.23+.

```typescript
import { createUnprovenDeployTx, submitCallTxAsync, submitTxAsync } from '@midnight-ntwrk/midnight-js-contracts';
import { getCompiledContract, getLedger, sampleSigningKey, ContractState } from '../contract/src/index';
import type { ConnectedSession } from './midnight';
import { fromHex, pollForState } from './midnight';
import { bech32ToUserAddress } from './address';

const PRIVATE_STATE_ID = 'PrivatePartyState';
export const ZK_PATH = '/zk/private-party';

const PARTY_STATE_NAMES = [
  'NOT_STARTED',
  'READY',
  'STARTED',
  'DOORS_CLOSED',
  'FEES_CLAIMED',
] as const;

function setSize(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'size' in value) {
    const size = (value as { size: unknown }).size;
    if (typeof size === 'function') return Number((size as () => number)());
    if (typeof size === 'number') return size;
  }
  return 0;
}

export async function deployParty(
  session: ConnectedSession,
  partySize: number,
  entryFeeStars: number,
  organizerSecret: Uint8Array,
): Promise<string> {
  const cc = await getCompiledContract();
  const deployTxData = await (createUnprovenDeployTx as any)(
    {
      zkConfigProvider: session.providers.zkConfigProvider,
      walletProvider: session.providers.walletProvider,
    },
    {
      compiledContract: cc,
      args: [BigInt(partySize), BigInt(entryFeeStars), organizerSecret],
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
  const cc = await getCompiledContract();
  await (submitCallTxAsync as any)(session.providers, {
    compiledContract: cc,
    contractAddress,
    circuitId,
    args,
    privateStateId: PRIVATE_STATE_ID,
  });
}

export const rsvp = (session: ConnectedSession, contractAddress: string, userAddress: { bytes: Uint8Array }, attendeeSecret: Uint8Array) =>
  call(session, contractAddress, 'rsvp', [userAddress, attendeeSecret]);

export const startParty = (session: ConnectedSession, contractAddress: string, organizerSecret: Uint8Array) =>
  call(session, contractAddress, 'startParty', [organizerSecret]);

export const checkIn = (session: ConnectedSession, contractAddress: string, userAddress: { bytes: Uint8Array }, attendeeSecret: Uint8Array) =>
  call(session, contractAddress, 'checkIn', [userAddress, attendeeSecret]);

export const closeEntry = (session: ConnectedSession, contractAddress: string, organizerSecret: Uint8Array) =>
  call(session, contractAddress, 'closeEntry', [organizerSecret]);

export const claimFees = (session: ConnectedSession, contractAddress: string, organizerAddress: { bytes: Uint8Array }, organizerSecret: Uint8Array) =>
  call(session, contractAddress, 'claimFees', [organizerAddress, organizerSecret]);

export async function decodePartyState(stateHex: string) {
  const contractState = ContractState.deserialize(fromHex(stateHex));
  const ledger = await getLedger();
  const l = ledger(contractState.data) as any;
  const stateIdx = Number(l.partyState);
  return {
    partyState: PARTY_STATE_NAMES[stateIdx] ?? `UNKNOWN(${stateIdx})`,
    partyStateIndex: stateIdx,
    maxListSize: Number(l.maxListSize),
    entryFee: Number(l.entryFee),
    rsvpCount: setSize(l.hashedPartyGoers),
    checkedInCount: setSize(l.checkedInParty),
  };
}

export async function fetchPartyState(queryUrl: string, contractAddress: string) {
  const hex = await pollForState(queryUrl, contractAddress);
  return decodePartyState(hex);
}

export function userAddressFromSession(session: ConnectedSession) {
  return bech32ToUserAddress(session.unshieldedAddress, session.config.networkId);
}
```

**Key details:**
- `args` use `BigInt(...)` for `Uint<16>` fields, not plain numbers.
- `Bytes<32>` args are passed as raw `Uint8Array`, **not** wrapped in `{ bytes: ... }`. `UserAddress` args require the `{ bytes }` wrapper.
- `ledger()` is resolved via `getLedger()` from the contract's own compiled module — never a static top-level import (breaks the lazy-singleton guarantee from §6).
- `setSize()` handles both `.size` (property) and `.size()` (method) since compiled `Set` ledger fields vary by SDK version.

---

## 11) Frontend — `app/party/PartyClient.tsx`

Full component — no placeholder handlers.

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  checkIn,
  claimFees,
  closeEntry,
  deployParty,
  fetchPartyState,
  rsvp,
  startParty,
  userAddressFromSession,
  ZK_PATH,
} from '@/lib/party';
import { createConnectedSession, detectWallet, DEFAULT_NETWORK, type ConnectedSession } from '@/lib/midnight';
import { generateSecret, loadSecret, saveSecret } from '@/lib/secret';

type Role = 'organizer' | 'attendee';

export default function PartyClient() {
  const [session, setSession] = useState<ConnectedSession | null>(null);
  const [role, setRole] = useState<Role>('attendee');
  const [contractAddress, setContractAddress] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [entryFee, setEntryFee] = useState('5');
  const [status, setStatus] = useState<Awaited<ReturnType<typeof fetchPartyState>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session || !contractAddress) return;
    try {
      setStatus(await fetchPartyState(session.config.indexerUri, contractAddress));
    } catch (e) {
      setError(String(e));
    }
  }, [session, contractAddress]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function guard(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const onConnect = () => guard(async () => {
    const wallet = await detectWallet();
    const api = await wallet.connect(DEFAULT_NETWORK);
    setSession(await createConnectedSession(api, ZK_PATH));
  });

  const onDeploy = () => guard(async () => {
    if (!session) return;
    const secret = generateSecret();
    const addr = await deployParty(session, Number(partySize), Number(entryFee), secret);
    setContractAddress(addr);
    saveSecret('organizer', addr, secret);
  });

  const onRsvp = () => guard(async () => {
    if (!session || !contractAddress) return;
    let secret = loadSecret('attendee', contractAddress);
    if (!secret) {
      secret = generateSecret();
      saveSecret('attendee', contractAddress, secret);
    }
    await rsvp(session, contractAddress, userAddressFromSession(session), secret);
  });

  const onStartParty = () => guard(async () => {
    if (!session || !contractAddress) return;
    const secret = loadSecret('organizer', contractAddress);
    if (!secret) throw new Error('No organizer secret found for this contract in this browser');
    await startParty(session, contractAddress, secret);
  });

  const onCheckIn = () => guard(async () => {
    if (!session || !contractAddress) return;
    const secret = loadSecret('attendee', contractAddress);
    if (!secret) throw new Error('RSVP first — no attendee secret found for this contract');
    await checkIn(session, contractAddress, userAddressFromSession(session), secret);
  });

  const onCloseEntry = () => guard(async () => {
    if (!session || !contractAddress) return;
    const secret = loadSecret('organizer', contractAddress);
    if (!secret) throw new Error('No organizer secret found for this contract in this browser');
    await closeEntry(session, contractAddress, secret);
  });

  const onClaimFees = () => guard(async () => {
    if (!session || !contractAddress) return;
    const secret = loadSecret('organizer', contractAddress);
    if (!secret) throw new Error('No organizer secret found for this contract in this browser');
    await claimFees(session, contractAddress, userAddressFromSession(session), secret);
  });

  return (
    <div className="mx-auto max-w-xl p-6 text-zinc-100">
      <h1 className="text-2xl font-semibold">Private Party</h1>
      <p className="mt-1 text-muted">Attendees stay private until check-in pays unshielded NIGHT.</p>

      {!session ? (
        <button type="button" onClick={onConnect} disabled={busy}
          className="mt-4 rounded bg-brand px-4 py-2 hover:bg-brand-hover disabled:opacity-50">
          Connect Wallet
        </button>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted">Connected: {session.unshieldedAddress}</p>

          <label className="block">
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}
              className="ml-2 rounded border border-border bg-surface px-2 py-1 text-zinc-100">
              <option value="organizer">Organizer</option>
              <option value="attendee">Attendee</option>
            </select>
          </label>

          <label className="block">
            Contract address
            <input value={contractAddress} onChange={(e) => setContractAddress(e.target.value.trim())}
              placeholder="mn_contract1..."
              className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-zinc-100 placeholder:text-zinc-500" />
          </label>

          {status ? (
            <p className="rounded border border-border bg-card p-3 text-sm">
              State: {status.partyState} · RSVPs: {status.rsvpCount}/{status.maxListSize} ·
              Checked in: {status.checkedInCount} · Fee: {status.entryFee} Stars
            </p>
          ) : null}

          {role === 'organizer' && !contractAddress ? (
            <div className="space-y-2 rounded border border-border bg-card p-3">
              <label className="block">Max guests
                <input value={partySize} onChange={(e) => setPartySize(e.target.value)}
                  className="ml-2 w-20 rounded border border-border bg-surface px-2 py-1 text-zinc-100" />
              </label>
              <label className="block">Entry fee (Stars)
                <input value={entryFee} onChange={(e) => setEntryFee(e.target.value)}
                  className="ml-2 w-24 rounded border border-border bg-surface px-2 py-1 text-zinc-100" />
              </label>
              <button type="button" onClick={onDeploy} disabled={busy}
                className="rounded bg-brand px-3 py-1.5 hover:bg-brand-hover disabled:opacity-50">
                Deploy Party
              </button>
            </div>
          ) : null}

          {role === 'organizer' && contractAddress ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={onStartParty} disabled={busy}
                className="rounded bg-brand px-3 py-1.5 hover:bg-brand-hover disabled:opacity-50">Start party</button>
              <button type="button" onClick={onCloseEntry} disabled={busy}
                className="rounded bg-card border border-border px-3 py-1.5 hover:bg-[#1e1e38] disabled:opacity-50">Close doors</button>
              <button type="button" onClick={onClaimFees} disabled={busy}
                className="rounded bg-success px-3 py-1.5 hover:opacity-90 disabled:opacity-50">Claim fees</button>
            </div>
          ) : null}

          {role === 'attendee' && contractAddress ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={onRsvp} disabled={busy}
                className="rounded bg-brand px-3 py-1.5 hover:bg-brand-hover disabled:opacity-50">RSVP</button>
              <button type="button" onClick={onCheckIn} disabled={busy}
                className="rounded bg-danger px-3 py-1.5 hover:opacity-90 disabled:opacity-50">
                Check in (pays {status?.entryFee ?? '?'} Stars — becomes public)
              </button>
            </div>
          ) : null}
        </div>
      )}

      {error ? <p role="alert" className="mt-4 rounded border border-danger bg-[#3a1414] p-2 text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
```

---

## 12) ZK Asset Sync — `scripts/sync-zk-assets.mjs`

```javascript
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'contract/src/managed/private-party');
const dest = join(root, 'public/zk/private-party');

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
for (const dir of ['keys', 'zkir']) {
  cpSync(join(src, dir), join(dest, dir), { recursive: true });
}
```

Verify: `http://localhost:3000/zk/private-party/keys/rsvp.prover` returns 200.

---

## 13) `next.config.mjs`

Required — without this, webpack fails to resolve the Midnight SDK's Node built-ins and WASM.

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true, topLevelAwait: true };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      child_process: false,
      stream: 'stream-browserify',
    };
    config.resolve.alias = {
      ...config.resolve.alias,
      'isomorphic-ws': join(process.cwd(), 'lib/isomorphic-ws-fix.mjs'),
    };
    return config;
  },
  // Static generation tries to resolve the SDK's Node deps and can hang the build.
  images: { unoptimized: true },
};

import { join } from 'node:path';
export default nextConfig;
```

---

## 14) `postcss.config.mjs` and `app/globals.css`

```javascript
// postcss.config.mjs
export default {
  plugins: { '@tailwindcss/postcss': {} },
};
```

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  --color-brand: #7c3aed;
  --color-brand-hover: #6d28d9;
  --color-surface: #1a1a2e;
  --color-card: #16213e;
  --color-border: #2a2a4a;
  --color-muted: #9ca3af;
  --color-success: #16a34a;
  --color-danger: #dc2626;
}
```

```tsx
/* app/layout.tsx */
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0f0f23] text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
```

No light theme — everything is dark surface/card/border/muted. Inputs and selects must use `bg-surface text-zinc-100` explicitly (a raw `<input>` defaults to a white background that renders invisible text on this theme).

---

## 15) Local Devnet Tests (Official Repo)

```bash
git clone git@github.com:midnightntwrk/example-private-party.git
cd example-private-party
yarn install
yarn compile
yarn env:up          # Docker: node + indexer + proof-server
yarn test:local      # vitest party.test.ts
```

Expected flow (11 tests):
1. Deploy contract (Alice organizer)
2. Bob RSVPs privately
3. Alice (organizer) rejected from RSVP
4. Claire RSVPs
5. Bob rejected from startParty
6. Alice starts party
7. Bob checks in → becomes public
8. Bob rejected from closeEntry
9. Alice closes doors
10. Alice claimFees → NIGHT balance increases by `checkedInCount * entryFee`
11. Hard-way deploy test

Read `/src/test/party.test.ts` for MidnightJS provider patterns with `FluentWalletBuilder`.

---

## 16) End-to-End Browser Flow

```
1. npm install && npm run compact && npm run sync:assets
2. npm run dev
3. Organizer: Connect 1AM → Deploy (max 2 guests, fee 5 Stars) → copy contract address
4. Attendee (other browser/wallet): Connect → paste address → RSVP
5. Organizer: Start party (or wait until RSVP list full → READY)
6. Attendee: Check in (wallet pays 5 Stars unshielded — address now public on ledger)
7. Organizer: Close doors (if needed) → Claim fees to unshielded address
8. Poll indexer — verify checkedInCount and partyState transitions
```

---

## 17) Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Organizer cannot RSVP` | Organizer secret used for RSVP | Use separate attendee secret |
| `You are not on the list` | Wrong secret or address at check-in | Same `_secret` + `UserAddress` as RSVP |
| `The party has already started` | RSVP after startParty | RSVP only in NOT_STARTED |
| `Only the organizer can start` | Wrong organizer secret | Reload from `localStorage` or redeploy |
| `Contract balance wrong` | Fee mismatch or partial check-ins | Verify `entryFee * checkedInCount` |
| `Invalid character 'm' at position 0` | Bech32 passed as bytes | Use `bech32ToUserAddress()` |
| Deploy hangs 30–120s | Used `deployContract()` | Use `createUnprovenDeployTx` + `submitTxAsync` |
| GraphQL `offset: null` | Default indexer provider | Use patched `queryContractState` (§9) |
| ZK 404 | Assets not synced | `npm run sync:assets` |
| Lost organizer secret | No recovery on-chain | Redeploy contract; store secret in localStorage |
| `CompiledContract.withVacantWitnesses` TypeScript error | `compact-runtime` vs `compact-js` mismatch | Import `CompiledContract` from `@midnight-ntwrk/compact-js` |
| `ContractMaintenanceAuthority` WASM identity error | Dual `compact-runtime` instances (contract-local `node_modules` + root) | Never `npm install` inside `contract/` (§4) |
| `makeCompiledContract` not a function | Static import fails in browser | Lazy `await import(...)` + singleton (§6) |
| `bigint` type mismatch on constructor args | Passed `number` where `bigint` expected | Wrap in `BigInt(value)` for `Uint<16>` fields |
| `Bytes<32>` wrapped in `{ bytes: ... }` mismatch | Confusing it with `UserAddress` | Raw `Uint8Array` for `Bytes<32>`; `{ bytes }` only for `UserAddress` |
| `ContractState.deserialize` argument type mismatch | Passed hex string directly | `ContractState.deserialize(fromHex(action.state))` — needs `Uint8Array` |
| `ledger()` is not a function | Called a static import instead of the contract's own export | `getLedger()` from `contract/src/index.ts` (§6) |
| `isomorphic-ws` not found in webpack | Missing Node polyfills | `next.config.mjs` fallback + alias (§13) |
| `pipeline is not a function` | Missing `stream` polyfill | `stream: 'stream-browserify'` in `next.config.mjs` (§13) |
| Tailwind v4 not applied | Missing PostCSS config | `postcss.config.mjs` with `@tailwindcss/postcss` (§14) |
| Input/select text invisible on dark bg | Browser default white input bg | `bg-surface text-zinc-100` on all inputs (§14) |
| `size()` not a function on Set ledger fields | `.size` is a property in some SDK versions, method in others | `setSize()` helper handles both (§10) |
| `npm run build` hangs | Static generation tries to resolve SDK's Node deps | `images: { unoptimized: true }` in `next.config.mjs` (§13) |
| Wallet rejects connection / wrong chain | App and wallet on different networks | Both must match `DEFAULT_NETWORK` in `lib/midnight.ts` (§9) — change one config, not scattered strings |

---

## 18) Agent Checklist

- [ ] Write `private-party.compact` with all six exported circuits + helper circuits (§5)
- [ ] Compile; sync ZK assets to `public/zk/private-party/`
- [ ] `CompiledContract.withVacantWitnesses` from `@midnight-ntwrk/compact-js`, not `compact-runtime`
- [ ] Lazy `getCompiledContract()` / `getLedger()` singleton (§6)
- [ ] `lib/midnight.ts` copied in full from §9 — do not improvise the provider layer
- [ ] `next.config.mjs` and `postcss.config.mjs` copied in full from §13–14
- [ ] Constructor args: `[BigInt(partySize), BigInt(entryFeeStars), rawUint8Array]`
- [ ] Decode unshielded Bech32 via `wallet-sdk-address-format`
- [ ] Store organizer/attendee secrets in `localStorage` per contract address
- [ ] UI explains the privacy boundary before the check-in button (see copy in §11)
- [ ] Never run `npm install` inside `contract/`
- [ ] Confirm `DEFAULT_NETWORK` in `lib/midnight.ts` matches the target network before demoing

---

## 19) Extensions

### Shielded entry fees

To keep attendees private through payment, rework `checkIn` to use shielded tokens instead of `receiveUnshielded` — see tutorial conclusion and `token-transfers/` skill.

### Multi-party testing UI

Add "copy invite link" with contract address query param; show public `checkedInParty` addresses after boundary crossed.

### Headless CI

Port official `party.test.ts` into the template monorepo using `example-hello-world/` Docker compose pattern.

---

## 20) Related Skills

| Next step | Skill |
|---|---|
| Wallet connect only | `react-wallet-connector/` |
| Unshielded token flows | `token-transfers/` |
| Payment vault pattern | `example-payment-dapp/` |
| Privacy audit | `security/` |
| Compact language reference | `compact/` |
| Local vitest harness | `example-hello-world/` |