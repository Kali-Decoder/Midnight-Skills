---
name: example-locker-dapp
description: >
  Build a time-lock vault dApp on Midnight Network — users lock unshielded NIGHT tokens
  in a Compact smart contract until a Unix timestamp, then the beneficiary releases them.
  Covers locker.compact (blockTimeGte unlock), Next.js frontend, 1AM wallet integration,
  low-level deploy/call, indexer polling, and ZK asset hosting. Use for token vesting,
  liquidity locks, escrow-style lockups, or any "lock until date" dApp on Midnight.
  Triggers: locker dApp, token lock, time vault, vesting schedule, lockup, release tokens,
  blockTime deadline, receiveUnshielded/sendUnshielded vault. Also use when debugging
  unlock timing, beneficiary auth, or extending the payment-dapp wallet/provider pattern.
---

# Midnight Network Locker DApp

A **locker dApp** holds unshielded NIGHT in a Compact contract until `unlockTime` (Unix seconds, `Uint<64>`). No one — including the deployer — can withdraw early. After the deadline, only the **beneficiary** (proven via witness) can call `release` and send tokens to a recipient address.

**Source of truth:** `templates/locker-dapp/` is the complete, runnable project, and this skill is the walkthrough for it. Do not retype the files from this page: copy the template, then adapt it (§19). Only the contract and witnesses are shown inline.

**Get the template:**

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/Kali-Decoder/Midnight-Skills.git
cd Midnight-Skills && git sparse-checkout set templates/locker-dapp
cp -R templates/locker-dapp ../my-locker && cd ../my-locker

npm install            # postinstall also installs contract/
npm run compact        # compact compile +0.36.1 → contract/src/managed/locker
npm run sync:assets    # copies compiler/ keys/ zkir/ to public/zk/locker
npm run dev            # http://localhost:3000, needs the 1AM wallet (Ledger 9 build)
```

Without a checkout, read any file at `https://raw.githubusercontent.com/Kali-Decoder/Midnight-Skills/main/templates/locker-dapp/<path>`.

**What the template contains** (paths relative to `templates/locker-dapp/`):
- `contract/`: Compact locker vault, TypeScript witnesses, compile script
- `app/locker/LockerClient.tsx`: Next.js client UI (connect, deploy, lock, release, status)
- `lib/midnight.ts`: wallet session and providers (the canonical Ledger 9 session from `references/midnight-session.md`)
- `lib/locker.ts`: `deployLocker`, `lockTokens`, `releaseTokens`, `fetchLockerState`
- `scripts/sync-zk-assets.mjs`: copies ZK proving assets into `public/zk/locker/`

**Shared references** (canonical provider + troubleshooting — do not duplicate in prompts):
- `references/midnight-session.md` — `createConnectedSession`, deploy/call helpers (no indexer patch on Ledger 9)
- `references/gotchas.md` — Ledger 9 errors (version mismatch, `EraMismatchError`, Blockfrost 410/403), ZK asset paths
- `references/versions.json` — pinned `@midnight-ntwrk/*` versions

**Primary references:**
- `example-payment-dapp/` — provider wiring and deploy/call in the same 1AM pattern
- `1am-wallet/` — 1AM browser extension, dust-free flow
- `compact/` — `blockTimeGte` / `blockTimeLt`, `disclose()`, ledger ADTs
- `token-transfers/` — unshielded NIGHT units (Stars), `UserAddress` recipient pattern
- `indexer/` — poll contract state after transactions

**Key architecture notes:**
- Use `blockTimeGte(unlockTime)` — never compare raw block timestamps on ledger (privacy + API design)
- Always use `Uint<64>` for Unix timestamps — `Uint<16>` cannot hold current epoch values
- Use `deployContract` / `findDeployedContract` with providers typed to the contract (no `as any`)
- Plain `indexerPublicDataProvider(network.indexer)`; the old `offset: null` patch is obsolete on indexer 4.4.101
- Token amounts are in **Stars** (1 NIGHT = 1_000_000 Stars); use `BigInt` everywhere
- Beneficiary public key bytes are stored on-chain at lock time; `beneficiaryKey` witness proves release authority

---

## Workflow

When helping the user, follow this sequence:

