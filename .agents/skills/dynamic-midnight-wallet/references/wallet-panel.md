# Dynamic Midnight Wallet: 14) `src/MidnightWalletPanel.tsx`

> Reference for the `dynamic-midnight-wallet` skill. Back to [SKILL.md](../SKILL.md).

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
