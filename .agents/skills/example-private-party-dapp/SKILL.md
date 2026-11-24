---
name: example-private-party-dapp
author: tusharpamnani
description: >
  Build a private party RSVP dApp on Midnight Network — attendees stay private until
  unshielded NIGHT check-in crosses the privacy boundary. Covers private-party.compact
  (no witnesses, persistentCommit, DApp-specific public keys, receiveUnshielded/sendUnshielded),
  Next.js frontend, 1AM wallet integration, deployContract/callTx, indexer polling, and
  optional vitest local devnet tests. Use for teaching privacy boundaries, commitment-based
  guest lists, organizer access control, or unshielded entry fees. Triggers: private party,
  RSVP dApp, privacy boundary, persistentCommit, getDappPublicKey, unshielded check-in,
  example-private-party, party organizer, guest list commitment. Also use when extending
  locker-dapp or payment-dapp wallet/provider patterns to privacy-preserving social flows.
---

# Midnight Network Private Party DApp

A **private party contract** lets an organizer collect RSVPs while attendee identities stay private until guests **check in** and pay the entry fee in **unshielded NIGHT**. That payment is the **privacy boundary** — unshielded token flows are always public on Midnight.

**Source of truth:** `templates/private-party-dapp/` is the complete, runnable project, and this skill is the walkthrough for it. Do not retype the files from this page: copy the template, then adapt it (§18). The contract is shown in full because it is the lesson; everything else is described here and read from the template.

**Get the template:**

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/Kali-Decoder/Midnight-Skills.git
cd Midnight-Skills && git sparse-checkout set templates/private-party-dapp
cp -R templates/private-party-dapp ../my-party && cd ../my-party

npm install            # postinstall also installs contract/
npm run compact        # compact compile +0.36.1 → contract/src/managed/private-party
npm run sync:assets    # copies compiler/ keys/ zkir/ to public/zk/private-party
npm run dev            # http://localhost:3000, needs the 1AM wallet (Ledger 9 build) on preprod
```

Without a checkout, read any file at `https://raw.githubusercontent.com/Kali-Decoder/Midnight-Skills/main/templates/private-party-dapp/<path>`.

**Official reference:** `github.com/midnightntwrk/example-private-party` — Compact tutorial + vitest harness (`yarn test:local` on Docker devnet).

**Two ways to use this skill:**
- **Scaffold mode (default)**: the user wants a working dApp. Copy the template; it is the tested reference implementation. Don't rederive it.
- **Tutorial mode**: the user explicitly wants to learn Compact by writing it themselves. Walk through `private-party.compact` circuit by circuit (§5) and let them type it, but still take the TypeScript and UI from the template.

**What the template contains** (paths relative to `templates/private-party-dapp/`):
- `contract/`: `private-party.compact` (no witnesses), barrel, compile script
- `app/party/PartyClient.tsx`: Next.js client UI (organizer deploy/start/close/claim, attendee RSVP/check-in)
- `lib/midnight.ts`: wallet session and providers (canonical Ledger 9 session from `references/midnight-session.md`)
- `lib/party.ts`: `deployParty`, `rsvp`, `startParty`, `checkIn`, `closeEntry`, `claimFees`, `fetchPartyState`
- `lib/address.ts`: Bech32m unshielded address → `{ bytes: Uint8Array }` for `UserAddress` circuit args
- `lib/secret.ts`: generate and store 32-byte DApp secrets in `localStorage`
- `scripts/sync-zk-assets.mjs`: copies ZK proving assets into `public/zk/private-party/`

**Shared references** (canonical provider + troubleshooting — do not duplicate in prompts):
- `references/gotchas.md` — Ledger 9 errors (version mismatch, `EraMismatchError`, Blockfrost 410/403), ZK asset paths
- `references/versions.json` — pinned `@midnight-ntwrk/*` versions

**Primary references:**
- `example-locker-dapp/` / `templates/locker-dapp/` — same Next.js + 1AM structure
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
- **Network:** the network comes from the wallet (`dappConnectorNetwork`). The UI connects with `wallet.connect('preprod')` in `app/party/PartyClient.tsx`; change that one call to target `preview`, and set the wallet to the same network.

---

## Workflow