1. **Copy the template** (above) and run it unchanged once, so wallet, network and ZK assets are known to work
2. **Contract**: change `locker.compact` only if the user's lock rules differ (§5), then `npm run compact` and `npm run sync:assets`
3. **Providers**: keep `lib/midnight.ts` as-is (§8)
4. **Deploy**: `deployLocker` uses `deployContract`, which proves through the wallet and stores private state
5. **Lock**: `lockTokens(amount, releaseTime, beneficiaryPkBytes)` calls the `lockTokens` circuit
6. **Poll indexer**: `fetchLockerState` reads `balance`, `unlockTime`, `lockActive` from the ledger
7. **Release**: after `blockTimeGte(unlockTime)`, the beneficiary's `releaseTokens(recipient)` calls the `release` circuit
8. **UI**: show the countdown and disable Release until unlock time (UX only; the contract enforces it)

---

## 1) Project Structure

```
templates/locker-dapp/
├── package.json                    # scripts: dev, build, compact, sync:assets
├── next.config.mjs
├── tsconfig.json
├── lib/
│   ├── isomorphic-ws-fix.mjs
│   ├── midnight.ts                 # session, providers, hex helpers
│   └── locker.ts                   # deploy, lock, release, decode state
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # loads LockerClient with ssr: false
│   └── locker/
│       └── LockerClient.tsx        # all wallet + contract UI (client component)
├── contract/
│   ├── package.json                # compact script (toolchain pinned)
│   └── src/
│       ├── locker.compact
│       ├── witnesses.ts
│       ├── index.ts                # barrel → managed/locker
│       └── managed/locker/         # compiler output (gitignored)
├── scripts/
│   └── sync-zk-assets.mjs
└── public/zk/locker/               # synced compiler/ + keys/ + zkir/ (gitignored in dev, committed for deploy)
```

---

## 2) Prerequisites

```bash
node --version   # 20+ for Next.js; 22+ if adding vitest contract tests
docker --version # optional local stack

# Compact compiler
curl --proto '=https' --tlsv1.2 -sSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
source $HOME/.local/bin/env
```

Browser: **1AM wallet** extension on `preprod` (or Lace fallback).

---

## 3) Template Files

Every file below lives in `templates/locker-dapp/`. Read the file there rather than a copy in a prompt.

| File | Role | Change it when |
|---|---|---|
| `package.json` | Next.js app; scripts `dev`, `build` (runs `sync:assets` first), `compact`, `sync:assets`; `postinstall` installs `contract/` | Adding dependencies (versions from `references/versions.json`) |
| `contract/package.json` | `compact` script: `compact compile +0.36.1 src/locker.compact src/managed/locker` | Renaming the contract |
| `contract/src/locker.compact` | The vault (§5) | Lock rules change |
| `contract/src/witnesses.ts` | `beneficiaryKey` witness over `LockerPrivateState` (§6) | Private state changes |
| `contract/src/index.ts` | Barrel: exports `zkConfigPath`, `LockerContract`, `CompiledLockerContract` from `managed/locker` | Renaming the contract |
| `lib/midnight.ts` | `createConnectedSession`, `queryLatestState`, `detectWallet`, hex helpers (§8) | Almost never; only the ZK path |
| `lib/locker.ts` | Contract API (§9) | Circuits change |
| `app/locker/LockerClient.tsx` | All wallet and contract UI (§10) | UI changes |
| `app/page.tsx` | Loads the client with `dynamic(..., { ssr: false })` | Never |
| `scripts/sync-zk-assets.mjs` | Copies `contract/src/managed/locker/{compiler,keys,zkir}` to `public/zk/locker/` (§11) | Renaming the contract |
| `next.config.mjs`, `lib/isomorphic-ws-fix.mjs` | WASM and WebSocket config (§12) | Never |

---

## 4) Compile and Sync

```bash
npm run compact
# → contract/src/managed/locker/{compiler,contract,keys,zkir}/
npm run sync:assets
# → public/zk/locker/
```

---

## 5) `contract/src/locker.compact`

Single active lock per contract instance (simple vault). Deploy multiple contract addresses for parallel locks, or extend with `Map<Bytes<32>, LockRecord>` (see §18).

Source: `templates/locker-dapp/contract/src/locker.compact` (shown in full; it is the core of the skill).

