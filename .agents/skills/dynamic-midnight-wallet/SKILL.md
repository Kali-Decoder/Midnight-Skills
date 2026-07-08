---
name: dynamic-midnight-wallet
description: >
  DISABLED ON PLATFORM — skill file retained for future release. Do not surface
  in MIDSKILLS index until re-enabled. Scaffold a React + Vite app with Dynamic.xyz
  Midnight wallet connection via @dynamic-labs/midnight.
author: Kali-Decoder
disable-model-invocation: true
---

# Dynamic Midnight Wallet Skill

This skill generates a complete React + Vite + TypeScript app that connects Midnight wallets through **Dynamic.xyz** (`@dynamic-labs/midnight`). It replaces hand-rolled `window.midnight` wiring with `DynamicContextProvider`, `DynamicWidget`, and typed Midnight wallet accessors.

**Primary references:**
- `dynamic.xyz/docs/react/wallets/using-wallets/midnight/using-midnight-wallets` — injected 1AM extension
- `dynamic.xyz/docs/react/wallets/using-wallets/midnight/midnight-embedded-wallets` — social/email MPC wallets
- `dynamic.xyz/docs/llms.txt` — full Dynamic documentation index
- `@dynamic-labs/midnight@4.91.2` + `@dynamic-labs/sdk-react-core@4.91.2` (pin together)

**Key architecture notes:**
- A Midnight wallet is **not** a single address — it has **three surfaces**:
  | Surface | Role | Dynamic API |
  |---------|------|-------------|
  | **Unshielded** | Public address/state | `wallet.address` |
  | **Shielded** | Private token pool | `wallet.additionalAddresses` (`MidnightShielded`) |
  | **DUST** | Fee-generation state | `wallet.additionalAddresses` (`MidnightDust`) |
- `NIGHT` exists as **both** shielded and unshielded — different pools, not duplicate balances
- **Dynamic** owns connection lifecycle, connectors, address/balance accessors, send routing
- **1AM extension** (injected) owns key custody, proving, signing, submission — Dynamic talks to it via `@midnight-ntwrk/dapp-connector-api`
- **Your app** owns deposit UX — surface **both** unshielded and shielded addresses; DUST is generated, not deposited to
- `sendBalance` routes by recipient prefix: `mn_shield...` → shielded pool, otherwise unshielded. **No cross-pool transfers**
- Always guard with `isMidnightWallet(wallet)` before calling Midnight methods

**Relationship to other skills:**
- Raw DApp Connector without Dynamic → `react-wallet-connector/`
- Contract deploy + circuit calls via 1AM directly → `1am-wallet/`
- Embedded wallets only → see §17 in this skill (`DynamicWaasMidnightConnectors`)

---

## 1) Project Structure

```
my-dynamic-midnight-app/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── .env.example
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── MidnightWalletPanel.tsx
    ├── hooks/
    │   └── useMidnightWallet.ts
    └── vite-env.d.ts
```

---

## 2) Prerequisites

