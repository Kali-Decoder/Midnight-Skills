---
name: example-passport-dapp
description: >
  Build and run the Midnight Passport foundations dApp end-to-end — WebAuthn
  passkey (or local demo secret) onboarding, per-user custody Compact account,
  Night ID identity registry (<handle>.night), deposit_night, workspace UI,
  restore flow, Docker localnet + proof server via npm run demo. Use when
  scaffolding Passport, cloning the passport template, debugging passkey PRF,
  identity registry, custody deposits, or localnet Passport demos. Integration
  APIs live in midnight-passport/; runnable code in templates/passport-dapp/.
author: Kali-Decoder
---

# Example: Midnight Passport DApp

End-to-end **MN Passport foundations** demo: onboard with a passkey → deploy a custody contract → bind `alice.night` → deposit Night → explore custody workspace → logout/login restore.

**Runnable template:** `templates/passport-dapp/`. It was ported to Ledger 9 on 21 Nov 2026: Compact 0.36.1, runtime 0.21.0, Midnight.js 5.0.2, Wallet SDK 2.0.1, and `infra/` images node 2.1.101 / indexer 4.4.101 / proof server 9.0.2. `npm test` passes (23 tests), and the Node code plus `app/` type-check and build. The localnet lifecycle suites and browser E2E have not been re-run on the Ledger 9 stack yet.  
**Integration API skill:** `midnight-passport/`

**What this skill produces / runs:**
- Vite React app (`app/`)
- Compact contracts: `account`, `faucet`, `identity_registry`
- Platform-neutral wallet client (`src/wallet/`)
- Localnet Docker stack + one-command `npm run demo`
- Lifecycle tests + headless E2E

**Not production:** recovery shares on public ledger (TODO PVSS); hash-preimage auth (Schnorr deferred); genesis-funded deposits.

---

## Workflow

1. Copy `templates/passport-dapp/` (or work in-place)
2. Install root + `app/` dependencies
3. Ensure Docker + Compact on PATH
4. `npm run demo` → open http://localhost:5173/
5. Create passkey (or use `?demoMode=local`) → deposit → workspace
6. Optional: `npm run demo:e2e`, `npm test`, lifecycle scripts

---

## 1) Project structure

```
templates/passport-dapp/
├── package.json                 # compile, demo, lifecycle tests
├── scripts/demo-local.mjs       # env + compile + docker + deploy + vite
├── infra/                       # docker-compose localnet + proof server
├── contracts/
│   ├── account.compact          # per-user custody
│   ├── faucet.compact           # demo funding
│   └── identity_registry.compact
├── src/
│   ├── wallet/                  # PassportAccount, IdentityRegistry, witnesses
│   ├── node/                    # localnet wallet/providers
│   └── tests/                   # lifecycle-night, shielded, grants, recovery
├── app/                         # Vite + React UI
│   ├── src/lib/{passkey,session,midnight,providers}.ts
│   └── src/views/{Onboard,WalletPanel,DevicesPanel,...}.tsx
├── DECISIONS.md                 # prototype decision record (C1–C14)
└── README.md
```

---

## 2) Prerequisites

```bash
node --version    # >= 22
docker --version  # required for npm run demo

# Compact devtools (pinned) + the Ledger 9.1 toolchain
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/download/compact-v0.5.1/compact-installer.sh | sh
compact update 0.36.1
compact compile +0.36.1 --language-version   # 0.28.0
```

Chrome/Chromium for `npm run demo:e2e` (puppeteer-core).

---

## 3) Install and run

```bash
cp -R templates/passport-dapp my-passport-dapp   # if not already in repo
cd my-passport-dapp   # or: cd templates/passport-dapp

npm install
cd app && npm install && cd ..

npm run demo
```

Open **http://localhost:5173/** (prefer `localhost`, not `127.0.0.1`, for passkeys).

`demo-local.mjs` will:

1. Create `infra/.env` with local seeds if missing  
2. `npm run compile` when managed contract JS is absent  
3. `docker compose` up Midnight node + indexer + proof server  
4. Deploy faucet + identity registry; inject addresses into the Vite app  
5. Start Vite on `:5173`

Stop with Ctrl+C (script tears down or leaves containers — check script footer).

---

## 4) Manual browser flow

1. Enter alias (e.g. `alice`) → create passkey when prompted  
2. Wait for custody deploy + registry `register_identity`  
3. Deposit Night (demo uses genesis/faucet funding)  
4. Open positions / workspace panels (holdings, devices, grants, recovery UI)  
5. Refresh page → **Unlock** re-derives PRF device secret and reconnects  

Automation / CI without passkey UI:

```text
http://localhost:5173/?demoMode=local
```

or run:

```bash
npm run demo:e2e
```

---

## 5) Compile contracts only

```bash
npm run compile
# expands to:
# compact compile +0.36.1 contracts/account.compact contracts/managed/account
# compact compile +0.36.1 contracts/faucet.compact contracts/managed/faucet
# compact compile +0.36.1 contracts/identity_registry.compact contracts/managed/identity_registry
```