When helping the user, follow this sequence:

1. **Copy the template** and run it unchanged once (wallet, network and ZK assets known good)
2. **Contract**: read or adapt `private-party.compact` (§5); `npm run compact`, then `npm run sync:assets`
3. **Understand the privacy boundary**: private RSVP → public check-in (unshielded) → public payout
4. **Providers**: keep `lib/midnight.ts` as-is (§9)
5. **Deploy**: organizer calls `deployParty(session, partySize, entryFeeStars, organizerSecret)`
6. **RSVP**: attendees call `rsvp` before the party starts
7. **Start**: organizer calls `startParty` (or the contract moves to `READY` when the list is full)
8. **Check in**: RSVP'd guests call `checkIn` and pay the entry fee (crosses the boundary)
9. **Close**: organizer calls `closeEntry` if not everyone checked in (automatic when full)
10. **Claim**: organizer calls `claimFees` after doors close
11. **UI**: role picker, party status panel, indexer polling for public state

---

## 1) Project Structure

```
templates/private-party-dapp/
├── package.json                    # scripts: dev, build, compact, sync:assets
├── next.config.mjs                 # Node fallbacks, isomorphic-ws alias, WASM (§13)
├── tsconfig.json
├── lib/
│   ├── isomorphic-ws-fix.mjs
│   ├── midnight.ts                 # session, providers, hex helpers
│   ├── party.ts                    # deploy, circuits, decode state
│   ├── address.ts                  # Bech32m → UserAddress bytes
│   └── secret.ts                   # per-contract secrets in localStorage
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # loads PartyClient with ssr: false
│   └── party/
│       └── PartyClient.tsx         # all wallet + contract UI (inline styles)
├── contract/
│   ├── package.json                # compact script (toolchain pinned)
│   └── src/
│       ├── private-party.compact
│       ├── index.ts                # barrel → managed/private-party
│       └── managed/private-party/  # compiler output (gitignored)
├── scripts/
│   └── sync-zk-assets.mjs
└── public/zk/private-party/        # synced compiler/ + keys/ + zkir/
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

Browser: **1AM wallet** on the network `PartyClient.tsx` connects to (preprod by default), funded with tNIGHT for entry fees.

---

## 3) Template Files

Every file below lives in `templates/private-party-dapp/`.

| File | Role | Change it when |
|---|---|---|
| `package.json` | Next.js app; `dev`, `build` (runs `sync:assets` first), `compact`, `sync:assets`; `postinstall` installs `contract/` | Adding dependencies (versions from `references/versions.json`) |
| `contract/package.json` | `compact` script: `compact compile +0.36.1 src/private-party.compact src/managed/private-party` | Renaming the contract |
| `contract/src/private-party.compact` | The contract (§5) | Party rules change |
| `contract/src/index.ts` | `CompiledPrivatePartyContract` (§6) | Renaming the contract, adding witnesses |
| `lib/midnight.ts` | `createConnectedSession`, `queryLatestState`, `detectWallet`, hex helpers (§9) | Almost never |
| `lib/party.ts` | Contract API and state decode (§10) | Circuits or ledger fields change |
| `lib/address.ts` | `bech32ToUserAddress` (§7) | Never |
| `lib/secret.ts` | `generateSecret`, `saveSecret`, `loadSecret` (§8) | Changing where secrets live |
| `app/party/PartyClient.tsx` | All UI (§11) | UI changes, target network |
| `scripts/sync-zk-assets.mjs` | ZK asset copy (§12) | Renaming the contract |
| `next.config.mjs` | Webpack config (§13) | Never |

---

## 4) Compile and Sync

```bash
npm run compact
# → contract/src/managed/private-party/{compiler,contract,keys,zkir}/
npm run sync:assets
# → public/zk/private-party/
```

Expected circuits: `rsvp`, `startParty`, `checkIn`, `closeEntry`, `claimFees`.

---

## 5) `contract/src/private-party.compact`

Source: `templates/private-party-dapp/contract/src/private-party.compact`. In scaffold mode use it unchanged. In tutorial mode, build it up circuit by circuit in this order: ledger declarations → constructor → `rsvp` → `startParty` → `checkIn` → `closeEntry` → `claimFees` → helper circuits.

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

The contract has no witnesses, so the barrel builds the compiled contract with vacant witnesses and points its assets at the browser ZK path:

```ts
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { Contract } from './managed/private-party/contract/index.js';

