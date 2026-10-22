---
name: dynamic-midnight-wallet
description: >
  Scaffold a React + Vite TypeScript app with Dynamic.xyz Midnight wallets
  (@dynamic-labs/midnight). Covers external wallets (1AM extension via
  MidnightWalletConnectors) and embedded MPC wallets (social/email via
  DynamicWaasMidnightConnectors): three surfaces (unshielded, shielded, DUST),
  balances, sendBalance routing, registerDust, and embedded contract settlement
  via getWalletProvider(). Use when the user asks about Dynamic + Midnight,
  DynamicWidget Midnight, shielded/unshielded/DUST addresses in Dynamic, or
  replacing hand-rolled window.midnight with Dynamic.
author: Kali-Decoder
---

# Dynamic Midnight Wallet

Generate a React + Vite + TypeScript app that connects Midnight wallets through **Dynamic.xyz** (`@dynamic-labs/midnight`). Prefer this over hand-rolled `window.midnight` when the product already uses Dynamic auth/wallet UI.

**Primary references:**
- [Using Midnight external wallets](https://www.dynamic.xyz/docs/react/wallets/using-wallets/midnight/using-midnight-wallets) — 1AM extension
- [Using Midnight embedded wallets](https://www.dynamic.xyz/docs/react/wallets/using-wallets/midnight/midnight-embedded-wallets) — social/email MPC
- [Deploying and calling Midnight contracts](https://www.dynamic.xyz/docs/react/wallets/using-wallets/midnight/midnight-contracts) — embedded settlement provider
- [Dynamic docs index](https://www.dynamic.xyz/docs/llms.txt)
- Pin: `@dynamic-labs/midnight@5.12.2` + `@dynamic-labs/sdk-react-core@5.12.2` (+ `@dynamic-labs/sdk-api-core@0.104.0` for `WalletAddressType`)

**Key architecture notes:**
- A Midnight wallet is **not** a single address — three surfaces:

  | Surface | Role | Dynamic API |
  |---------|------|-------------|
  | **Unshielded** | Public address/state | `wallet.address` |
  | **Shielded** | Private token pool | `wallet.additionalAddresses` (`MidnightShielded` / `midnight_shielded`) |
  | **DUST** | Fee-generation state | `wallet.additionalAddresses` (`MidnightDust` / `midnight_dust`) |

- `NIGHT` exists as **both** shielded and unshielded — different pools, not duplicate balances
- **Dynamic** — connection lifecycle, connectors, address/balance accessors, send routing
- **1AM (external)** — key custody, derivation, proving, signing, submission via `@midnight-ntwrk/dapp-connector-api`
- **Your app** — deposit UX: surface **both** unshielded and shielded; DUST is generated, not deposited to
- `sendBalance` routes by recipient prefix: `mn_shield…` → shielded, otherwise unshielded. **No cross-pool transfers**
- Always guard with `isMidnightWallet(wallet)` before Midnight methods
- Contract deploy/call with Dynamic's settlement provider is documented for **embedded** wallets (`getWalletProvider()`). External wallets use their own provider surface (see `1am-wallet/`)

**Relationship to other skills:**
- Raw DApp Connector without Dynamic → `react-wallet-connector/`
- Contract deploy + circuit calls via 1AM directly → `1am-wallet/`
- Token pools / NIGHT units → `token-transfers/`

---

## Workflow

1. Enable Midnight (and Private Key Exports if embedded) in Dynamic console
2. Scaffold Vite React-TS; install Dynamic packages at matching versions
3. Add `DynamicContextProvider` + `MidnightWalletConnectors` (external) or `DynamicWaasMidnightConnectors` (embedded)
4. Read three address surfaces; show both deposit addresses in UI
5. Read balances; send with `sendBalance`; for embedded add `registerDust` / optional contract provider

---

## 1) Project structure

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
- [Dynamic developer console](https://app.dynamic.xyz) account
- **Environment ID** from the dashboard
- Enable **Midnight** under [Chains & Networks](https://app.dynamic.xyz/dashboard/chains-and-networks)
- **External (1AM):** 1AM browser extension installed
- **Embedded (social/email):** enable **Private Key Exports** under Embedded Wallets → Security (403 on all ops if off)

---

## 3) Scaffold and install

```bash
npm create vite@latest my-dynamic-midnight-app -- --template react-ts
cd my-dynamic-midnight-app
npm install @dynamic-labs/sdk-react-core@5.12.2 @dynamic-labs/midnight@5.12.2 @dynamic-labs/sdk-api-core@0.104.0
```

Create `.env`:

```bash
VITE_DYNAMIC_ENVIRONMENT_ID=your-environment-id-here
```

> Pin `@dynamic-labs/midnight` and `@dynamic-labs/sdk-react-core` to the **same** major.minor.patch. `sdk-api-core` follows Midnight's dependency (currently `0.104.0` for `5.12.2`). Check `npm view @dynamic-labs/midnight version` if install fails.

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
    "@dynamic-labs/midnight": "5.12.2",
    "@dynamic-labs/sdk-api-core": "0.104.0",
    "@dynamic-labs/sdk-react-core": "5.12.2",
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

## 6) TypeScript configs

Use the standard Vite `react-ts` template configs (same as `react-wallet-connector/` §§6–8).

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

## 9) Enable Midnight + connectors

### External wallets (1AM extension) — default

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

### Embedded wallets (social / email MPC)

```tsx
import { DynamicWaasMidnightConnectors } from '@dynamic-labs/midnight';

<DynamicContextProvider
  settings={{
    environmentId,
    walletConnectors: [DynamicWaasMidnightConnectors],
  }}
>
```

Dashboard: Chains & Networks → Midnight **on**, and Embedded Wallets → Security → **Private Key Exports** **on**.

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

## 11) Checking wallet type

```tsx
import { isMidnightWallet } from '@dynamic-labs/midnight';

if (!isMidnightWallet(wallet)) {
  throw new Error('This wallet is not a Midnight wallet');
}
```

Narrow before `getFormattedBalances()`, `sendBalance()`, or connector methods.

---

## 12) Address surfaces

```tsx
// Unshielded — main address
const unshieldedAddress = primaryWallet.address;

// Shielded + DUST — additionalAddresses
const shieldedAddress = primaryWallet.additionalAddresses?.find(
  (a) => a.type === WalletAddressType.MidnightShielded,
)?.address;

const dustAddress = primaryWallet.additionalAddresses?.find(
  (a) => a.type === WalletAddressType.MidnightDust,
)?.address;
```

Deposit UX: show **unshielded** and **shielded**. DUST is generated, not deposited to.

Cryptographic keys for circuits (external connector):

```tsx
const { shieldedCoinPublicKey, shieldedEncryptionPublicKey } =
  await primaryWallet.connector.getShieldedAddresses();
```

---

## 13) Reading balances

### External wallets

```tsx
const { unshieldedBalance, shieldedTokenCount, dustBalance } =
  await primaryWallet.getFormattedBalances();

// unshieldedBalance  -> e.g. "3.0" (undefined if none)
// shieldedTokenCount -> distinct shielded token types with positive balance
// dustBalance        -> { balance: string, cap: string } | undefined
```

### Embedded wallets (extra fields)

```tsx
const { unshieldedBalance, shieldedTokenCount, dustBalance, dustSyncing } =
  await primaryWallet.getFormattedBalances();

if (dustSyncing) {
  setTimeout(() => void refreshBalances(), 2500);
}
```

Individual getters:

```tsx
await primaryWallet.getShieldedBalance();   // shielded NIGHT
await primaryWallet.getUnshieldedBalance(); // unshielded NIGHT
await primaryWallet.getDustBalance();       // { balance, cap }
```

Raw per-token amounts:

```tsx
const { shielded, unshielded, dust } = await primaryWallet.getBalances();
```

---

## 14) `src/MidnightWalletPanel.tsx`

No CSS — add Tailwind or your preferred styling after scaffolding.

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useMidnightWallet } from './hooks/useMidnightWallet';

type Formatted = {
  unshieldedBalance?: string;
  shieldedTokenCount?: number;
  dustBalance?: { balance: string; cap: string };
  dustSyncing?: boolean;
};

export default function MidnightWalletPanel() {
  const { wallet, isConnected, unshieldedAddress, shieldedAddress, dustAddress } =
    useMidnightWallet();
  const [balances, setBalances] = useState<Formatted | null>(null);
  const [shieldedNight, setShieldedNight] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshBalances = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    try {
      const formatted = await wallet.getFormattedBalances();
      setBalances(formatted);
      setShieldedNight(await wallet.getShieldedBalance());
      if (formatted.dustSyncing) {
        setTimeout(() => void refreshBalances(), 2500);
      }
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
      <h2>Wallet surfaces</h2>
      <dl>
        <dt>Unshielded (public)</dt>
        <dd>{unshieldedAddress}</dd>
        <dt>Shielded (private)</dt>
        <dd>{shieldedAddress ?? '—'}</dd>
        <dt>DUST (fees)</dt>
        <dd>{dustAddress ?? '—'}</dd>
      </dl>

      <h2>Balances</h2>
      {loading ? <p>Loading…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {balances ? (
        <ul>
          <li>Unshielded NIGHT: {balances.unshieldedBalance ?? '0'}</li>
          <li>Shielded NIGHT: {shieldedNight ?? '0'}</li>
          <li>Shielded token types: {balances.shieldedTokenCount ?? 0}</li>
          <li>
            DUST:{' '}
            {balances.dustBalance
              ? `${balances.dustBalance.balance} / cap ${balances.dustBalance.cap}`
              : '—'}
          </li>
        </ul>
      ) : null}
      <button type="button" onClick={() => void refreshBalances()}>
        Refresh balances
      </button>

      <h2>Deposit</h2>
      <p>
        Send to the <strong>unshielded</strong> address for public NIGHT, or the{' '}
        <strong>shielded</strong> address for private NIGHT. DUST is generated from
        registered unshielded NIGHT — do not deposit to the DUST address.
      </p>
    </div>
  );
}
```

---

## 15) Sending

`sendBalance` routes by recipient prefix (`mn_shield…` = shielded, otherwise unshielded). Same pool only.

### External (human-readable NIGHT amounts in docs)

```tsx
await primaryWallet.sendBalance({
  toAddress: 'mn_shield...',
  amount: '1.5',
});
```

### Embedded (atomic units unless `token.decimals` is set)

```tsx
await primaryWallet.sendBalance({
  toAddress: 'mn_addr...',
  amount: '100000000',
});

await primaryWallet.sendBalance({
  toAddress: 'mn_shield...',
  amount: '50',
  token: { address: 'tokenTypeHex', decimals: 6 },
});
```

### Embedded step-by-step

```tsx
const { serializedTransaction } = await primaryWallet.createTransferTransaction({
  transfers: [
    {
      type: 'unshielded', // or 'shielded'
      recipientAddress: 'mn_addr...',
      amount: '100000000',
    },
  ],
});

const finalizedTransaction =
  await primaryWallet.signTransaction(serializedTransaction);

const { txHash } = await primaryWallet.submitTransaction(finalizedTransaction);
```

Stuck inputs after aborted builds:

```tsx
await primaryWallet.revertTransaction(serializedTransaction);
await primaryWallet.revertAllPending();
// last resort: await primaryWallet.resetWalletCache();
```

---

## 16) Embedded: register DUST

```tsx
const result = await primaryWallet.registerDust();
// 'registered' | 'already_registered' | 'already_has_dust' | 'no_utxos'
```

Fund unshielded NIGHT first. Registration does not mint DUST — it accrues over time. Poll `getFormattedBalances()` until `dustBalance` appears.

Embedded signing:

```tsx
const signature = await primaryWallet.signMessage('Hello Midnight');
```

---

## 17) Embedded: contracts via settlement provider

Contract half (circuits, witnesses, ZK proof) runs in your app via midnight-js. Settlement (balance, DUST, sign, submit) stays in the Dynamic iframe:

```tsx
const walletProvider = await primaryWallet.getWalletProvider();
```

Wire into midnight-js providers (`walletProvider` + `midnightProvider` from Dynamic; you supply private state, indexer, zk config, proof server). Full pattern: Dynamic [midnight-contracts](https://www.dynamic.xyz/docs/react/wallets/using-wallets/midnight/midnight-contracts) + skills `midnight-js/`, `1am-wallet/`.

For **external** 1AM, use the extension's own provider surface (`1am-wallet/`) — Dynamic's settlement provider docs are embedded-only.

---

## 18) `index.html` / `.env.example` / run

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

```bash
# .env.example
VITE_DYNAMIC_ENVIRONMENT_ID=
```

```bash
cp .env.example .env
# paste Environment ID
npm install
npm run dev
```

Open `http://localhost:5173` → DynamicWidget → connect → panel shows three surfaces and balances.

---

## 19) Ownership boundaries

| Layer | Owns |
|-------|------|
| **Dynamic** | Connection lifecycle, connectors, `MidnightWallet`, address/balance accessors, send routing |
| **1AM (external)** | Key custody, derivation, ZK proving, signing, submission |
| **Your DApp** | Deposit/receive UX (unshielded **and** shielded), pool display, DUST messaging |

---

## 20) Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Midnight missing in widget | Chain disabled | Enable Midnight → Chains & Networks |
| 403 on all methods (embedded) | Private Key Exports off | Embedded Wallets → Security → enable |
| `isMidnightWallet` false | Wrong connector | Use `MidnightWalletConnectors` or `DynamicWaasMidnightConnectors` |
| Shielded / DUST missing | Still syncing | Retry; poll `dustSyncing` (embedded) |
| Send fails cross-pool | `mn_addr` ↔ `mn_shield` | Same pool only |
| Version mismatch | Mixed `@dynamic-labs/*` | Align midnight + sdk-react-core versions |
| Empty DUST | Not registered / low NIGHT | `registerDust()` after funding unshielded NIGHT (embedded) |
| Deploy works, calls fail | Proof server / ZK artifacts | See midnight-contracts pitfalls; first `callTx` needs proof server |

---

## 21) Agent checklist

- [ ] Scaffold Vite `react-ts` or write files from this skill
- [ ] Install Dynamic packages (pinned versions above)
- [ ] Set `VITE_DYNAMIC_ENVIRONMENT_ID`
- [ ] Enable Midnight in console; Private Key Exports if embedded
- [ ] `MidnightWalletConnectors` (external) or `DynamicWaasMidnightConnectors` (embedded)
- [ ] Include `DynamicWidget`
- [ ] Surface unshielded, shielded, and DUST
- [ ] Guard with `isMidnightWallet`
- [ ] Omit CSS unless requested
- [ ] Point to `1am-wallet/` / `midnight-js/` for contract deploy beyond connection

---

## 22) Related skills

| Need | Skill |
|------|-------|
| DApp Connector without Dynamic | `react-wallet-connector/` |
| Contract deploy + circuits (1AM) | `1am-wallet/` |
| Token units & pools | `token-transfers/` |
| SDK providers | `midnight-js/` |