- Node.js 18+
- [Dynamic.xyz](https://app.dynamic.xyz) account with **Midnight enabled** under Chains & Networks
- Dynamic **Environment ID** from the dashboard
- For injected flow: **1AM wallet** browser extension installed
- For embedded flow: enable **Private Key Exports** under Embedded Wallets → Security (required for MPC Midnight wallets)

---

## 3) Scaffold & Install

```bash
npm create vite@latest my-dynamic-midnight-app -- --template react-ts
cd my-dynamic-midnight-app
npm install @dynamic-labs/sdk-react-core@4.91.2 @dynamic-labs/midnight@4.91.2 @dynamic-labs/sdk-api-core@4.91.2
```

Create `.env`:

```bash
VITE_DYNAMIC_ENVIRONMENT_ID=your-environment-id-here
```

---

## 4) `package.json`

```json
{
  "name": "my-dynamic-midnight-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@dynamic-labs/midnight": "4.91.2",
    "@dynamic-labs/sdk-api-core": "4.91.2",
    "@dynamic-labs/sdk-react-core": "4.91.2",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "~5.7.0",
    "vite": "^6.0.0"
  }
}
```

> Pin all `@dynamic-labs/*` packages to the **same version**. Check `npm view @dynamic-labs/midnight version` if install fails.

---

## 5) `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

---

## 6) `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json`

Use the standard Vite `react-ts` template configs (same as `react-wallet-connector/SKILL.md` §6–8).

---

## 7) `src/vite-env.d.ts`

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DYNAMIC_ENVIRONMENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

---

## 8) `src/main.tsx`

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

---

## 9) `src/App.tsx`

Injected **1AM extension** flow (default template):

```tsx
import { DynamicContextProvider, DynamicWidget } from '@dynamic-labs/sdk-react-core';
import { MidnightWalletConnectors } from '@dynamic-labs/midnight';
import MidnightWalletPanel from './MidnightWalletPanel';

const environmentId = import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID;

if (!environmentId) {
  throw new Error('Set VITE_DYNAMIC_ENVIRONMENT_ID in .env');
}

export default function App() {
  return (
    <DynamicContextProvider
      settings={{
        environmentId,
        walletConnectors: [MidnightWalletConnectors],
      }}
    >
      <header>
        <h1>Midnight + Dynamic</h1>
        <DynamicWidget />
      </header>
      <main>
        <MidnightWalletPanel />
      </main>
    </DynamicContextProvider>
  );
}
```

---

## 10) `src/hooks/useMidnightWallet.ts`

```typescript
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { isMidnightWallet } from '@dynamic-labs/midnight';
import { WalletAddressType } from '@dynamic-labs/sdk-api-core';

export function useMidnightWallet() {
  const { primaryWallet } = useDynamicContext();

  if (!primaryWallet || !isMidnightWallet(primaryWallet)) {
    return { wallet: null, isConnected: false as const };
  }

  const shieldedAddress = primaryWallet.additionalAddresses?.find(
    (a) => a.type === WalletAddressType.MidnightShielded,
  )?.address;

  const dustAddress = primaryWallet.additionalAddresses?.find(
    (a) => a.type === WalletAddressType.MidnightDust,
  )?.address;

  return {
    wallet: primaryWallet,
    isConnected: true as const,
    unshieldedAddress: primaryWallet.address,
    shieldedAddress,
    dustAddress,
  };
}
```

---

## 11) `src/MidnightWalletPanel.tsx`

Displays all three surfaces and balances. No CSS — add Tailwind or your preferred styling.

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useMidnightWallet } from './hooks/useMidnightWallet';

type Balances = {
  shieldedBalance?: string;
  unshieldedBalance?: string;
  dustBalance?: { balance: string; cap: string };
};

