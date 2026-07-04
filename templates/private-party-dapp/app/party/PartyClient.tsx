'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  checkIn,
  claimFees,
  closeEntry,
  deployParty,
  fetchPartyState,
  rsvp,
  startParty,
  userAddressFromSession,
  ZK_PATH,
} from '@/lib/party';
import { createConnectedSession, detectWallet, type ConnectedSession } from '@/lib/midnight';
import { generateSecret, loadSecret, saveSecret } from '@/lib/secret';

type Role = 'organizer' | 'attendee';

export default function PartyClient() {
  const [session, setSession] = useState<ConnectedSession | null>(null);
  const [role, setRole] = useState<Role>('attendee');
  const [contractAddress, setContractAddress] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [entryFee, setEntryFee] = useState('5');
  const [status, setStatus] = useState<Awaited<ReturnType<typeof fetchPartyState>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session || !contractAddress) return;
    setStatus(await fetchPartyState(session.config.indexerUri, contractAddress));
  }, [session, contractAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const organizerSecret = useMemo(
    () => (contractAddress ? loadSecret('organizer', contractAddress) : null),
    [contractAddress, status],
  );

  const attendeeSecret = useMemo(
    () => (contractAddress ? loadSecret('attendee', contractAddress) : null),
    [contractAddress, status],
  );

  async function onConnect() {
    setBusy(true);
    setError(null);
    setMessage(null);
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
    setMessage(null);
    try {
      const secret = generateSecret();
      const addr = await deployParty(
        session,
        Number(partySize),
        Number(entryFee),
        secret,
      );
      setContractAddress(addr);
      saveSecret('organizer', addr, secret);
      setMessage(`Party deployed. Share this address with guests: ${addr}`);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onRsvp() {
    if (!session || !contractAddress) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      let secret = loadSecret('attendee', contractAddress);
      if (!secret) {
        secret = generateSecret();
        saveSecret('attendee', contractAddress, secret);
      }
      await rsvp(session, contractAddress, userAddressFromSession(session), secret);
      setMessage('RSVP submitted privately — your address is not on-chain yet.');
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onStartParty() {
    if (!session || !contractAddress || !organizerSecret) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await startParty(session, contractAddress, organizerSecret);
      setMessage('Party started — guests can check in.');
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onCheckIn() {
    if (!session || !contractAddress || !attendeeSecret) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await checkIn(session, contractAddress, userAddressFromSession(session), attendeeSecret);
      setMessage(
        'Checked in — unshielded entry fee paid. Your address is now public on the ledger.',
      );
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onCloseEntry() {
    if (!session || !contractAddress || !organizerSecret) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await closeEntry(session, contractAddress, organizerSecret);
      setMessage('Doors closed.');
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onClaimFees() {
    if (!session || !contractAddress || !organizerSecret) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await claimFees(
        session,
        contractAddress,
        userAddressFromSession(session),
        organizerSecret,
      );
      setMessage('Fees claimed to your unshielded address.');
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const canRsvp = status?.partyState === 'NOT_STARTED';
  const canStart =
    status?.partyState === 'NOT_STARTED' || status?.partyState === 'READY';
  const canCheckIn = status?.partyState === 'STARTED' && Boolean(attendeeSecret);
  const canClose = status?.partyState === 'STARTED' && Boolean(organizerSecret);
  const canClaim = status?.partyState === 'DOORS_CLOSED' && Boolean(organizerSecret);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>Private Party</h1>
      <p>
        Attendees RSVP privately. Checking in pays unshielded NIGHT and crosses the{' '}
        <strong>privacy boundary</strong> — guest addresses become public.
      </p>

      {!session ? (
        <button type="button" onClick={onConnect} disabled={busy}>
          Connect 1AM Wallet
        </button>
      ) : (
        <>
          <p>Connected: {session.unshieldedAddress}</p>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <label>
              Role{' '}
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="organizer">Organizer</option>
                <option value="attendee">Attendee</option>
              </select>
            </label>
            <label style={{ flex: 1, minWidth: 280 }}>
              Contract address{' '}
              <input
                style={{ width: '100%' }}
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value.trim())}
                placeholder="Paste deployed contract address"
              />
            </label>
          </div>

          {status ? (
            <section style={{ background: '#f4f4f5', padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}>
              <p>
                <strong>State:</strong> {status.partyState}
              </p>
              <p>
                RSVPs: {status.rsvpCount} / {status.maxListSize} · Checked in: {status.checkedInCount} ·
                Entry fee: {status.entryFee} Stars
              </p>
            </section>
          ) : contractAddress ? (
            <p>Loading party state from indexer…</p>
          ) : null}

          {role === 'organizer' ? (
            <section style={{ display: 'grid', gap: '0.75rem' }}>
              {!contractAddress ? (
                <>
                  <label>
                    Max guests{' '}
                    <input
                      type="number"
                      min={1}
                      value={partySize}
                      onChange={(e) => setPartySize(e.target.value)}
                    />
                  </label>
                  <label>
                    Entry fee (Stars){' '}
                    <input
                      type="number"
                      min={1}
                      value={entryFee}
                      onChange={(e) => setEntryFee(e.target.value)}
                    />
                  </label>
                  <button type="button" onClick={onDeploy} disabled={busy}>
                    Deploy Party Contract
                  </button>
                </>
              ) : (
                <>
                  {organizerSecret ? (
                    <p>Organizer secret stored in this browser.</p>
                  ) : (
                    <p role="alert">
                      Organizer secret missing — deploy from this browser or you cannot manage the party.
                    </p>
                  )}
                  <button type="button" onClick={onStartParty} disabled={busy || !canStart || !organizerSecret}>
                    Start Party
                  </button>
                  <button type="button" onClick={onCloseEntry} disabled={busy || !canClose}>
                    Close Doors
                  </button>
                  <button type="button" onClick={onClaimFees} disabled={busy || !canClaim}>
                    Claim Fees
                  </button>
                </>
              )}
            </section>
          ) : (
            <section style={{ display: 'grid', gap: '0.75rem' }}>
              <button type="button" onClick={onRsvp} disabled={busy || !contractAddress || !canRsvp}>
                RSVP (private)
              </button>
              {attendeeSecret ? (
                <p>Attendee secret stored — use the same browser to check in.</p>
              ) : (
                <p>RSVP generates a secret in this browser; keep it for check-in.</p>
              )}
              <button type="button" onClick={onCheckIn} disabled={busy || !contractAddress || !canCheckIn}>
                Check In (pays entry fee — becomes public)
              </button>
            </section>
          )}

          <button
            type="button"
            onClick={() => void refresh()}
            disabled={busy || !contractAddress}
            style={{ marginTop: '1rem' }}
          >
            Refresh State
          </button>
        </>
      )}

      {message ? <p style={{ color: '#166534' }}>{message}</p> : null}
      {error ? (
        <p role="alert" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      ) : null}
    </main>
  );
}
