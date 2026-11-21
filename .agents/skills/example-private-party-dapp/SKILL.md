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
- `references/gotchas.md` — Ledger 9 errors (version mismatch, `EraMismatchError`, Blockfrost 410/403), ZK asset paths
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
- Use `deployContract` / `findDeployedContract` with providers typed to the contract (no `as any`)
- Plain `indexerPublicDataProvider(network.indexer)`; the old `offset: null` patch is obsolete on indexer 4.4.101
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
└── public/zk/private-party/        # compiler/ + keys/ + zkir/ (gitignored until sync)
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
  "name": "private-party-dapp-template",
  "version": "0.1.0",
  "private": true,
  "author": "Kali-Decoder",
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "npm run sync:assets && next build",
    "compact": "npm run compact --prefix contract",
    "sync:assets": "node scripts/sync-zk-assets.mjs",
    "postinstall": "npm install --prefix contract"
  },
  "dependencies": {
    "@midnight-ntwrk/compact-js": "3.0.2",
    "@midnight-ntwrk/compact-runtime": "0.21.0",
    "@midnightntwrk/dapp-connector-api": "4.1.0",
    "@midnightntwrk/ledger-v9": "1.0.2",
    "@midnightntwrk/midnight-js-contracts": "5.0.2",
    "@midnightntwrk/midnight-js-dapp-connector-proof-provider": "5.0.2",
    "@midnightntwrk/midnight-js-fetch-zk-config-provider": "5.0.2",
    "@midnightntwrk/midnight-js-indexer-public-data-provider": "5.0.2",
    "@midnightntwrk/midnight-js-level-private-state-provider": "5.0.2",
    "@midnightntwrk/midnight-js-types": "5.0.2",
    "@midnightntwrk/midnight-js-utils": "5.0.2",
    "@midnightntwrk/wallet-sdk-address-format": "4.0.1",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
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
  "name": "@private-party/contract",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "compact": "compact compile +0.36.1 src/private-party.compact src/managed/private-party"
  },
  "dependencies": {
    "@midnight-ntwrk/compact-js": "3.0.2",
    "@midnight-ntwrk/compact-runtime": "0.21.0"
  }
}
```

**Do not run `npm install` inside `contract/`** — a second copy of `@midnight-ntwrk/compact-runtime` there causes the dual-WASM-instance bug (`ContractMaintenanceAuthority` identity error). All deps live at root; `contract/package.json` exists only for the `compact` compile script.

Compile:

```bash
npm run compact
# → contract/src/managed/private-party/{compiler,contract,keys,zkir}/
npm run sync:assets
# → public/zk/private-party/
```

Expected circuits: `rsvp`, `startParty`, `checkIn`, `closeEntry`, `claimFees`.

---

## 5) `contract/src/private-party.compact`

In scaffold mode, use this exactly. In tutorial mode, build it up circuit by circuit in this order: ledger declarations → constructor → `rsvp` → `startParty` → `checkIn` → `closeEntry` → `claimFees` → helper circuits.

```compact
pragma language_version >= 0.28.0;
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

export {
  Contract,
  ledger,
  pureCircuits,
  type Ledger,
} from './managed/private-party/contract/index.js';
import { Contract } from './managed/private-party/contract/index.js';

// Browser bundle: no node:path / node:url. Keys + ZKIR load through the session's FetchZkConfigProvider.
export const zkConfigPath = '/zk/private-party';

export type PartyPrivateState = Record<string, never>;
export type PrivatePartyContract = Contract<PartyPrivateState>;

export const CompiledPrivatePartyContract = CompiledContract.make<PrivatePartyContract>('private-party', Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);
```

Key points:
- `CompiledContract` imported from `@midnight-ntwrk/compact-js` (not `compact-runtime`) — the two packages both export something with this name and only one matches the runtime's `withVacantWitnesses`.
- Lazy singleton (`getCompiledContract`, `getLedger`) — avoids the dual-instance WASM identity bug.
- `ContractState` and `sampleSigningKey` re-exported from `compact-runtime` so callers never import that package directly (keeps the single-copy guarantee from §4).

---

## 7) `lib/address.ts`

Decode Bech32 unshielded addresses for `UserAddress` circuit args. The `{ bytes: Uint8Array }` format is required for `UserAddress` — **not** for `Bytes<32>` args, which take a raw `Uint8Array`.

```typescript
import { MidnightBech32m, UnshieldedAddress } from '@midnightntwrk/wallet-sdk-address-format';

