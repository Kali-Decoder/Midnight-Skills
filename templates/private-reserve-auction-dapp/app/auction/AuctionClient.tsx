'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { detectWallet, createConnectedSession } from '@/lib/midnight';
import {
  deployAuction,
  placeBid,
  closeAuction,
  revealPrice,
  claimItem,
  claimProceeds,
  fetchAuctionState,
  userAddressFromSession,
  ZK_PATH,
} from '@/lib/auction';
import { generateSecret, loadSecret, saveSecret } from '@/lib/secret';
import type { ConnectedSession } from '@/lib/midnight';

type Role = 'seller' | 'bidder';

const STATE_LABELS: Record<string, string> = {
  OPEN: 'Open for Bids',
  CLOSED: 'Bidding Closed',
  SETTLED: 'Settled',
};

export default function AuctionClient() {
  const [session, setSession] = useState<ConnectedSession | null>(null);
  const [role, setRole] = useState<Role>('bidder');
  const [contractAddress, setContractAddress] = useState('');
  const [auctionState, setAuctionState] = useState<Awaited<ReturnType<typeof fetchAuctionState>> | null>(null);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [walletInstalled, setWalletInstalled] = useState<boolean | null>(null);
  const mountedRef = useRef(true);

  const [reservePriceNight, setReservePriceNight] = useState('0.01');
  const [maxBidders, setMaxBidders] = useState('5');
  const [bidAmountNight, setBidAmountNight] = useState('0.02');

  useEffect(() => {
    detectWallet()
      .then((w) => setWalletInstalled(w !== null))
      .catch(() => setWalletInstalled(false));
    return () => { mountedRef.current = false; };
  }, []);

  const withLoading = useCallback(async <T,>(
    message: string,
    fn: (setStatus: (msg: string) => void) => Promise<T>,
  ): Promise<T> => {
    setBusy(true);
    setError('');
    setStatusMessage(message);
    try {
      const result = await fn((msg: string) => {
        if (mountedRef.current) setStatusMessage(msg);
      });
      return result;
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : String(e));
      }
      throw e;
    } finally {
      if (mountedRef.current) {
        setBusy(false);
        setStatusMessage('');
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!session || !contractAddress) return;
    try {
      const state = await fetchAuctionState(session, contractAddress);
      if (mountedRef.current) setAuctionState(state);
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : 'Refresh failed');
    }
  }, [session, contractAddress]);

  useEffect(() => { void refresh(); }, [refresh]);

  const connectWallet = useCallback(async () => {
    setConnecting(true);
    setError('');
    try {
      const wallet = await detectWallet();
      if (!wallet) {
        setError('1AM wallet not detected. Please install the 1AM browser extension.');
        return;
      }
      const api = await wallet.connect('preview');
      const s = await createConnectedSession(api, ZK_PATH);
      setSession(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect wallet');
    } finally {
      setConnecting(false);
    }
  }, []);

  const handleDeploy = useCallback(async () => {
    if (!session) return;
    await withLoading('Deploying auction contract…', async (setStatus) => {
      const secret = generateSecret();
      const addr = await deployAuction(
        session,
        Number(reservePriceNight),
        Number(maxBidders),
        secret,
      );
      setContractAddress(addr);
      saveSecret('seller', addr, secret);

      setStatus('Waiting for indexer…');
      const state = await fetchAuctionState(session, addr);
      setAuctionState(state);
    });
  }, [session, withLoading, reservePriceNight, maxBidders]);

  const handlePlaceBid = useCallback(async () => {
    if (!session || !contractAddress) return;
    await withLoading('Placing bid (proving + submitting)…', async (setStatus) => {
      let secret = loadSecret('bidder', contractAddress);
      if (!secret) {
        secret = generateSecret();
        saveSecret('bidder', contractAddress, secret);
      }
      await placeBid(session, contractAddress, Number(bidAmountNight), userAddressFromSession(session), secret);

      setStatus('Waiting for indexer…');
      const state = await fetchAuctionState(session, contractAddress);
      setAuctionState(state);
    });
  }, [session, contractAddress, withLoading, bidAmountNight]);

  const handleCloseAuction = useCallback(async () => {
    if (!session || !contractAddress) return;
    const secret = loadSecret('seller', contractAddress);
    if (!secret) { setError('Seller secret not found.'); return; }
    await withLoading('Closing auction…', async (setStatus) => {
      await closeAuction(session, contractAddress, secret);
      setStatus('Waiting for indexer…');
      const state = await fetchAuctionState(session, contractAddress);
      setAuctionState(state);
    });
  }, [session, contractAddress, withLoading]);

  const handleRevealPrice = useCallback(async () => {
    if (!session || !contractAddress) return;
    const secret = loadSecret('seller', contractAddress);
    if (!secret) { setError('Seller secret not found.'); return; }
    await withLoading('Revealing reserve price…', async (setStatus) => {
      await revealPrice(session, contractAddress, Number(reservePriceNight), secret);
      setStatus('Waiting for indexer…');
      const state = await fetchAuctionState(session, contractAddress);
      setAuctionState(state);
    });
  }, [session, contractAddress, withLoading, reservePriceNight]);

  const handleClaimItem = useCallback(async () => {
    if (!session || !contractAddress) return;
    const secret = loadSecret('bidder', contractAddress);
    if (!secret) { setError('Bidder secret not found. Place a bid first.'); return; }
    await withLoading('Claiming item (proving + submitting)…', async (setStatus) => {
      await claimItem(session, contractAddress, userAddressFromSession(session), secret);
      setStatus('Waiting for indexer…');
      const state = await fetchAuctionState(session, contractAddress);
      setAuctionState(state);
    });
  }, [session, contractAddress, withLoading]);

  const handleClaimProceeds = useCallback(async () => {
    if (!session || !contractAddress) return;
    const secret = loadSecret('seller', contractAddress);
    if (!secret) { setError('Seller secret not found.'); return; }
    await withLoading('Claiming proceeds…', async (setStatus) => {
      await claimProceeds(session, contractAddress, userAddressFromSession(session), secret);
      setStatus('Waiting for indexer…');
      const state = await fetchAuctionState(session, contractAddress);
      setAuctionState(state);
    });
  }, [session, contractAddress, withLoading]);

  const reset = useCallback(() => {
    setContractAddress('');
    setAuctionState(null);
    setError('');
  }, []);

  if (walletInstalled === false) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold mb-4">1AM Wallet Required</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          Please install the <strong>1AM</strong> browser extension for Midnight Network.
        </p>
        <a
          href="https://1am.xyz"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Install 1AM Wallet
        </a>
      </div>
    );
  }

  const state = auctionState;

  return (
    <div className="mx-auto max-w-lg w-full">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Private Reserve Auction</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Hidden reserve price, public bids, private bidder identities
        </p>
      </div>

      {!session && (
        <div className="text-center">
          <button
            onClick={connectWallet}
            disabled={connecting}
            className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-900 px-8 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {connecting ? 'Connecting…' : 'Connect 1AM Wallet'}
          </button>
        </div>
      )}

      {session && (
        <div className="mb-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="font-medium text-zinc-500 uppercase tracking-wider mb-2">Wallet</p>
          <p className="text-zinc-700 dark:text-zinc-300 truncate">
            <span className="text-zinc-400">Unshielded: </span>
            {session.unshieldedAddress}
          </p>
          <p className="text-zinc-500 mt-1">
            Network: <span className="font-medium text-zinc-700 dark:text-zinc-300">{session.network.networkId}</span>
          </p>
        </div>
      )}

      {session && !contractAddress && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => setRole('seller')}
            className={`rounded-lg border p-5 text-left transition ${
              role === 'seller'
                ? 'border-zinc-900 dark:border-white bg-zinc-100 dark:bg-zinc-800'
                : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
            }`}
          >
            <p className="text-sm font-semibold">I&apos;m a Seller</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Deploy an auction with a hidden reserve price
            </p>
          </button>
          <button
            onClick={() => setRole('bidder')}
            className={`rounded-lg border p-5 text-left transition ${
              role === 'bidder'
                ? 'border-zinc-900 dark:border-white bg-zinc-100 dark:bg-zinc-800'
                : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
            }`}
          >
            <p className="text-sm font-semibold">I&apos;m a Bidder</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Place private bids on an existing auction
            </p>
          </button>
        </div>
      )}

      {/* Deploy form — seller only, no contract yet */}
      {session && !contractAddress && role === 'seller' && !busy && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
              Reserve price (NIGHT)
              <input
                type="number"
                min={0.000001}
                step={0.01}
                value={reservePriceNight}
                onChange={(e) => setReservePriceNight(e.target.value)}
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
              Max bidders
              <input
                type="number"
                min={1}
                value={maxBidders}
                onChange={(e) => setMaxBidders(e.target.value)}
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
          </div>
          <button
            onClick={handleDeploy}
            className="w-full h-11 rounded-full bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Deploy Auction
          </button>
        </div>
      )}

      {/* Bidder hint — no contract yet */}
      {session && !contractAddress && role === 'bidder' && !busy && (
        <div className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-8">
          <p>Paste a deployed auction contract address to participate.</p>
          <p className="mt-2">Ask the seller for the contract address.</p>
        </div>
      )}

      {/* Auction state + actions */}
      {session && contractAddress && (
        <div className="space-y-6">
          <div className="flex items-center justify-center gap-2 text-xs">
            <span className="rounded-full border border-zinc-200 dark:border-zinc-800 px-3 py-1 text-zinc-500 dark:text-zinc-400">
              Viewing as <strong className="text-zinc-700 dark:text-zinc-300 capitalize">{role}</strong>
            </span>
            <button
              onClick={reset}
              className="text-zinc-400 underline underline-offset-2 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              switch role
            </button>
          </div>

          {state && (
            <div className="rounded-lg border border-zinc-200 p-6 text-center dark:border-zinc-800">
              <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Auction State</p>
              <p className="text-2xl font-bold tracking-tight">
                {STATE_LABELS[state.auctionState] ?? state.auctionState}
              </p>
              <div className="mt-4 flex justify-center gap-6 text-sm text-zinc-500 dark:text-zinc-400">
                <span>Bids: <strong className="text-zinc-700 dark:text-zinc-300">{state.bidCount}</strong> / {state.maxBidders}</span>
                {state.highestBidNight > 0 && (
                  <span>Highest: <strong className="text-zinc-700 dark:text-zinc-300">{state.highestBidNight}</strong> NIGHT</span>
                )}
              </div>
              {state.publicPriceNight > 0 && (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Reserve: <strong className="text-zinc-700 dark:text-zinc-300">{state.publicPriceNight}</strong> NIGHT
                </p>
              )}
            </div>
          )}

          {/* Seller actions */}
          {role === 'seller' && (
            <div className="space-y-3">
              {state?.auctionState === 'OPEN' && (
                <button
                  onClick={handleCloseAuction}
                  disabled={busy}
                  className="w-full h-12 rounded-full bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {busy ? statusMessage || 'Processing…' : 'Close Auction'}
                </button>
              )}
              {state?.auctionState === 'CLOSED' && (
                <>
                  <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Reveal reserve price (NIGHT) — must match deploy value
                    <input
                      type="number"
                      min={0.000001}
                      step={0.01}
                      value={reservePriceNight}
                      onChange={(e) => setReservePriceNight(e.target.value)}
                      className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </label>
                  <button
                    onClick={handleRevealPrice}
                    disabled={busy}
                    className="w-full h-12 rounded-full bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    {busy ? statusMessage || 'Processing…' : 'Reveal Reserve Price'}
                  </button>
                </>
              )}
              {state?.auctionState === 'SETTLED' && (
                <button
                  onClick={handleClaimProceeds}
                  disabled={busy}
                  className="w-full h-12 rounded-full bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {busy ? statusMessage || 'Processing…' : 'Claim Proceeds'}
                </button>
              )}
            </div>
          )}

          {/* Bidder actions */}
          {role === 'bidder' && (
            <div className="space-y-3">
              {state?.auctionState === 'OPEN' && (
                <>
                  <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Your bid (NIGHT)
                    <input
                      type="number"
                      min={0.000001}
                      step={0.01}
                      value={bidAmountNight}
                      onChange={(e) => setBidAmountNight(e.target.value)}
                      className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </label>
                  <button
                    onClick={handlePlaceBid}
                    disabled={busy}
                    className="w-full h-12 rounded-full bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    {busy ? statusMessage || 'Processing…' : 'Place Bid'}
                  </button>
                </>
              )}
              {state?.auctionState === 'SETTLED' && state.highestBidNight >= state.publicPriceNight && (
                <button
                  onClick={handleClaimItem}
                  disabled={busy}
                  className="w-full h-12 rounded-full bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {busy ? statusMessage || 'Processing…' : 'Claim Item (pays reserve → public)'}
                </button>
              )}
            </div>
          )}

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-zinc-500">
              <span className="text-zinc-400">Contract: </span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300 break-all">{contractAddress}</span>
            </p>
          </div>

          <div className="flex justify-center gap-3">
            <button
              onClick={() => void refresh()}
              disabled={busy}
              className="text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-600 disabled:opacity-40 dark:hover:text-zinc-300"
            >
              refresh
            </button>
            <button
              onClick={reset}
              disabled={busy}
              className="text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-600 disabled:opacity-40 dark:hover:text-zinc-300"
            >
              new contract
            </button>
          </div>
        </div>
      )}

      {busy && !contractAddress && (
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-400 animate-pulse" />
            {statusMessage}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
