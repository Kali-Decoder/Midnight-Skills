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

**Runnable template:** Copy `templates/locker-dapp/` for a complete Next.js project (contract + UI). Run `npm install && npm run compact && npm run dev` after installing the [1AM wallet](https://1am.dev).

**What this skill produces:**
- `contract/` — Compact locker vault + TypeScript witnesses + compile scripts
- `app/locker/` — Next.js client UI (connect, deploy, lock, release, status)
- `lib/midnight.ts` — wallet session + patched indexer provider (**copy from** `references/midnight-session.md` or `templates/locker-dapp/lib/midnight.ts`)
- `lib/locker.ts` — deploy, `lockTokens`, `release`, ledger decode
- `public/zk/locker/` — ZK proving assets synced from contract build

**Shared references** (canonical provider + troubleshooting — do not duplicate in prompts):
- `references/midnight-session.md` — `createConnectedSession`, indexer patch, deploy/call helpers
- `references/gotchas.md` — Ledger 9 errors (version mismatch, `EraMismatchError`, Blockfrost 410/403), ZK asset paths
- `references/versions.json` — pinned `@midnight-ntwrk/*` versions

**Primary references:**
- `example-payment-dapp/` — provider wiring, low-level deploy/call, indexer patch
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

1. **Contract** — `locker.compact` compile + witnesses
2. **Providers** — `createConnectedSession` (from `references/midnight-session.md`)
3. **Deploy** — low-level deploy, persist private state + contract address
4. **Lock** — `lockTokens(amount, releaseTime, beneficiaryPkBytes)`
5. **Poll indexer** — read `balance`, `unlockTime`, `lockActive` from ledger
6. **Release** — after `blockTimeGte(unlockTime)`, beneficiary calls `release(recipient)`
7. **UI** — show countdown, disable release until unlock time (UX only — contract enforces)

---

## 1) Project Structure

```
locker-dapp/
├── package.json
├── next.config.mjs
├── lib/
│   ├── isomorphic-ws-fix.mjs
│   ├── midnight.ts                 # session, patched provider, hex helpers
│   └── locker.ts                   # deploy, lock, release, decode state
├── app/
│   ├── layout.tsx
│   └── locker/
│       └── LockerClient.tsx        # all wallet + contract UI (client component)
├── contract/
│   ├── package.json
│   ├── src/
│   │   ├── locker.compact
│   │   ├── witnesses.ts
│   │   ├── index.ts                # barrel → managed/locker
│   │   └── managed/locker/         # compiler output (gitignored)
│   └── tsconfig.json
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

## 3) Root `package.json`

```json
{
  "name": "locker-dapp-template",
  "version": "0.1.0",
  "private": true,
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
  "name": "@locker/contract",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "compact": "compact compile +0.36.1 src/locker.compact src/managed/locker"
  },
  "dependencies": {
    "@midnight-ntwrk/compact-js": "3.0.2",
    "@midnight-ntwrk/compact-runtime": "0.21.0"
  }
}
```

Compile:

```bash
npm run compact
# → contract/src/managed/locker/{compiler,contract,keys,zkir}/
npm run sync:assets
# → public/zk/locker/
```

---

## 5) `contract/src/locker.compact`

Single active lock per contract instance (simple vault). Deploy multiple contract addresses for parallel locks, or extend with `Map<Bytes<32>, LockRecord>` (see §18).

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

```typescript
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { witnesses, type LockerPrivateState } from './witnesses';

export {
  Contract,
  ledger,
  pureCircuits,
  type Ledger,
} from './managed/locker/contract/index.js';
import { Contract } from './managed/locker/contract/index.js';

// Browser bundle: no node:path / node:url. Midnight.js loads keys + ZKIR through the session's
// FetchZkConfigProvider (served from /zk/locker), so this path is only a label for compact-js.
export const zkConfigPath = '/zk/locker';

export type LockerContract = Contract<LockerPrivateState>;
export type { LockerPrivateState };

export const CompiledLockerContract = CompiledContract.make<LockerContract>('locker', Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);
```

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

```typescript
import { deployContract, findDeployedContract } from '@midnightntwrk/midnight-js-contracts';
import type { ProvableCircuitId } from '@midnight-ntwrk/compact-js';
import type { MidnightProviders } from '@midnightntwrk/midnight-js-types';
import { CompiledLockerContract, ledger, type LockerContract, type LockerPrivateState } from '../contract/src/index';
import type { ConnectedSession } from './midnight';
import { queryLatestState } from './midnight';

const PRIVATE_STATE_ID = 'LockerPrivateState';
const ZK_PATH = '/zk/locker';

// The session's providers are contract-agnostic; narrow them to this contract's circuits + private state.
type LockerProviders = MidnightProviders<ProvableCircuitId<LockerContract>, typeof PRIVATE_STATE_ID, LockerPrivateState>;
const providersFor = (session: ConnectedSession) => session.providers as unknown as LockerProviders;

export async function deployLocker(session: ConnectedSession, beneficiarySecretKey: Uint8Array): Promise<string> {
  // deployContract builds, proves (via the wallet), balances, submits, and stores the private state + signing key.
  const deployed = await deployContract(providersFor(session), {
    compiledContract: CompiledLockerContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: { beneficiarySecretKey },
  });
  return deployed.deployTxData.public.contractAddress;
}

async function connect(session: ConnectedSession, contractAddress: string) {
  return findDeployedContract(providersFor(session), {
    compiledContract: CompiledLockerContract,
    contractAddress,
    privateStateId: PRIVATE_STATE_ID,
  });
}