export function bech32ToUserAddress(bech32: string, networkId: string): { bytes: Uint8Array } {
  const parsed = MidnightBech32m.parse(bech32).decode(UnshieldedAddress, networkId);
  return { bytes: new Uint8Array(parsed.data) };
}
```

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
  role: 'organizer' | 'attendee',
  contractAddress: string,
  secret: Uint8Array,
) {
  localStorage.setItem(`private-party:${role}:${contractAddress}`, toHex(secret));
}

export function loadSecret(
  role: 'organizer' | 'attendee',
  contractAddress: string,
): Uint8Array | null {
  const hex = localStorage.getItem(`private-party:${role}:${contractAddress}`);
  return hex ? fromHex(hex) : null;
}
```

---

## 9) `lib/midnight.ts` — full implementation

This is the file that causes the most real-world breakage (see §15). It is given in full here rather than as bullets — do not improvise it.

```typescript
// Ledger 9 / Midnight.js 5 browser session for DApp Connector wallets (1AM, Lace).
// Canonical copy: references/midnight-session.md. Keep the templates in sync with it.
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

---

## 10) `lib/party.ts`

Uses `deployContract` / `findDeployedContract` with typed providers. Argument shapes follow the generated `.d.ts`: `Bytes<32>` secrets are plain `Uint8Array`, `UserAddress` is `{ bytes }`.

```typescript
import type { ProvableCircuitId } from '@midnight-ntwrk/compact-js';
import { deployContract, findDeployedContract } from '@midnightntwrk/midnight-js-contracts';
import type { MidnightProviders } from '@midnightntwrk/midnight-js-types';
import {
  CompiledPrivatePartyContract,
  ledger,
  type PartyPrivateState,
  type PrivatePartyContract,
} from '../contract/src/index';
import type { ConnectedSession } from './midnight';
import { queryLatestState } from './midnight';
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

export type PartyStateName = (typeof PARTY_STATE_NAMES)[number];

type PartyProviders = MidnightProviders<ProvableCircuitId<PrivatePartyContract>, typeof PRIVATE_STATE_ID, PartyPrivateState>;
const providersFor = (session: ConnectedSession) => session.providers as unknown as PartyProviders;

