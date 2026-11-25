# Dynamic Midnight Wallet: 3-8) Scaffold and config files

> Reference for the `dynamic-midnight-wallet` skill. Back to [SKILL.md](../SKILL.md).

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
