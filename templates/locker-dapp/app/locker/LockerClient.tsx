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
    setLedger(await fetchLockerState(session.config.indexerUri, contractAddress));
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
