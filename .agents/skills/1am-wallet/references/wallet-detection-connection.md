# 1am-wallet: 2) Wallet Detection & Connection

> Reference for the `1am-wallet` skill. Back to [SKILL.md](../SKILL.md).

## 2) Wallet Detection & Connection

The extension injects asynchronously — always poll, never assume it's immediately available. Both 1AM and Lace wallets are supported.

```ts
// Inline detection (non-React)
function detectWallet(): Promise<any | null> {
  return new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      const wallet = (window as any).midnight?.['1am'];
      if (wallet) { resolve(wallet); return; }
      if (++attempts > 50) { resolve(null); return; }
      setTimeout(check, 100);
    };
    check();
  });
}

// Connect
const wallet = await detectWallet();
if (!wallet) throw new Error('1AM wallet not installed');
const api = await wallet.connect('preview'); // 'preview' | 'preprod' | 'mainnet' (all Ledger 9)
```

### React Context + useWallet Hook

Wrap your app with `WalletProvider`, then call `useWallet()` in any component.

```tsx
// contexts/WalletContext.tsx
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type WalletContextType = {
  address: string | null;
  isConnected: boolean;
  walletType: '1am' | 'lace' | null;
  isConnecting: boolean;
  walletStatus: 'checking' | 'detected' | 'not-found';
  session: ConnectedSession | null;
  connect: (network?: string) => Promise<ConnectedSession | undefined>;
  disconnect: () => void;
};

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [walletType, setWalletType] = useState<'1am' | 'lace' | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletStatus, setWalletStatus] = useState<'checking' | 'detected' | 'not-found'>('checking');
  const [session, setSession] = useState<ConnectedSession | null>(null);
  const connectingRef = useRef(false);

  // Poll for wallet injection — runs once on mount
  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => {
      const w1am = (window as any).midnight?.['1am'];
      const wLace = (window as any).midnight?.mnLace;
      if (w1am) { setWalletType('1am'); setWalletStatus('detected'); clearInterval(id); return; }
      if (wLace) { setWalletType('lace'); setWalletStatus('detected'); clearInterval(id); return; }
      if (Date.now() - startedAt >= 6000) { setWalletStatus('not-found'); clearInterval(id); }
    }, 300);
    return () => clearInterval(id);
  }, []);

  const connect = useCallback(async (network = 'preview') => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    setIsConnecting(true);
    try {
      const wallet = (window as any).midnight?.['1am'] ?? (window as any).midnight?.mnLace;
      if (!wallet) throw new Error('No wallet found');
      const api = await wallet.connect(network);
      const { createConnectedSession } = await import('../lib/midnight');
      const sess = await createConnectedSession(api, '/zk/your-contract'); // where your ZK assets are served
      setSession(sess);
      setAddress((await api.getUnshieldedAddress()).unshieldedAddress);
      setIsConnected(true);
      return sess;
    } finally {
      connectingRef.current = false;
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null); setIsConnected(false); setSession(null);
    setWalletStatus('checking'); setWalletType(null);
  }, []);

  return (
    <WalletContext.Provider value={{ address, isConnected, walletType, isConnecting, walletStatus, session, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextType {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within a WalletProvider');
  return ctx;
}
```

### WalletConnect UI Component

Always render all four states: `checking`, `not-found`, disconnected (connect CTA), connected (address + disconnect).

```tsx
import { Loader2, LogOut, Shield, Smartphone } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';

export default function WalletConnect() {
  const { isConnected, address, walletType, walletStatus, isConnecting, connect, disconnect } = useWallet();

  if (walletStatus === 'checking')
    return <span className="text-zinc-600 text-[11px] font-mono animate-pulse">Checking wallet...</span>;

  if (isConnected)
    return (
      <div className="flex items-center gap-3 border border-white/[0.06] px-4 py-2">
        {walletType === 'lace'
          ? <Smartphone className="w-3.5 h-3.5 text-violet-400" />
          : <Shield className="w-3.5 h-3.5 text-violet-400" />}
        <div>
          <span className="text-[9px] tracking-[0.2em] font-mono text-zinc-600 uppercase block">
            {walletType === '1am' ? '1AM' : 'Lace'}
          </span>
          <span className="text-[11px] font-mono text-zinc-300 truncate max-w-[130px] block">{address}</span>
        </div>
        <button onClick={disconnect} title="Disconnect" className="text-zinc-600 hover:text-red-400">
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    );

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => connect('preview')}
        disabled={isConnecting}
        className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-mono tracking-widest uppercase py-2.5 px-5 transition-all disabled:opacity-40"
      >
        {isConnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Smartphone className="w-3.5 h-3.5" />}
        Connect Wallet
      </button>
      {walletStatus === 'not-found' &&
        <p className="text-[10px] font-mono text-zinc-600">Install 1AM or Lace wallet extension</p>}
    </div>
  );
}
```
