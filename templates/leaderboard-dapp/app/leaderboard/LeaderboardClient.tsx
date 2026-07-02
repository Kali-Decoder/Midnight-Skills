'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deployLeaderboard,
  fetchLeaderboardState,
  submitScore,
  verifyOwnership,
  ZK_PATH,
  type LeaderboardEntry,
} from '@/lib/leaderboard';
import { createConnectedSession, detectWallet, type ConnectedSession } from '@/lib/midnight';

enum DisplayMode {
  Anonymous = 'anonymous',
  Public = 'public',
  Custom = 'custom',
}

const CONTRACT_STORAGE_KEY = 'midnight-leaderboard-contract';
const GAME_SECONDS = 10;

function truncAddr(addr: string): string {
  return addr.length <= 24 ? addr : `${addr.slice(0, 14)}…${addr.slice(-8)}`;
}

export default function LeaderboardClient() {
  const [session, setSession] = useState<ConnectedSession | null>(null);
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState('');
  const [showJoinPanel, setShowJoinPanel] = useState(false);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clicks, setClicks] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [showResult, setShowResult] = useState(false);
  const [lastScore, setLastScore] = useState(0);
  const clickRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [displayMode, setDisplayMode] = useState<DisplayMode>(DisplayMode.Anonymous);
  const [customName, setCustomName] = useState('');
  const [verifiedIds, setVerifiedIds] = useState<Set<number>>(new Set());
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(CONTRACT_STORAGE_KEY);
    if (stored) setContractAddress(stored);
  }, []);

  const refresh = useCallback(async () => {
    if (!contractAddress) return;
    const indexerUrl =
      session?.config.indexerUri ?? 'https://indexer.preprod.midnight.network/api/v4/graphql';
    try {
      const state = await fetchLeaderboardState(indexerUrl, contractAddress);
      setEntries(state.entries);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, [contractAddress, session]);

  useEffect(() => {
    void refresh();
    if (!contractAddress) return;
    const interval = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(interval);
  }, [refresh, contractAddress]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

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
      const addr = await deployLeaderboard(session);
      setContractAddress(addr);
      localStorage.setItem(CONTRACT_STORAGE_KEY, addr);
      setShowJoinPanel(false);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function onJoin() {
    const addr = joinInput.trim();
    if (!/^[0-9a-fA-F]{64}$/.test(addr)) {
      setError('Contract address must be 64 hex characters.');
      return;
    }
    setContractAddress(addr);
    localStorage.setItem(CONTRACT_STORAGE_KEY, addr);
    setShowJoinPanel(false);
    setJoinInput('');
    setError(null);
  }

  function startGame() {
    setClicks(0);
    clickRef.current = 0;
    setTimeLeft(GAME_SECONDS);
    setIsPlaying(true);
    setShowResult(false);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setIsPlaying(false);
          setShowResult(true);
          setLastScore(clickRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function handleClick() {
    if (!isPlaying) return;
    clickRef.current += 1;
    setClicks(clickRef.current);
  }

  async function onSubmitScore() {
    if (!session || !contractAddress || lastScore === 0) return;
    setBusy(true);
    setError(null);
    try {
      let name: string | undefined;
      if (displayMode === DisplayMode.Public && session.unshieldedAddress) {
        const a = session.unshieldedAddress;
        name = `${a.slice(0, 12)}..${a.slice(-12)}`;
      } else if (displayMode === DisplayMode.Custom) {
        name = customName.trim();
      }
      await submitScore(session, contractAddress, lastScore, name);
      setShowResult(false);
      setLastScore(0);
      setTimeout(() => void refresh(), 3000);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(entryId: number) {
    if (!session || !contractAddress) return;
    setVerifyingId(entryId);
    setError(null);
    try {
      await verifyOwnership(session, contractAddress, entryId);
      setVerifiedIds((prev) => new Set(prev).add(entryId));
    } catch (e) {
      setError(String(e));
    } finally {
      setVerifyingId(null);
    }
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '1.5rem', maxWidth: 720 }}>
      <h1>Midnight Leaderboard</h1>
      <p style={{ opacity: 0.85 }}>
        Arcade click challenge with privacy-preserving on-chain scores and ZK ownership proofs.
      </p>

      {!session ? (
        <button type="button" onClick={() => void onConnect()} disabled={busy}>
          Connect 1AM Wallet
        </button>
      ) : (
        <p>Connected: {truncAddr(session.unshieldedAddress)}</p>
      )}

      {contractAddress ? (
        <p>Contract: {truncAddr(contractAddress)}</p>
      ) : (
        <p>No contract selected — deploy or join one below.</p>
      )}

      <button type="button" onClick={() => setShowJoinPanel((v) => !v)}>
        {showJoinPanel ? 'Cancel' : 'Switch Contract'}
      </button>

      {showJoinPanel && (
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Contract address (64 hex)"
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          <button type="button" onClick={onJoin} disabled={!joinInput.trim()}>
            Join
          </button>
          {session && (
            <button type="button" onClick={() => void onDeploy()} disabled={busy}>
              Deploy New
            </button>
          )}
        </div>
      )}

      <section style={{ marginTop: '2rem' }}>
        <h2>Click Challenge</h2>
        <p>
          Time: {isPlaying ? timeLeft : GAME_SECONDS}s · Clicks: {clicks}
        </p>
        {isPlaying && (
          <button type="button" onClick={handleClick} style={{ fontSize: '1.25rem', padding: '1rem 2rem' }}>
            CLICK!
          </button>
        )}
        {!isPlaying && !showResult && (
          <button type="button" onClick={startGame} disabled={!contractAddress}>
            Start Game
          </button>
        )}
        {showResult && lastScore > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <p>Score: {lastScore}</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              {(
                [
                  [DisplayMode.Anonymous, 'Anonymous'],
                  [DisplayMode.Public, 'Public'],
                  [DisplayMode.Custom, 'Custom'],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDisplayMode(mode)}
                  style={{ fontWeight: displayMode === mode ? 'bold' : 'normal' }}
                >
                  {label}
                </button>
              ))}
            </div>
            {displayMode === DisplayMode.Custom && (
              <input
                type="text"
                maxLength={32}
                placeholder="Display name (max 32 chars)"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
            )}
            {session ? (
              <button
                type="button"
                onClick={() => void onSubmitScore()}
                disabled={
                  busy ||
                  (displayMode === DisplayMode.Custom && !customName.trim())
                }
                style={{ display: 'block', marginTop: '0.5rem' }}
              >
                Submit to Chain
              </button>
            ) : (
              <button type="button" onClick={() => void onConnect()} disabled={busy}>
                Connect to Submit
              </button>
            )}
            <button type="button" onClick={startGame} style={{ marginLeft: '0.5rem' }}>
              Try Again
            </button>
          </div>
        )}
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Leaderboard ({entries.length} entries)</h2>
        {entries.length === 0 ? (
          <p>No scores yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>#</th>
                <th style={{ textAlign: 'left' }}>Player</th>
                <th style={{ textAlign: 'right' }}>Score</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr key={entry.id}>
                  <td>{i + 1}</td>
                  <td>
                    {entry.displayName}
                    {verifiedIds.has(entry.id) ? ' ✓ yours' : ''}
                  </td>
                  <td style={{ textAlign: 'right' }}>{entry.score.toLocaleString()}</td>
                  <td>
                    {session && !verifiedIds.has(entry.id) && (
                      <button
                        type="button"
                        onClick={() => void onVerify(entry.id)}
                        disabled={verifyingId !== null}
                      >
                        {verifyingId === entry.id ? '…' : 'Prove'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {error ? <p style={{ color: 'crimson', marginTop: '1rem' }}>{error}</p> : null}
    </main>
  );
}