```compact
pragma language_version >= 0.28.0;
import CompactStandardLibrary;

export ledger balance: Uint<128>;
export ledger unlockTime: Uint<64>;
export ledger beneficiary: Bytes<32>;
export ledger lockActive: Boolean;
export ledger totalLocked: Uint<128>;
export ledger totalReleased: Uint<128>;

witness beneficiaryKey(): Bytes<32>;

constructor() {
  balance = 0;
  unlockTime = 0;
  beneficiary = default<Bytes<32>>;
  lockActive = false;
  totalLocked = 0;
  totalReleased = 0;
}

export circuit lockTokens(
  amount: Uint<128>,
  releaseTime: Uint<64>,
  beneficiaryPk: Bytes<32>
): [] {
  assert(!disclose(lockActive), "Vault already has an active lock");
  assert(disclose(amount) > 0, "Amount must be positive");
  receiveUnshielded(default<Bytes<32>>, disclose(amount));
  beneficiary = disclose(beneficiaryPk);
  unlockTime = disclose(releaseTime);
  balance = disclose(amount);
  lockActive = disclose(true);
  totalLocked = disclose((totalLocked + amount) as Uint<128>);
}

export circuit release(recipient: UserAddress): [] {
  assert(disclose(lockActive), "No active lock");
  assert(blockTimeGte(disclose(unlockTime)), "Lock period not finished");
  assert(deriveKey(beneficiaryKey()) == beneficiary, "Only beneficiary can release");
  const amount = disclose(balance);
  assert(amount > 0, "Nothing to release");
  sendUnshielded(
    default<Bytes<32>>,
    amount,
    right<ContractAddress, UserAddress>(disclose(recipient))
  );
  totalReleased = disclose((totalReleased + amount) as Uint<128>);
  balance = 0;
  lockActive = false;
}

pure circuit deriveKey(sk: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([pad(32, "locker:beneficiary:v1"), sk]);
}
```

**Time API:** `blockTimeGte(t)` returns true when `block_time >= t`. Use `Uint<64>` Unix seconds. Do not store raw `block_time` on ledger.

---

## 6) `contract/src/witnesses.ts`

```typescript
import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger } from './managed/locker/contract/index.js';

export type LockerPrivateState = {
  beneficiarySecretKey: Uint8Array;
};

// compact-runtime 0.21: WitnessContext<Ledger, PrivateState>; witnesses return a mutable [state, value] tuple.
export const witnesses = {
  beneficiaryKey: ({ privateState }: WitnessContext<Ledger, LockerPrivateState>): [LockerPrivateState, Uint8Array] => [
    privateState,
    privateState.beneficiarySecretKey,
  ],
};
```

The beneficiary's Zswap secret seed (32 bytes) must live in private state. When locking **for yourself**, initialize private state with your shielded coin secret. When locking **for someone else**, they must deploy their own locker or use a multi-party flow — the witness must match the on-chain `beneficiary` field at release.

---

## 7) `contract/src/index.ts`

A barrel over the compiler output in `managed/locker`. It exports `zkConfigPath`, the `LockerContract` type and `CompiledLockerContract`, which `lib/locker.ts` passes to `deployContract` and `findDeployedContract`. See `templates/locker-dapp/contract/src/index.ts`.

---

## 8) Provider Setup

Use `templates/locker-dapp/lib/midnight.ts` as-is. It is the canonical Ledger 9 session from `references/midnight-session.md`:
- `ConnectedSession` type (`api`, `network`, typed `providers`, `unshieldedAddress`, `coinPublicKeyBytes`)
- `createConnectedSession(api, '/zk/locker')`: `dappConnectorNetwork` + `dappConnectorProofProvider` + `dappConnectorWalletProviders`, `levelPrivateStateProvider`, `providers.config`
- `queryLatestState()`: decodes `queryContractState` with `deserialize({ v9: ContractState })`
- `detectWallet()`

Nothing to change except the ZK path.

Wallet detection (1AM first, Lace fallback):

```typescript
const wallet =
  (window as any).midnight?.['1am'] ??
  Object.values((window as any).midnight ?? {})[0];
```

Prefer enumerating `Object.values(window.midnight)` over hardcoded Lace keys — see `react-wallet-connector/`.

---

## 9) `lib/locker.ts`

The contract API used by the UI. Source: `templates/locker-dapp/lib/locker.ts`.

| Function | What it does |
|---|---|
| `deployLocker(session, beneficiarySecretKey)` | `deployContract` with `CompiledLockerContract` and the beneficiary secret as initial private state. Returns the contract address |
| `lockTokens(session, address, amount, releaseTimeUnix, beneficiaryPkBytes)` | `findDeployedContract`, then `callTx.lockTokens(...)` |
| `releaseTokens(session, address, recipientBytes)` | `callTx.release({ bytes: recipientBytes })`. Pass the recipient as `{ bytes: Uint8Array }`, not an encoded address string |
| `fetchLockerState(session, address)` | `queryLatestState` plus `ledger(...)` decode: `balance`, `unlockTime`, `lockActive`, `beneficiary` |