export default function MidnightWalletPanel() {
  const { wallet, isConnected, unshieldedAddress, shieldedAddress, dustAddress } =
    useMidnightWallet();
  const [balances, setBalances] = useState<Balances | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshBalances = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    try {
      const formatted = await wallet.getFormattedBalances();
      setBalances({
        shieldedBalance: formatted.shieldedBalance,
        unshieldedBalance: formatted.unshieldedBalance,
        dustBalance: formatted.dustBalance,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    void refreshBalances();
  }, [refreshBalances]);

  if (!isConnected || !wallet) {
    return <p>Connect your Midnight wallet with the widget above.</p>;
  }

  return (
    <div>
      <h2>Wallet Surfaces</h2>
      <dl>
        <dt>Unshielded (public)</dt>
        <dd title={unshieldedAddress}>{unshieldedAddress}</dd>
        <dt>Shielded (private)</dt>
        <dd title={shieldedAddress ?? ''}>{shieldedAddress ?? '—'}</dd>
        <dt>DUST (fees)</dt>
        <dd title={dustAddress ?? ''}>{dustAddress ?? '—'}</dd>
      </dl>

      <h2>Balances</h2>
      {loading ? <p>Loading…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {balances ? (
        <ul>
          <li>Unshielded NIGHT: {balances.unshieldedBalance ?? '0'}</li>
          <li>Shielded NIGHT: {balances.shieldedBalance ?? '0'}</li>
          <li>
            DUST:{' '}
            {balances.dustBalance
              ? `${balances.dustBalance.balance} / cap ${balances.dustBalance.cap}`
              : '—'}
          </li>
        </ul>
      ) : null}
      <button type="button" onClick={() => void refreshBalances()}>
        Refresh Balances
      </button>

      <h2>Deposit instructions</h2>
      <p>
        Send to the <strong>unshielded</strong> address for public NIGHT, or the{' '}
        <strong>shielded</strong> address for private NIGHT. DUST is generated from
        registered unshielded NIGHT — it is not deposited to directly.
      </p>
    </div>
  );
}
```

---

## 12) `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Midnight + Dynamic</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## 13) `.env.example`

```bash
VITE_DYNAMIC_ENVIRONMENT_ID=
```

---

## 14) Run

```bash
cp .env.example .env
# Paste your Dynamic Environment ID
npm install
npm run dev
```

Open `http://localhost:5173`. Click **DynamicWidget** → connect 1AM wallet → panel shows three surfaces and balances.

---

## 15) Checking Wallet Type

```tsx
import { isMidnightWallet } from '@dynamic-labs/midnight';

if (!isMidnightWallet(wallet)) {
  throw new Error('This wallet is not a Midnight wallet');
}
```

Always narrow before calling `getFormattedBalances()`, `sendBalance()`, or connector methods.

---

## 16) Richer Shielded Handles (Connector API)

When circuits need coin/encryption public keys:

```tsx
const connector = primaryWallet.connector;

const { shieldedAddress, shieldedCoinPublicKey, shieldedEncryptionPublicKey } =
  await connector.getShieldedAddresses();
const { unshieldedAddress } = await connector.getUnshieldedAddress();
const { dustAddress } = await connector.getDustAddress();
```

Use these when wiring `1am-wallet/` provider sessions on top of Dynamic.

---

## 17) Embedded Wallets (Social / Email)

Swap connector in `App.tsx`:

```tsx
import { DynamicWaasMidnightConnectors } from '@dynamic-labs/midnight';

<DynamicContextProvider
  settings={{
    environmentId,
    walletConnectors: [DynamicWaasMidnightConnectors],
  }}
>
```

**Dashboard requirements:**
1. Enable Midnight under Chains & Networks
2. Enable **Private Key Exports** under Embedded Wallets → Security (403 on all ops if disabled)

Embedded balance shape differs slightly:

```tsx
const { unshieldedBalance, shieldedTokenCount, dustBalance, dustSyncing } =
  await primaryWallet.getFormattedBalances();

// Poll until DUST sync completes (WaaS only)
if (dustSyncing) {
  setTimeout(() => void refreshBalances(), 2500);
}
```

Embedded-only extras: `registerDust()`, `signMessage()`, step-by-step `createTransferTransaction` → `signTransaction` → `submitTransaction`.

---

## 18) Sending Tokens

```tsx
// Routes by recipient prefix — mn_shield... = shielded, else unshielded
await primaryWallet.sendBalance({
  toAddress: 'mn_shield...',
  amount: '1.5', // human-readable NIGHT for extension wallets
});
```

Cross-pool transfers are **not** supported. Sender and recipient must be in the same pool.

For raw per-token amounts:

```tsx
const { shielded, unshielded, dust } = await primaryWallet.getBalances();
```

---

## 19) Ownership Boundaries

| Layer | Owns |
|-------|------|
| **Dynamic** | Connection lifecycle, connectors, `MidnightWallet` object, address/balance accessors, send routing |
| **1AM extension** | Key custody, derivation, ZK proving, signing, submission |
| **Your DApp** | Deposit/receive UX (show unshielded **and** shielded), which pool to display, DUST generation messaging |

---

## 20) Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Midnight not in widget | Chain disabled | Enable Midnight in Dynamic dashboard → Chains & Networks |
| 403 on all wallet methods (embedded) | Private Key Exports off | Enable under Embedded Wallets → Security |
| `isMidnightWallet` false | Wrong connector or chain | Use `MidnightWalletConnectors` or `DynamicWaasMidnightConnectors` |
| Shielded address missing | Wallet still syncing | Retry after connect; poll `dustSyncing` for WaaS |
| Send fails cross-pool | `mn_addr` → `mn_shield` | Same pool only — unshielded to unshielded, shielded to shielded |
| Version mismatch errors | Mixed `@dynamic-labs/*` versions | Pin all Dynamic packages to same version |
| Empty DUST | NIGHT not registered | Call `registerDust()` after funding unshielded NIGHT (embedded) |

---

## 21) Agent Checklist

When generating this template for a user:

- [ ] Scaffold Vite `react-ts` or write all files from this skill
- [ ] Install `@dynamic-labs/sdk-react-core`, `@dynamic-labs/midnight`, `@dynamic-labs/sdk-api-core` at same version
- [ ] Set `VITE_DYNAMIC_ENVIRONMENT_ID` in `.env`
- [ ] Use `MidnightWalletConnectors` for extension (default) or `DynamicWaasMidnightConnectors` for embedded
- [ ] Include `DynamicWidget` for connect/disconnect
- [ ] Surface **unshielded**, **shielded**, and **DUST** in deposit UI
- [ ] Guard all Midnight calls with `isMidnightWallet`
- [ ] Omit CSS unless user requests styling
- [ ] Link to `1am-wallet/` if user needs contract deploy on top of Dynamic connection

---

## 22) Related Skills

| Need | Skill |
|------|-------|
| DApp Connector without Dynamic | `react-wallet-connector/` |
| Contract deploy + circuits | `1am-wallet/` |
| Token units & pools | `token-transfers/` |
| Locker / payment vault dApps | `example-locker-dapp/`, `example-payment-dapp/` |
