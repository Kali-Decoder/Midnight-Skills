---
name: example-private-party-dapp
author: Kali-Decoder
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

**What this skill produces:**
- `contract/` — `private-party.compact` (no witnesses) + compile scripts
- `app/party/` — Next.js client UI (organizer deploy/start/close/claim + attendee RSVP/check-in)
- `lib/midnight.ts` — wallet session + patched indexer provider (**copy from** `references/midnight-session.md` or `templates/private-party-dapp/lib/midnight.ts`)
- `lib/party.ts` — deploy, `rsvp`, `startParty`, `checkIn`, `closeEntry`, `claimFees`, ledger decode
- `lib/address.ts` — Bech32 unshielded address → `{ bytes: Uint8Array }` for `UserAddress` circuit args
- `lib/secret.ts` — generate/store 32-byte DApp secrets in `localStorage`
- `public/zk/private-party/` — ZK proving assets synced from contract build

**Shared references** (canonical provider + troubleshooting — do not duplicate in prompts):
- `references/midnight-session.md` — `createConnectedSession`, indexer patch, deploy/call helpers
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

---

## Workflow

When helping the user, follow this sequence:

1. **Contract** — write `private-party.compact` by hand (tutorial focus); compile with `yarn compile`
2. **Understand privacy boundary** — private RSVP → public check-in (unshielded) → public payout
3. **Providers** — `createConnectedSession` (from `references/midnight-session.md`)
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
├── lib/
│   ├── isomorphic-ws-fix.mjs
│   ├── midnight.ts                 # session, patched provider, hex helpers
│   ├── party.ts                    # deploy, circuits, decode state
│   ├── address.ts                  # Bech32 → UserAddress bytes
│   └── secret.ts                   # crypto.getRandomValues + localStorage
├── app/
│   ├── layout.tsx
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

Browser: **1AM wallet** on `preprod` with tNIGHT for entry fees.

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
    "compact": "compact compile src/private-party.compact src/managed/private-party"
  },
  "dependencies": {
    "@midnight-ntwrk/compact-runtime": "0.16.0"
  }
}
```

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

Write this file **by hand** following the tutorial — do not copy-paste without understanding each circuit.

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

No witnesses — use `withVacantWitnesses`:

```typescript
import { CompiledContract } from '@midnight-ntwrk/compact-runtime';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export {
  Contract,
  ledger,
  pureCircuits,
  type Ledger,
} from './managed/private-party/contract/index.js';
import { Contract } from './managed/private-party/contract/index.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const zkConfigPath = path.resolve(currentDir, 'managed', 'private-party');