`deployContract` waits for indexing. For a non-blocking deploy see `1am-wallet/` §8.

---

## 10) Frontend — `app/locker/LockerClient.tsx`

Client component pattern (same as payment dapp). Core UI states:

| State | UI |
|---|---|
| Wallet disconnected | Connect button |
| Connected, no contract | Deploy locker |
| Deployed, no lock | Lock form (amount, unlock datetime, beneficiary = self) |
| Active lock, before unlock | Show balance, unlock date, countdown, disabled Release |
| Active lock, after unlock | Enabled Release → recipient = own unshielded address bytes |
| Released | Show totals, offer new lock (deploy new contract or extend contract) |

The component (`templates/locker-dapp/app/locker/LockerClient.tsx`) implements these states with intentionally plain markup, like `react-wallet-connector/`. Add styling as needed.

---

## 11) ZK Asset Sync — `scripts/sync-zk-assets.mjs`

Copies `contract/src/managed/locker/{compiler,keys,zkir}` into `public/zk/locker/`, which `createConnectedSession(api, '/zk/locker')` fetches at proving time. The `compiler/` folder is required: without it proving fails with `EraMismatchError: artifact-era-undeclared`. Run it after every compile (`npm run build` runs it automatically).

Verify before debugging SDK errors:
`http://localhost:3000/zk/locker/keys/lockTokens.prover` must return 200.

---

## 12) Next.js Config

Same as `example-payment-dapp/SKILL.md` § Next.js:
- `lib/isomorphic-ws-fix.mjs` WebSocket shim
- `next.config.mjs` with `asyncWebAssembly`, `topLevelAwait`, `isomorphic-ws` alias
- Next 15 builds with webpack by default (`next dev`, `next build`); `--webpack` exists only in Next 16. `app/page.tsx` loads the client with `dynamic(..., { ssr: false })` so `next build` never prerenders wallet/SDK code

---

## 13) End-to-End Flow

```
1. npm install && npm run compact && npm run sync:assets
2. npm run dev
3. Connect 1AM wallet (preprod, funded with tNIGHT)
4. Deploy locker contract
5. Lock 1 NIGHT until chosen datetime
6. UI shows locked balance + unlock time (poll indexer every 2s after tx)
7. Wait until unlock (or advance clock on local undeployed only)
8. Beneficiary clicks Release → tokens sent to unshielded address
```

---

## 14) Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Lock period not finished` | `blockTimeGte` false | Wait until on-chain time ≥ `unlockTime`; check wallet network |
| `Only beneficiary can release` | Witness key ≠ ledger `beneficiary` | Private state `beneficiarySecretKey` must derive same pk stored at lock |
| `Vault already has an active lock` | Single-lock contract | Release first, or deploy another contract instance |
| `Uint<16>` compile error on timestamp | Wrong integer width | Use `Uint<64>` for all Unix times |
| `Version mismatch: compiled code expects 0.21.0, runtime is 0.16.0` | Old runtime | `compact-runtime@0.21.0` + `compact compile +0.36.1` |
| `EraMismatchError: artifact-era-undeclared` | `public/zk/...` lacks `compiler/` | Re-run `npm run sync:assets` |
| Indexer 410 `ENDPOINT_DECOMMISSIONED` | Hardcoded old preprod host | Endpoints come from the wallet (`dappConnectorNetwork`) |
| ZK 404 | Assets not synced | `npm run sync:assets` |
| `Invalid character 'm' at position 0` | Wrong address encoding for recipient | Pass `{ bytes: Uint8Array }` to circuits, not `encodeUserAddress(coinPk)` |
| Release button works before time in UI | UI-only check | Contract still rejects — fix UX but trust on-chain `blockTimeGte` |

---

## 15) Agent Checklist

When generating this dApp for a user:

- [ ] Start from `templates/locker-dapp/`; do not retype it
- [ ] Change `locker.compact` only as needed; keep `lockTokens` + `release` + `blockTimeGte`
- [ ] `npm run compact`, then `npm run sync:assets` to `public/zk/locker/`
- [ ] Keep `createConnectedSession` with the plain `indexerPublicDataProvider` (no indexer patch on Ledger 9)
- [ ] Use `deployContract` / `findDeployedContract` and `callTx.*` for lock and release
- [ ] Store `beneficiarySecretKey` in private state; pass `coinPublicKeyBytes` at lock
- [ ] Decode ledger with `ledger(contractState.data)`, not raw `ContractState`
- [ ] Use `BigInt` for amounts and Unix timestamps
- [ ] `asyncWebAssembly` + `topLevelAwait` in `next.config.mjs`; client loaded with `ssr: false`
- [ ] Document: 1 NIGHT = 1_000_000 Stars

