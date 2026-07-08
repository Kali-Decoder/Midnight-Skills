---
name: react-wallet-connector
description: Generate a React + Vite TypeScript app that connects to a Midnight wallet via the DApp Connector API (@midnight-ntwrk/dapp-connector-api). Use when building a React frontend, bootstrapping a wallet connector, wiring connect/disconnect UI, reading window.midnight wallets, getting unshielded addresses, or asking about the DApp Connector API connection flow. Produces a minimal runnable template — styling is intentionally omitted so the user can add Tailwind, CSS modules, etc.
---

# React Wallet Connector Skill

This skill generates a complete, runnable React application that connects to a Midnight wallet extension using the **DApp Connector API**. It covers every file needed: Vite + React + TypeScript scaffold, wallet selection, connection logic, and a `WalletCard` UI component.

**Primary references:**
- `docs.midnight.network` — React wallet connector guide (DApp Connector API)
- `llms.txt` — full Midnight documentation index
- `@midnight-ntwrk/dapp-connector-api@4.0.1` — latest stable connector package (Feb 2026)

**Key architecture notes:**
- Wallets inject `InitialAPI` instances on `window.midnight`, each keyed by a **UUID** — never use hardcoded keys like `window.midnight.mnLace`
- Enumerate wallets with `Object.values(window.midnight)`; when multiple wallets exist, let the user choose
- Import `@midnight-ntwrk/dapp-connector-api` as a side effect to augment global `window.midnight` types
- Request the **shielded** address only when your app actually needs it; the template uses `getUnshieldedAddress()`
- Network IDs: `'undeployed'` (local), `'preview'`, `'preprod'`, `'mainnet'` — must match the wallet's configured network
- Code examples omit CSS styling by design; add your preferred styling solution after scaffolding

**Relationship to other skills:**
- For full contract deploy + circuit calls via 1AM wallet → use `1am-wallet/`
- For headless Node.js wallet + tests → use `example-hello-world/` or `midnight-js/`
- This skill is the **frontend wallet connection foundation** only

---

## 1) Project Structure

```
my-wallet-app/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── WalletCard.tsx
    ├── types.ts
    ├── selectWallet.ts
    └── vite-env.d.ts
```

---

## 2) Prerequisites

- Node.js 18+ and npm
- Basic React + TypeScript familiarity
- A Midnight wallet browser extension installed (1AM, Lace, or any DApp Connector–compatible wallet)

---

## 3) Scaffold & Install

```bash
npm create vite@latest my-wallet-app -- --template react-ts
cd my-wallet-app
npm install @midnight-ntwrk/dapp-connector-api@4.0.1
```

---

## 4) `package.json`

Use the Vite `react-ts` template output and ensure `@midnight-ntwrk/dapp-connector-api` is listed:

```json
{
  "name": "my-wallet-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@midnight-ntwrk/dapp-connector-api": "4.0.1",
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

> Pin `@midnight-ntwrk/dapp-connector-api` to `4.0.1` unless the user specifies otherwise. Check `npm view @midnight-ntwrk/dapp-connector-api version` if install fails with `ETARGET`.

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

## 6) `tsconfig.json`

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

---

## 7) `tsconfig.app.json`

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src"]
}
```

---

## 8) `tsconfig.node.json`

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["vite.config.ts"]
}
```

---

## 9) `src/vite-env.d.ts`

```typescript
/// <reference types="vite/client" />
```

The `@midnight-ntwrk/dapp-connector-api` side-effect import in `App.tsx` augments `window.midnight` — no manual declaration needed.

---

## 10) `src/types.ts`

```typescript
export interface WalletCardProps {
  isConnected: boolean;
  walletAddress: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}
```

---

## 11) `src/selectWallet.ts`

Wallets inject under `window.midnight` with UUID keys. Always enumerate — never hardcode a wallet name.

```typescript
import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';

export const listWallets = (): InitialAPI[] => {
  const injected = window.midnight;
  return injected ? Object.values(injected) : [];
};

export const selectWallet = (): InitialAPI => {
  const wallets = listWallets();

  if (wallets.length === 0) {
    throw new Error(
      'No Midnight wallet found. Please install a Midnight wallet extension.',
    );
  }

  return wallets[0];
};
```

When more than one wallet is available, render a picker using `listWallets()` and let the user choose. Display each wallet's name and icon safely to prevent XSS.

---

## 12) `src/WalletCard.tsx`

Presentation layer — connection status, address display, connect/disconnect buttons. No CSS included; add styling as needed.

```tsx
import React from 'react';
import type { WalletCardProps } from './types';

const WalletCard: React.FC<WalletCardProps> = ({
  isConnected,
  walletAddress,
  onConnect,
  onDisconnect,
}) => {
  return (
    <div>
      <div>
        <h2>Connection Status</h2>
        <div>{isConnected ? 'Connected' : 'Disconnected'}</div>
      </div>

      <div>
        {isConnected && walletAddress ? (
          <>
            <p>Wallet Address:</p>
            <p title={walletAddress}>{walletAddress}</p>
          </>
        ) : (
          <p>Please connect your wallet to proceed.</p>
        )}
      </div>

      <div>
        {isConnected ? (
          <button onClick={onDisconnect}>Disconnect Wallet</button>
        ) : (
          <button onClick={onConnect}>Connect Wallet</button>
        )}
      </div>
    </div>
  );
};