export const CompiledPrivatePartyContract = CompiledContract.make(
  'private-party',
  Contract,
).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);
```

---

## 7) `lib/address.ts`

Decode Bech32 unshielded addresses for `UserAddress` circuit args:

```typescript
import { MidnightBech32m, UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk-address-format';

export function bech32ToUserAddress(bech32: string, networkId: string): { bytes: Uint8Array } {
  const parsed = MidnightBech32m.parse(bech32).decode(UnshieldedAddress, networkId);
  return { bytes: new Uint8Array(parsed.data) };
}
```

Never pass raw Bech32 strings or shielded coin public keys where `UserAddress` is expected.

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

## 9) Provider Setup

Copy the **full provider block** from `example-payment-dapp/SKILL.md` § "Provider Setup" or `templates/private-party-dapp/lib/midnight.ts`:
- `ConnectedSession` type
- `createConnectedSession` (ZK path → `/zk/private-party/`)
- `createPatchedPublicDataProvider`
- `detectWallet()` — prefer `window.midnight['1am']`, fallback to first enumerated wallet

---

## 10) `lib/party.ts`

```typescript
import { createUnprovenDeployTx, submitCallTxAsync, submitTxAsync } from '@midnight-ntwrk/midnight-js-contracts';
import { ContractState, sampleSigningKey } from '@midnight-ntwrk/compact-runtime';
import { CompiledPrivatePartyContract, Contract, ledger } from '../contract/src/index';
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

function makeCompiledContract() {
  return CompiledPrivatePartyContract as any;
}

export async function deployParty(
  session: ConnectedSession,
  partySize: number,
  entryFeeStars: number,
  organizerSecret: Uint8Array,
): Promise<string> {
  const deployTxData = await (createUnprovenDeployTx as any)(
    {
      zkConfigProvider: session.providers.zkConfigProvider,
      walletProvider: session.providers.walletProvider,
    },
    {
      compiledContract: makeCompiledContract(),
      args: [partySize, entryFeeStars, { bytes: organizerSecret }],
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

export async function rsvp(
  session: ConnectedSession,
  contractAddress: string,
  userAddress: { bytes: Uint8Array },
  attendeeSecret: Uint8Array,
) {
  await (submitCallTxAsync as any)(session.providers, {
    compiledContract: makeCompiledContract(),
    contractAddress,
    circuitId: 'rsvp',
    args: [userAddress, { bytes: attendeeSecret }],
    privateStateId: PRIVATE_STATE_ID,
  });
}

export async function startParty(
  session: ConnectedSession,
  contractAddress: string,
  organizerSecret: Uint8Array,
) {
  await (submitCallTxAsync as any)(session.providers, {
    compiledContract: makeCompiledContract(),
    contractAddress,
    circuitId: 'startParty',
    args: [{ bytes: organizerSecret }],
    privateStateId: PRIVATE_STATE_ID,
  });
}

export async function checkIn(
  session: ConnectedSession,
  contractAddress: string,
  userAddress: { bytes: Uint8Array },
  attendeeSecret: Uint8Array,
) {
  await (submitCallTxAsync as any)(session.providers, {
    compiledContract: makeCompiledContract(),
    contractAddress,
    circuitId: 'checkIn',
    args: [userAddress, { bytes: attendeeSecret }],
    privateStateId: PRIVATE_STATE_ID,
  });
}

export async function closeEntry(
  session: ConnectedSession,
  contractAddress: string,
  organizerSecret: Uint8Array,
) {
  await (submitCallTxAsync as any)(session.providers, {
    compiledContract: makeCompiledContract(),
    contractAddress,
    circuitId: 'closeEntry',
    args: [{ bytes: organizerSecret }],
    privateStateId: PRIVATE_STATE_ID,
  });
}

export async function claimFees(
  session: ConnectedSession,
  contractAddress: string,
  organizerAddress: { bytes: Uint8Array },
  organizerSecret: Uint8Array,
) {
  await (submitCallTxAsync as any)(session.providers, {
    compiledContract: makeCompiledContract(),
    contractAddress,
    circuitId: 'claimFees',
    args: [organizerAddress, { bytes: organizerSecret }],
    privateStateId: PRIVATE_STATE_ID,
  });
}

export function decodePartyState(stateHex: string) {
  const contractState = ContractState.deserialize(fromHex(stateHex));
  const l = ledger(contractState.data) as any;
  const stateIdx = Number(l.partyState);
  return {
    partyState: PARTY_STATE_NAMES[stateIdx] ?? `UNKNOWN(${stateIdx})`,
    partyStateIndex: stateIdx,
    maxListSize: Number(l.maxListSize),
    entryFee: Number(l.entryFee),
    rsvpCount: l.hashedPartyGoers?.size?.() ?? l.hashedPartyGoers?.size ?? 0,
    checkedInCount: l.checkedInParty?.size?.() ?? l.checkedInParty?.size ?? 0,
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

---

## 11) Frontend — `app/party/PartyClient.tsx`

Client component pattern (same as locker/payment dapps). Core UI states:

| Role | State | UI |
|---|---|---|
| Any | Wallet disconnected | Connect button |
| Organizer | Connected, no contract | Deploy form (max guests, entry fee in Stars) |
| Organizer | Deployed, NOT_STARTED/READY | Start party; show RSVP count |
| Organizer | STARTED | Close doors (if guests remain) |
| Organizer | DOORS_CLOSED | Claim fees |
| Attendee | Has contract address | RSVP (generates + stores secret) |
| Attendee | STARTED + prior RSVP | Check in (pays entry fee — **privacy boundary**) |
| Any | After check-in | Public guest list from `checkedInParty` on indexer |

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

  const refresh = useCallback(async () => {
    if (!session || !contractAddress) return;
    setStatus(await fetchPartyState(session.config.indexerUri, contractAddress));
  }, [session, contractAddress]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function onConnect() {
    setBusy(true);
    setError(null);
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
    try {
      let secret = loadSecret('attendee', contractAddress);
      if (!secret) {
        secret = generateSecret();
        saveSecret('attendee', contractAddress, secret);
      }
      await rsvp(session, contractAddress, userAddressFromSession(session), secret);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  // ... startParty, checkIn, closeEntry, claimFees handlers mirror lib/party.ts
  // Organizer claimFees: userAddressFromSession(session) + loadSecret('organizer', contractAddress)

  return (
    <div>
      <h1>Private Party</h1>
      <p>Attendees stay private until check-in pays unshielded NIGHT.</p>
      {!session ? (
        <button type="button" onClick={onConnect} disabled={busy}>Connect Wallet</button>
      ) : (
        <>
          <p>Connected: {session.unshieldedAddress}</p>
          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="organizer">Organizer</option>
              <option value="attendee">Attendee</option>
            </select>
          </label>
          <label>
            Contract address
            <input value={contractAddress} onChange={(e) => setContractAddress(e.target.value.trim())} />
          </label>
          {status ? (
            <p>
              State: {status.partyState} · RSVPs: {status.rsvpCount}/{status.maxListSize} ·
              Checked in: {status.checkedInCount} · Fee: {status.entryFee} Stars
            </p>
          ) : null}
          {/* Role-specific action buttons */}
        </>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
```

Add styling as needed — see full implementation in `templates/private-party-dapp/app/party/PartyClient.tsx`.

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

## 13) Local Devnet Tests (Official Repo)

The tutorial test script is **provided** in `example-private-party` — focus on writing Compact by hand, then run:

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

## 14) End-to-End Browser Flow

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

## 15) Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Organizer cannot RSVP` | Organizer secret used for RSVP | Use separate attendee secret |
| `You are not on the list` | Wrong secret or address at check-in | Same `_secret` + `UserAddress` as RSVP |
| `The party has already started` | RSVP after startParty | RSVP only in NOT_STARTED |
| `Only the organizer can start` | Wrong organizer secret | Reload from `localStorage` or redeploy |
| `Contract balance wrong` | Fee mismatch or partial check-ins | Verify `entryFee * checkedInCount` |
| `Invalid character 'm' at position 0` | Bech32 passed as bytes | Use `bech32ToUserAddress()` |
| Deploy hangs 30–120s | Used `deployContract()` | Use `createUnprovenDeployTx` + `submitTxAsync` |
| GraphQL `offset: null` | Default indexer provider | Use patched `queryContractState` |
| ZK 404 | Assets not synced | `npm run sync:assets` |
| Lost organizer secret | No recovery on-chain | Redeploy contract; store secret in localStorage |

---

## 16) Agent Checklist

When generating this dApp for a user:

- [ ] Write `private-party.compact` with all six exported circuits + helper circuits
- [ ] Compile; sync ZK assets to `public/zk/private-party/`
- [ ] Use `CompiledContract.withVacantWitnesses` (no witness TS file)
- [ ] Wire `createConnectedSession` with patched indexer
- [ ] Pass `{ bytes: secret }` and `{ bytes: address }` for circuit args
- [ ] Decode unshielded Bech32 via `wallet-sdk-address-format`
- [ ] Store organizer/attendee secrets in `localStorage` per contract address
- [ ] UI explains privacy boundary before check-in button
- [ ] Next.js `--webpack` for WASM
- [ ] Document: entry fee in Stars; check-in uses unshielded NIGHT

---

## 17) Extensions

### Shielded entry fees

To keep attendees private through payment, rework `checkIn` to use shielded tokens instead of `receiveUnshielded` — see tutorial conclusion and `token-transfers/` skill.

### Multi-party testing UI

Add "copy invite link" with contract address query param; show public `checkedInParty` addresses after boundary crossed.

### Headless CI

Port official `party.test.ts` into the template monorepo using `example-hello-world/` Docker compose pattern.

---

## 18) Related Skills

| Next step | Skill |
|---|---|
| Wallet connect only | `react-wallet-connector/` |
| Unshielded token flows | `token-transfers/` |
| Payment vault pattern | `example-payment-dapp/` |
| Privacy audit | `security/` |
| Compact language reference | `compact/` |
| Local vitest harness | `example-hello-world/` |