---

## 16) Use Case Mapping

| Use case | How this template maps |
|---|---|
| **Fixed deposit** | User locks until `unlockTime`, releases to self |
| **Token vesting** | Deploy one locker per tranche, or extend with `Map` of schedules (§18) |
| **Liquidity lock** | Lock LP amount until `releaseTime`; publish contract address for verification |
| **Escrow** | Set beneficiary to counterparty pk; release after deadline when conditions met off-chain |
| **NFT lock** | Not covered here — use `nft/` skill + custom `receive`/`send` pattern for shielded assets |

---

## 17) Reading Lock Status (Indexer)

```typescript
// After lockTokens tx — poll until balance > 0
const state = await fetchLockerState(indexerUrl, contractAddress);
console.log({
  locked: state.lockActive,
  amount: state.balance,
  unlockAt: new Date(Number(state.unlockTime) * 1000).toISOString(),
});
```

---

## 18) Extensions

### Multi-lock (`Map`)

Replace single `lockActive` cell with:

```compact
struct LockRecord {
  amount: Uint<128>,
  unlockTime: Uint<64>,
  beneficiary: Bytes<32>,
  active: Boolean,
}

export ledger locks: Map<Bytes<32>, LockRecord>;
export ledger nextLockId: Counter;
```

Add `lockId` parameter to `release`; increment counter on each `lockTokens`.

### Linear vesting

Deploy multiple locker contracts with staggered `unlockTime` values, or add a `vesting.compact` with `List<VestTranche>` and separate `claimTranche(index)` circuit using `blockTimeGte(tranche.unlockTime)`.

### React-only wallet shell

If the user only needs connect UI first, scaffold with `react-wallet-connector/` then add provider wiring from `references/midnight-session.md`.

---

## 19) Adapting This Template

1. **Copy, run, then change.** Copy `templates/locker-dapp/` and get the unchanged template working first.
2. **Contract.** Edit `contract/src/locker.compact`. If you rename it, update the `compact` script in `contract/package.json`, the `managed/<name>` paths in `contract/src/index.ts`, the folder in `scripts/sync-zk-assets.mjs`, and the ZK path passed to `createConnectedSession` (`'/zk/<name>'`).
3. **Private state.** If witnesses change, update `LockerPrivateState` and `witnesses` in `contract/src/witnesses.ts`, and the initial private state in `deployLocker`.
4. **Circuits.** For each new or renamed circuit, add or rename the wrapper in `lib/locker.ts` (`callTx.<circuit>(...)`), and extend `fetchLockerState` for new ledger fields.
5. **UI.** Map the new states into `app/locker/LockerClient.tsx` (§10 table).
6. **Private-state password.** `demoStoragePassword` in `lib/midnight.ts` generates the private-state encryption password and keeps it in `localStorage` under a fixed key. That is fine for a demo. For production, get the password from the user or derive it from a wallet signature.
7. **Recompile and resync** (`npm run compact && npm run sync:assets`) after every contract change, then check `http://localhost:3000/zk/<name>/keys/<circuit>.prover` returns 200.
8. **Versions.** Add dependencies only at the versions in `references/versions.json`.

For multiple locks or vesting, see §18 before changing the contract.

---

## 20) Troubleshooting

See `references/gotchas.md` for the full table. Common locker-specific issues:

| Symptom | Fix |
|---------|-----|
| `unlockTime` overflow | Use `Uint<64>` for Unix seconds, not `Uint<16>` |
| Release before deadline | `blockTimeGte(unlockTime)` must pass — check indexer block time |
| Wrong beneficiary on release | Witness `beneficiaryKey` must match bytes stored at lock time |
| Deploy feels slow | `deployContract` waits for indexing; see `1am-wallet/` §8 for the non-blocking variant |

---

## 21) Related Skills

| Next step | Skill |
|---|---|
| Wallet connect only | `react-wallet-connector/` |
| Payment vault (no timelock) | `example-payment-dapp/` |
| Full CLI + tests reference | `example-counter/` |
| NFT locking | `nft/` |
| Privacy audit | `security/` |