export async function lockTokens(
  session: ConnectedSession,
  contractAddress: string,
  amount: bigint,
  releaseTimeUnix: bigint,
  beneficiaryPkBytes: Uint8Array,
) {
  const locker = await connect(session, contractAddress);
  // beneficiaryPk is Bytes<32> (a plain Uint8Array); release() takes a UserAddress ({ bytes }).
  await locker.callTx.lockTokens(amount, releaseTimeUnix, beneficiaryPkBytes);
}

export async function releaseTokens(session: ConnectedSession, contractAddress: string, recipientBytes: Uint8Array) {
  const locker = await connect(session, contractAddress);
  await locker.callTx.release({ bytes: recipientBytes });
}

export async function fetchLockerState(session: ConnectedSession, contractAddress: string) {
  const state = await queryLatestState(session, contractAddress);
  if (!state) return null;
  const l = ledger(state.data);
  return { balance: l.balance, unlockTime: l.unlockTime, lockActive: l.lockActive };
}

export { ZK_PATH };
```

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

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  deployLocker,
  fetchLockerState,
  lockTokens,
  releaseTokens,
  ZK_PATH,
} from '@/lib/locker';
import { createConnectedSession, detectWallet, type ConnectedSession } from '@/lib/midnight';

const STARS_PER_NIGHT = 1_000_000n;

export default function LockerClient() {
  const [session, setSession] = useState<ConnectedSession | null>(null);
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [ledger, setLedger] = useState<{
    balance: bigint;
    unlockTime: bigint;
    lockActive: boolean;
  } | null>(null);
  const [amountNight, setAmountNight] = useState('1');
  const [unlockAt, setUnlockAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nowUnix = BigInt(Math.floor(Date.now() / 1000));
  const canRelease = Boolean(ledger?.lockActive && ledger.unlockTime <= nowUnix);

  const refresh = useCallback(async () => {
    if (!session || !contractAddress) return;
    setLedger(await fetchLockerState(session, contractAddress));
  }, [session, contractAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
      const addr = await deployLocker(session, session.coinPublicKeyBytes);
      setContractAddress(addr);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onLock() {
    if (!session || !contractAddress) return;
    setBusy(true);
    setError(null);
    try {
      const amount = BigInt(amountNight) * STARS_PER_NIGHT;
      const releaseTime = BigInt(Math.floor(new Date(unlockAt).getTime() / 1000));
      await lockTokens(
        session,
        contractAddress,
        amount,
        releaseTime,
        session.coinPublicKeyBytes,
      );
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onRelease() {
    if (!session || !contractAddress) return;
    setBusy(true);
    setError(null);
    try {
      const recipient = session.coinPublicKeyBytes;
      await releaseTokens(session, contractAddress, recipient);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ fontFamily: 'monospace', padding: '1.5rem', maxWidth: 640 }}>
      <h1>Token Locker</h1>
      {!session ? (
        <button type="button" onClick={() => void onConnect()} disabled={busy}>
          Connect 1AM Wallet
        </button>
      ) : (
        <>
          <p>Connected: {session.unshieldedAddress}</p>
          {!contractAddress ? (
            <button type="button" onClick={() => void onDeploy()} disabled={busy}>
              Deploy Locker
            </button>
          ) : (
            <>
              <p>Contract: {contractAddress}</p>
              {ledger?.lockActive ? (
                <>
                  <p>Locked: {ledger.balance.toString()} Stars</p>
                  <p>Unlocks: {new Date(Number(ledger.unlockTime) * 1000).toLocaleString()}</p>
                  <button type="button" onClick={() => void onRelease()} disabled={busy || !canRelease}>
                    Release Tokens
                  </button>
                </>
              ) : (
                <>
                  <label>
                    Amount (NIGHT){' '}
                    <input value={amountNight} onChange={(e) => setAmountNight(e.target.value)} />
                  </label>
                  <br />
                  <label>
                    Unlock at{' '}
                    <input
                      type="datetime-local"
                      value={unlockAt}
                      onChange={(e) => setUnlockAt(e.target.value)}
                    />
                  </label>
                  <br />
                  <button type="button" onClick={() => void onLock()} disabled={busy}>
                    Lock Tokens
                  </button>
                </>
              )}
            </>
          )}
        </>
      )}
      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
    </main>
  );
}
```

Add styling (Tailwind/CSS) as needed — logic above is intentionally unstyled like `react-wallet-connector/`.

---

## 11) ZK Asset Sync — `scripts/sync-zk-assets.mjs`

```javascript
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'contract/src/managed/locker');
const dest = join(root, 'public/zk/locker');

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
// compiler/ carries contract-manifest.json + contract-info.json; without it the provider throws EraMismatchError.
for (const dir of ['compiler', 'keys', 'zkir']) {
  cpSync(join(src, dir), join(dest, dir), { recursive: true });
}
console.log('Synced ZK assets to public/zk/locker/');
```

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

- [ ] Create `locker.compact` with `lockTokens` + `release` + `blockTimeGte`
- [ ] Compile contract; sync ZK assets to `public/zk/locker/`
- [ ] Wire `createConnectedSession` with patched indexer (from payment dapp)
- [ ] Use low-level deploy + `submitCallTxAsync` for lock/release
- [ ] Store `beneficiarySecretKey` in private state; pass `coinPublicKeyBytes` at lock
- [ ] Decode ledger with `ledger(contractState.data)` — not raw `ContractState`
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
