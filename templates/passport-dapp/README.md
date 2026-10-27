# Midnight Passport Foundations Demo

Runnable template for **MN Passport**: passkey (or local-demo) onboarding, custody-account deploy, Night ID registry binding (`<handle>.night`), direct `deposit_night`, positions/workspace UI, and restore.

**Skills:**
- Integration API guide → `.agents/skills/midnight-passport/SKILL.md`
- End-to-end build guide → `.agents/skills/example-passport-dapp/SKILL.md`

This is a **foundations / localnet demo**, not production custody. Recovery shares on-ledger are prototype placeholders (TODO PVSS). Auth uses hash-preimage device secrets (Schnorr/WebAuthn arms live in the broader Passport contract research track).

## What it proves

- Browser passkey onboarding for a Night ID (WebAuthn PRF → 32-byte device secret)
- Deploy one custody Compact contract per account
- Identity registry: `<handle>.night` → custody contract address
- Direct localnet `deposit_night` into custody
- Logout/login restore (re-derive device secret; secrets never stored in localStorage)
- Custody workspace: holdings, overview, devices, grants, recovery UI

## Layout

| Path | Purpose |
|------|---------|
| `app/` | Vite + React demo UI |
| `contracts/` | `account.compact`, `faucet.compact`, `identity_registry.compact` |
| `src/wallet/` | `PassportAccount`, `IdentityRegistry`, witnesses, Shamir helpers |
| `src/node/` | Localnet wallet / providers / deploy helpers |
| `src/tests/` | Lifecycle tests |
| `scripts/demo-local.mjs` | One-command localnet + compile + deploy + Vite |
| `infra/` | Docker Compose for Midnight localnet + proof server |

## Prerequisites

- Docker
- Node.js >= 22
- Compact compiler on PATH (demo validated on Compact language `0.23` / toolchain ~0.30–0.31)
- Chrome for headless E2E (`npm run demo:e2e`)

## Run

```bash
cd templates/passport-dapp
npm install
cd app && npm install && cd ..
npm run demo
```

Open http://localhost:5173/

The demo script:

1. Creates `infra/.env` if missing  
2. Compiles Compact contracts if needed  
3. Starts Midnight localnet + proof server  
4. Deploys faucet + identity registry  
5. Starts the Vite app  

## E2E (automation / no passkey prompt)

```bash
npm run demo:e2e
```

Uses local demo secret mode (`?demoMode=local` / webdriver) so CI can exercise deploy → register → deposit → position without a browser passkey prompt.

## Notes

- Runtime artifacts (`contracts/managed/`, `infra/.env`, level DB) are gitignored  
- Prefer `http://localhost:5173/` for passkeys (valid RP id)  
- Genesis wallet funds demo deposits on localnet  