async function connect(session: ConnectedSession, contractAddress: string) {
  return findDeployedContract(providersFor(session), {
    compiledContract: CompiledPrivatePartyContract,
    contractAddress,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: {},
  });
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

export async function deployParty(
  session: ConnectedSession,
  partySize: number,
  entryFeeStars: number,
  organizerSecret: Uint8Array,
): Promise<string> {
  const deployed = await deployContract(providersFor(session), {
    compiledContract: CompiledPrivatePartyContract,
    args: [BigInt(partySize), BigInt(entryFeeStars), organizerSecret],
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: {},
  });
  return deployed.deployTxData.public.contractAddress;
}

export async function rsvp(
  session: ConnectedSession,
  contractAddress: string,
  userAddress: { bytes: Uint8Array },
  attendeeSecret: Uint8Array,
) {
  const party = await connect(session, contractAddress);
  await party.callTx.rsvp(userAddress, attendeeSecret);
}

export async function startParty(
  session: ConnectedSession,
  contractAddress: string,
  organizerSecret: Uint8Array,
) {
  const party = await connect(session, contractAddress);
  await party.callTx.startParty(organizerSecret);
}

export async function checkIn(
  session: ConnectedSession,
  contractAddress: string,
  userAddress: { bytes: Uint8Array },
  attendeeSecret: Uint8Array,
) {
  const party = await connect(session, contractAddress);
  await party.callTx.checkIn(userAddress, attendeeSecret);
}

export async function closeEntry(
  session: ConnectedSession,
  contractAddress: string,
  organizerSecret: Uint8Array,
) {
  const party = await connect(session, contractAddress);
  await party.callTx.closeEntry(organizerSecret);
}

export async function claimFees(
  session: ConnectedSession,
  contractAddress: string,
  organizerAddress: { bytes: Uint8Array },
  organizerSecret: Uint8Array,
) {
  const party = await connect(session, contractAddress);
  await party.callTx.claimFees(organizerAddress, organizerSecret);
}

export function decodePartyState(data: Parameters<typeof ledger>[0]) {
  const l = ledger(data);
  const stateIdx = Number(l.partyState);
  return {
    partyState: (PARTY_STATE_NAMES[stateIdx] ?? `UNKNOWN(${stateIdx})`) as PartyStateName | string,
    partyStateIndex: stateIdx,
    maxListSize: Number(l.maxListSize),
    entryFee: Number(l.entryFee),
    rsvpCount: setSize(l.hashedPartyGoers),
    checkedInCount: setSize(l.checkedInParty),
  };
}

export async function fetchPartyState(session: ConnectedSession, contractAddress: string) {
  const state = await queryLatestState(session, contractAddress);
  return state ? decodePartyState(state.data) : null;
}

export function userAddressFromSession(session: ConnectedSession) {
  return bech32ToUserAddress(session.unshieldedAddress, session.network.networkId);
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

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { createConnectedSession, detectWallet, type ConnectedSession } from '@/lib/midnight';
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
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session || !contractAddress) return;
    setStatus(await fetchPartyState(session, contractAddress));
  }, [session, contractAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const organizerSecret = useMemo(
    () => (contractAddress ? loadSecret('organizer', contractAddress) : null),
    [contractAddress, status],
  );

  const attendeeSecret = useMemo(
    () => (contractAddress ? loadSecret('attendee', contractAddress) : null),
    [contractAddress, status],
  );

  async function onConnect() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const wallet = await detectWallet();
      const api = await wallet.connect('preprod');
      setSession(await createConnectedSession(api, ZK_PATH));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDeploy() {
    if (!session) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const secret = generateSecret();
      const addr = await deployParty(
        session,
        Number(partySize),
        Number(entryFee),
        secret,
      );
      setContractAddress(addr);
      saveSecret('organizer', addr, secret);
      setMessage(`Party deployed. Share this address with guests: ${addr}`);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onRsvp() {
    if (!session || !contractAddress) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      let secret = loadSecret('attendee', contractAddress);
      if (!secret) {
        secret = generateSecret();
        saveSecret('attendee', contractAddress, secret);
      }
      await rsvp(session, contractAddress, userAddressFromSession(session), secret);
      setMessage('RSVP submitted privately — your address is not on-chain yet.');
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onStartParty() {
    if (!session || !contractAddress || !organizerSecret) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await startParty(session, contractAddress, organizerSecret);
      setMessage('Party started — guests can check in.');
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onCheckIn() {
    if (!session || !contractAddress || !attendeeSecret) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await checkIn(session, contractAddress, userAddressFromSession(session), attendeeSecret);
      setMessage(
        'Checked in — unshielded entry fee paid. Your address is now public on the ledger.',
      );
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onCloseEntry() {
    if (!session || !contractAddress || !organizerSecret) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await closeEntry(session, contractAddress, organizerSecret);
      setMessage('Doors closed.');
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onClaimFees() {
    if (!session || !contractAddress || !organizerSecret) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await claimFees(
        session,
        contractAddress,
        userAddressFromSession(session),
        organizerSecret,
      );
      setMessage('Fees claimed to your unshielded address.');
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const canRsvp = status?.partyState === 'NOT_STARTED';
  const canStart =
    status?.partyState === 'NOT_STARTED' || status?.partyState === 'READY';
  const canCheckIn = status?.partyState === 'STARTED' && Boolean(attendeeSecret);
  const canClose = status?.partyState === 'STARTED' && Boolean(organizerSecret);
  const canClaim = status?.partyState === 'DOORS_CLOSED' && Boolean(organizerSecret);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>Private Party</h1>
      <p>
        Attendees RSVP privately. Checking in pays unshielded NIGHT and crosses the{' '}
        <strong>privacy boundary</strong> — guest addresses become public.
      </p>

      {!session ? (
        <button type="button" onClick={onConnect} disabled={busy}>
          Connect 1AM Wallet
        </button>
      ) : (
        <>
          <p>Connected: {session.unshieldedAddress}</p>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <label>
              Role{' '}
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="organizer">Organizer</option>
                <option value="attendee">Attendee</option>
              </select>
            </label>
            <label style={{ flex: 1, minWidth: 280 }}>
              Contract address{' '}
              <input
                style={{ width: '100%' }}
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value.trim())}
                placeholder="Paste deployed contract address"
              />
            </label>
          </div>

          {status ? (
            <section style={{ background: '#f4f4f5', padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}>
              <p>
                <strong>State:</strong> {status.partyState}
              </p>
              <p>
                RSVPs: {status.rsvpCount} / {status.maxListSize} · Checked in: {status.checkedInCount} ·
                Entry fee: {status.entryFee} Stars
              </p>
            </section>
          ) : contractAddress ? (
            <p>Loading party state from indexer…</p>
          ) : null}

          {role === 'organizer' ? (
            <section style={{ display: 'grid', gap: '0.75rem' }}>
              {!contractAddress ? (
                <>
                  <label>
                    Max guests{' '}
                    <input
                      type="number"
                      min={1}
                      value={partySize}
                      onChange={(e) => setPartySize(e.target.value)}
                    />
                  </label>
                  <label>
                    Entry fee (Stars){' '}
                    <input
                      type="number"
                      min={1}
                      value={entryFee}
                      onChange={(e) => setEntryFee(e.target.value)}
                    />
                  </label>
                  <button type="button" onClick={onDeploy} disabled={busy}>
                    Deploy Party Contract
                  </button>
                </>
              ) : (
                <>
                  {organizerSecret ? (
                    <p>Organizer secret stored in this browser.</p>
                  ) : (
                    <p role="alert">
                      Organizer secret missing — deploy from this browser or you cannot manage the party.
                    </p>
                  )}
                  <button type="button" onClick={onStartParty} disabled={busy || !canStart || !organizerSecret}>
                    Start Party
                  </button>
                  <button type="button" onClick={onCloseEntry} disabled={busy || !canClose}>
                    Close Doors
                  </button>
                  <button type="button" onClick={onClaimFees} disabled={busy || !canClaim}>
                    Claim Fees
                  </button>
                </>
              )}
            </section>
          ) : (
            <section style={{ display: 'grid', gap: '0.75rem' }}>
              <button type="button" onClick={onRsvp} disabled={busy || !contractAddress || !canRsvp}>
                RSVP (private)
              </button>
              {attendeeSecret ? (
                <p>Attendee secret stored — use the same browser to check in.</p>
              ) : (
                <p>RSVP generates a secret in this browser; keep it for check-in.</p>
              )}
              <button type="button" onClick={onCheckIn} disabled={busy || !contractAddress || !canCheckIn}>
                Check In (pays entry fee — becomes public)
              </button>
            </section>
          )}

          <button
            type="button"
            onClick={() => void refresh()}
            disabled={busy || !contractAddress}
            style={{ marginTop: '1rem' }}
          >
            Refresh State
          </button>
        </>
      )}

      {message ? <p style={{ color: '#166534' }}>{message}</p> : null}
      {error ? (
        <p role="alert" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      ) : null}
    </main>
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
// compiler/ carries contract-manifest.json + contract-info.json; without it the provider throws EraMismatchError.
for (const dir of ['compiler', 'keys', 'zkir']) {
  cpSync(join(src, dir), join(dest, dir), { recursive: true });
}
console.log('Synced ZK assets to public/zk/private-party/');
```

Verify: `http://localhost:3000/zk/private-party/keys/rsvp.prover` returns 200.

---

## 13) `next.config.mjs`

Required — without this, webpack fails to resolve the Midnight SDK's Node built-ins and WASM.

```javascript
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
      };
      config.resolve.alias = {
        ...config.resolve.alias,
        'isomorphic-ws': require.resolve('./lib/isomorphic-ws-fix.mjs'),
      };
    }
    config.experiments = { ...config.experiments, asyncWebAssembly: true, topLevelAwait: true };
    return config;
  },
};

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
| `Version mismatch: compiled code expects 0.21.0, runtime is 0.16.0` | Old runtime | `compact-runtime@0.21.0` + `compact compile +0.36.1` |
| `EraMismatchError: artifact-era-undeclared` | `public/zk/...` lacks `compiler/` | Re-run `npm run sync:assets` |
| Indexer 410 `ENDPOINT_DECOMMISSIONED` | Hardcoded old preprod host | Endpoints come from the wallet (`dappConnectorNetwork`) |
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