Managed output is gitignored — always compile before node tests if missing.

---

## 6) Core code maps (agents must use these files)

| Concern | File |
|---------|------|
| Passkey PRF | `app/src/lib/passkey.ts` |
| Session (no secrets) | `app/src/lib/session.ts` |
| Boot Midnight + registry helpers | `app/src/lib/midnight.ts`, `providers.ts` |
| Onboarding UX | `app/src/views/Onboard.tsx` |
| Custody client | `src/wallet/account.ts` → `PassportAccount` |
| Night ID client | `src/wallet/identity.ts` → `IdentityRegistry` |
| Witnesses | `src/wallet/witnesses.ts` |
| Commitments | `src/wallet/contract.ts` + pure circuits in `account.compact` |
| Decisions / caveats | `DECISIONS.md` |

When extending the app, **import** these modules — do not reinvent commitment tags or witness shapes.

---

## 7) Onboarding code path (reference)

```typescript
// Pseudocode matching Onboard.tsx + PassportAccount

const alias = normalizeAlias(label); // lowercase trim
const passkey = await createPasskey(`${alias}.night`);
const deviceSecret = await deriveDeviceSecret(passkey);
const recoverySecret = randomBytes32();

const account = await PassportAccount.deploy(mid.accountProviders, compiledAccountContract(), {
  deviceSecret,
  recoverySecret,
});

await registerIdentity(mid, alias, account.address);

saveSession({
  accountAddress: account.address,
  alias,
  passkey,
  identityRegistryAddress: mid.identityRegistryAddress,
});
// never persist deviceSecret / recoverySecret
```

Unlock:

```typescript
const deviceSecret = session.devMode
  ? await deriveDevModeSecret(LOCAL_DEMO_SECRET)
  : await deriveDeviceSecret(session.passkey);

const account = await PassportAccount.connect(
  mid.accountProviders,
  compiledAccountContract(),
  session.accountAddress,
  { deviceSecret },
);
```

---

## 8) Tests

```bash
npm test                    # vitest unit (simulator / shamir / account)
npm run test:lifecycle      # Night deposit/withdraw path on localnet
npm run test:shielded
npm run test:grants
npm run test:recovery
npm run demo:e2e            # browser automation against running demo
```

Lifecycle scripts expect a live localnet (same stack as `npm run demo`).

---

## 9) Extending the demo (agent guidance)

| Goal | Approach |
|------|----------|
| Custom UI branding | Edit `app/src/views/*` + `styles.css`; keep `src/wallet` intact |
| Extra custody circuit | Add to `account.compact`, recompile, wrap method on `PassportAccount` |
| Production wallet | Replace genesis `createWallet` with `1am-wallet/` / Dynamic; keep custody deploy |
| Stronger auth | Replace `require_device` hash-preimage with MIP-0013 Schnorr/WebAuthn arm (see Passport research / contract track) — out of scope for foundations cut |
| Safe recovery | Replace plaintext ledger shares with PVSS / encrypted helper shares |

---

## 10) Troubleshooting

| Symptom | Fix |
|---------|-----|
| `compact: command not found` | Install Compact; ensure PATH |
| Docker permission / not running | Start Docker Desktop; `docker info` |
| Passkey invalid domain | Use `http://localhost:5173/` |
| Unlock hangs | Localnet reset — Forget account / clear `passport-demo-session` |
| Compile language mismatch | Contracts use `pragma language_version >= 0.28.0`; compile with `compact compile +0.36.1` |
| `Version mismatch: compiled code expects 0.21.0, runtime is 0.16.0` | Stale `node_modules` | `rm -rf node_modules app/node_modules && npm install` (template pins runtime 0.21.0) |
| Old localnet chain after upgrading images | Volume from the Ledger 8 stack | `docker compose -f infra/docker-compose.yml down -v`, then restart (node 2.1.101, indexer 4.4.101, proof server 9.0.2) |
| Port 5173 busy | Stop other Vite; or change Vite port and RP expectations |
| E2E fails mid-deposit | Ensure demo script finished deploy; faucet address injected |

Full API semantics: `midnight-passport/`.  
Provider gotchas on public nets: `references/gotchas.md`, `indexer/`.

---

## 11) Agent checklist

- [ ] Start from `templates/passport-dapp/` (complete, not a stub)
- [ ] `npm install` at root **and** `app/`
- [ ] `npm run demo` with Docker + Compact
- [ ] Verify passkey or `demoMode=local` onboarding
- [ ] Confirm `.night` registration + deposit
- [ ] Document prototype limits to the user
- [ ] Link `midnight-passport/` for embedding APIs in another app

---

## Related skills

| Need | Skill |
|------|-------|
| Passport APIs without full demo | `midnight-passport/` |
| Compact syntax | `compact/` |
| midnight-js providers | `midnight-js/` |
| 1AM / Dynamic wallets | `1am-wallet/`, `dynamic-midnight-wallet/` |
| Environment / proof server | `midnight-environment-setup/` |