export const zkConfigPath = '/zk/private-party';
export type PartyPrivateState = Record<string, never>;
export type PrivatePartyContract = Contract<PartyPrivateState>;

export const CompiledPrivatePartyContract = CompiledContract.make<PrivatePartyContract>('private-party', Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);
```

Import `CompiledContract` from `@midnight-ntwrk/compact-js`, not `compact-runtime`. The barrel also re-exports `Contract`, `ledger`, `pureCircuits` and `Ledger` from the compiler output.

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

`generateSecret()` returns 32 random bytes from `crypto.getRandomValues`. `saveSecret(role, contractAddress, secret)` and `loadSecret(role, contractAddress)` keep it in `localStorage` under `private-party:<role>:<contractAddress>`. Losing it means losing that role's authority over the contract; there is no on-chain recovery.

---

## 9) `lib/midnight.ts`

The canonical Ledger 9 browser session from `references/midnight-session.md`, identical across templates. Use it as-is:
- `createConnectedSession(api, '/zk/private-party')` reads network and endpoints from the wallet (`dappConnectorNetwork`), builds the proof provider through the wallet, `levelPrivateStateProvider`, the plain `indexerPublicDataProvider`, and `providers.config`
- `queryLatestState` decodes `queryContractState` with `deserialize({ v9: ContractState })`
- `detectWallet()` prefers 1AM, then any other injected Midnight wallet
- `demoStoragePassword` keeps the private-state password in `localStorage`; replace it for production (§18)

---

## 10) `lib/party.ts`

Uses `deployContract` / `findDeployedContract` with providers typed to the contract. Source: `templates/private-party-dapp/lib/party.ts`.

| Function | Circuit / effect |
|---|---|
| `deployParty(session, partySize, entryFeeStars, organizerSecret)` | Constructor args `[BigInt(partySize), BigInt(entryFeeStars), organizerSecret]`; returns the contract address |
| `rsvp(session, address, userAddress, attendeeSecret)` | `callTx.rsvp` |
| `startParty(session, address, organizerSecret)` | `callTx.startParty` |
| `checkIn(session, address, userAddress, attendeeSecret)` | `callTx.checkIn` (pays the entry fee, address becomes public) |
| `closeEntry(session, address, organizerSecret)` | `callTx.closeEntry` |
| `claimFees(session, address, organizerAddress, organizerSecret)` | `callTx.claimFees` |
| `fetchPartyState` / `decodePartyState` | `partyState` name, `maxListSize`, `entryFee`, `rsvpCount`, `checkedInCount` |
| `userAddressFromSession(session)` | The connected wallet's `UserAddress` |

**Key details:**
- `Uint<16>` args take `BigInt(...)`, not plain numbers.
- `Bytes<32>` args (secrets) are raw `Uint8Array`, **not** wrapped in `{ bytes }`. `UserAddress` args require the `{ bytes }` wrapper.
- `setSize()` reads compiled `Set` ledger fields whether `.size` is a property or a method.

---

## 11) Frontend — `app/party/PartyClient.tsx`

One client component with a role picker (organizer or attendee), a party status panel, and a handler per circuit (`onDeploy`, `onRsvp`, `onStartParty`, `onCheckIn`, `onCloseEntry`, `onClaimFees`). It connects with `wallet.connect('preprod')`, stores secrets per contract address through `lib/secret.ts`, polls `fetchPartyState`, and explains the privacy boundary next to the check-in button. Styling is inline, with no CSS framework.

---

## 12) ZK Asset Sync — `scripts/sync-zk-assets.mjs`

Copies `contract/src/managed/private-party/{compiler,keys,zkir}` into `public/zk/private-party/`. Without `compiler/`, proving fails with `EraMismatchError: artifact-era-undeclared`. `npm run build` runs it automatically.

Verify: `http://localhost:3000/zk/private-party/keys/rsvp.prover` returns 200.

---

## 13) `next.config.mjs`