export default WalletCard;
```

---

## 13) `src/App.tsx`

Connection logic using the DApp Connector API.

```tsx
import React, { useState } from 'react';
import WalletCard from './WalletCard';
import '@midnight-ntwrk/dapp-connector-api';
import { selectWallet } from './selectWallet';

const App: React.FC = () => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const handleConnect = async () => {
    console.log('Connect button clicked');
    let connected = false;
    let address: string | null = null;

    try {
      const wallet = selectWallet();

      // 'undeployed' for local dev; 'preprod' | 'preview' | 'mainnet' for live networks
      const connectedApi = await wallet.connect('preprod');

      const { unshieldedAddress } = await connectedApi.getUnshieldedAddress();
      address = unshieldedAddress;

      const serviceUriConfig = await connectedApi.getConfiguration();
      console.log('Service URI Config:', serviceUriConfig);

      const connectionStatus = await connectedApi.getConnectionStatus();
      if (connectionStatus.status === 'connected') {
        connected = true;
        console.log('Connected to the wallet:', address);
      }
    } catch (error) {
      console.log('An error occurred:', error);
    }

    setIsConnected(connected);
    setWalletAddress(address);
  };

  const handleDisconnect = () => {
    setWalletAddress(null);
    setIsConnected(false);
  };

  return (
    <div>
      <header>
        <h1>Midnight Wallet Connector</h1>
      </header>
      <main>
        <WalletCard
          isConnected={isConnected}
          walletAddress={walletAddress}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />
      </main>
    </div>
  );
};

export default App;
```

### Connection flow breakdown

1. **Select wallet** — `selectWallet()` reads `window.midnight` entries; throws if none found (caught by `try/catch`)
2. **Connect to network** — `wallet.connect(networkId)` prompts the user to authorize
3. **Retrieve address** — `getUnshieldedAddress()` returns the public unshielded address
4. **Check status** — `getConnectionStatus()` resolves to `{ status: 'connected' | 'disconnected' }`
5. **Optional config** — `getConfiguration()` returns service URIs (indexer, node, etc.) for downstream SDK wiring

---

## 14) `src/main.tsx`

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

## 15) `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Midnight Wallet Connector</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## 16) Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Click **Connect Wallet** — the extension prompts for authorization. After approval, the app shows connection status and the unshielded address.

---

## 17) Multi-Wallet Picker (Optional Enhancement)

When `listWallets()` returns more than one entry, replace `selectWallet()` auto-pick with a user-facing selector:

```tsx
// src/WalletPicker.tsx
import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { listWallets } from './selectWallet';

type Props = {
  onSelect: (wallet: InitialAPI) => void;
};

export function WalletPicker({ onSelect }: Props) {
  const wallets = listWallets();

  if (wallets.length === 0) {
    return <p>No Midnight wallet found. Install a wallet extension and refresh.</p>;
  }

  return (
    <ul>
      {wallets.map((wallet) => (
        <li key={wallet.name}>
          <button type="button" onClick={() => onSelect(wallet)}>
            {wallet.name}
          </button>
        </li>
      ))}
    </ul>
  );
}
```

Render wallet `name` and `icon` as text only unless you sanitize HTML. Never use `dangerouslySetInnerHTML` for wallet-provided icon URLs.

---

## 18) Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `window.midnight` is `undefined` | No extension installed or page loaded before injection | Install a Midnight wallet; refresh after install |
| `No Midnight wallet found` | Extension disabled or wrong detection pattern | Use `Object.values(window.midnight)` — not `window.midnight.mnLace` or other hardcoded keys |
| Connection rejected / fails | Network mismatch | Ensure `connect('preprod')` matches the wallet's active network |
| Connection hangs | Wallet locked or not synced | Unlock wallet; wait for sync |
| `ETARGET` on install | Stale package version | Run `npm view @midnight-ntwrk/dapp-connector-api version` and pin the latest |
| Type errors on `window.midnight` | Missing side-effect import | Add `import '@midnight-ntwrk/dapp-connector-api'` in `App.tsx` |

---

## 19) Next Steps

After a working connector, extend the app:

| Feature | Skill / API |
|---|---|
| Deploy & call Compact contracts | `1am-wallet/` |
| Token transfers | `token-transfers/` |
| Query balances & tx history | `indexer/` |
| Sign arbitrary messages | `connectedApi` signing methods (see DApp Connector API docs) |
| Multi-network selector | Network dropdown calling `wallet.connect(selectedNetwork)` |
| Full SDK provider wiring | `midnight-js/` |

---

## 20) Agent Checklist

When generating this template for a user:

- [ ] Scaffold with Vite `react-ts` or write all files from this skill
- [ ] Install `@midnight-ntwrk/dapp-connector-api@4.0.1`
- [ ] Create `types.ts`, `selectWallet.ts`, `WalletCard.tsx`, `App.tsx`, `main.tsx`
- [ ] Include side-effect import `@midnight-ntwrk/dapp-connector-api` in `App.tsx`
- [ ] Use `Object.values(window.midnight)` for wallet detection — never hardcode wallet keys
- [ ] Default network to `'preprod'` unless user specifies local (`'undeployed'`) or other network
- [ ] Omit CSS unless the user requests styling
- [ ] Mention wallet extension must be installed before testing