Required. On the client build it sets webpack fallbacks `fs`, `net`, `tls`, `child_process` to `false`, aliases `isomorphic-ws` to `lib/isomorphic-ws-fix.mjs`, and enables `asyncWebAssembly` and `topLevelAwait`.

---

## 14) Local Devnet Tests (Official Repo)

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

## 15) End-to-End Browser Flow

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

## 16) Troubleshooting

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
| `CompiledContract.withVacantWitnesses` TypeScript error | `compact-runtime` vs `compact-js` mismatch | Import `CompiledContract` from `@midnight-ntwrk/compact-js` (§6) |
| `ContractMaintenanceAuthority` WASM identity error | Two different `compact-runtime` copies loaded | Check `npm ls @midnight-ntwrk/compact-runtime`; root and `contract/` must resolve the same version |
| `bigint` type mismatch on constructor args | Passed `number` where `bigint` expected | Wrap in `BigInt(value)` for `Uint<16>` fields |
| `Bytes<32>` wrapped in `{ bytes: ... }` mismatch | Confusing it with `UserAddress` | Raw `Uint8Array` for `Bytes<32>`; `{ bytes }` only for `UserAddress` |
| `isomorphic-ws` not found in webpack | Missing alias | `next.config.mjs` alias (§13) |
| `size()` not a function on Set ledger fields | `.size` is a property in some SDK versions, method in others | `setSize()` helper handles both (§10) |
| Wallet rejects connection / wrong chain | App and wallet on different networks | `wallet.connect(...)` in `PartyClient.tsx` and the wallet setting must match |

---

## 17) Agent Checklist

- [ ] Start from `templates/private-party-dapp/`; do not retype it
- [ ] Keep `private-party.compact`'s five exported circuits unless the user's rules differ (§5)
- [ ] `npm run compact`, then `npm run sync:assets` to `public/zk/private-party/`
- [ ] `CompiledContract.withVacantWitnesses` from `@midnight-ntwrk/compact-js`, not `compact-runtime`
- [ ] Keep `lib/midnight.ts` and `next.config.mjs` as shipped
- [ ] Constructor args: `[BigInt(partySize), BigInt(entryFeeStars), rawUint8Array]`
- [ ] Decode unshielded Bech32m via `wallet-sdk-address-format`
- [ ] Store organizer/attendee secrets in `localStorage` per contract address
- [ ] UI explains the privacy boundary before the check-in button
- [ ] Confirm the `wallet.connect(...)` network in `PartyClient.tsx` matches the target network before demoing

---

## 18) Adapting This Template

1. **Copy, run, then change.** Copy `templates/private-party-dapp/` and get the unchanged template working first.
2. **Contract.** Edit `contract/src/private-party.compact`. If you rename it, update the `compact` script in `contract/package.json`, the `managed/<name>` imports and `zkConfigPath` in `contract/src/index.ts`, `ZK_PATH` in `lib/party.ts`, and the folder in `scripts/sync-zk-assets.mjs`.
3. **Witnesses.** The template has none (`withVacantWitnesses`). If you add some, replace that with `CompiledContract.withWitnesses(...)`, give `PartyPrivateState` real fields, and pass a real `initialPrivateState` in `lib/party.ts`.
4. **Circuits and state.** Add or rename wrappers in `lib/party.ts` (`callTx.<circuit>(...)`). Keep `PARTY_STATE_NAMES` in the same order as the contract's enum, and extend `decodePartyState` for new ledger fields.
5. **Argument shapes.** Follow the generated `.d.ts`: `Uint<n>` → `bigint`, `Bytes<32>` → raw `Uint8Array`, `UserAddress` → `{ bytes }` via `bech32ToUserAddress`.
6. **UI.** Add a handler per new circuit in `PartyClient.tsx`, and change `wallet.connect('preprod')` if you target another network.
7. **Secrets and private state.** `lib/secret.ts` keeps role secrets in `localStorage`, and `demoStoragePassword` in `lib/midnight.ts` does the same for the private-state password. Both are demo-grade; for production, back them up or derive them from wallet-held material.
8. **Recompile and resync** after every contract change (`npm run compact && npm run sync:assets`).
9. **Versions.** Add dependencies only at the versions in `references/versions.json`.

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