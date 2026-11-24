---
name: gero-wallet
description: Use when connecting a Midnight dApp to Gero Wallet, working with the Midnight DApp Connector API through Gero, generating DUST inside Gero from NIGHT or cNIGHT, choosing a proof server (Gero Cloud, local, or Arkhia zkPaaS), reading shielded balances through Gero, or targeting Stagenet. Covers Gero Dashboard 2.7.2, the standard DApp Connector API 4.1.0, in-wallet DUST registration, and the prove-fund-submit transaction flow.
author: Kali-Decoder
---

# Gero Wallet

**Scope:** connect a Midnight dApp to Gero Wallet through the standard Midnight DApp Connector API, read unshielded, shielded, and DUST balances, generate DUST inside the wallet, delegate proof generation to the wallet, and submit transactions. Gero is a multi-chain, non-custodial browser-extension wallet (Cardano-first) and an official Midnight Network partner, open source since 2.7.0. There is no Gero-specific SDK: the dApp talks to Gero through the standard connector, exactly as it talks to 1AM or Lace. What is unique to Gero is the wallet-side story: in-wallet DUST generation from both native NIGHT and cNIGHT, a choice of proof server, and Stagenet as the dev test network.

> **Ledger 9 status (22 Nov 2026): NEEDS CHECK.** The latest Gero release, 2.7.2 (7 Oct 2026), predates the Ledger 9 upgrade (mainnet 6 Nov 2026, Preprod 9 Nov 2026), and its release notes say nothing about Ledger 9. The 2.7.1 notes describe mainnet and Preprod as ledger 8, which is stale now. Midnight docs state a wallet on Wallet SDK 1.x cannot transact on mainnet after the upgrade. **Do not rely on Gero for Ledger 9 mainnet or Preprod until Gero confirms support or ships a newer release.** Check https://github.com/Gero-Labs/gerowallet/releases and the Chrome Web Store listing before presenting Gero as mainnet-ready. This skill is written against the verified 2.7.2 behavior plus the Ledger 9.1 connector and SDK pins; the Gero-side Ledger 9 support is the one unverified load-bearing fact.

**Primary references:**

- Gero Midnight complete guide: https://gerowallet.io/blog/midnight-blockchain-wallet-complete-guide/
- Gero Midnight wallet page: https://gerowallet.io/midnight-wallet/
- Gero Wallet releases: https://github.com/Gero-Labs/gerowallet/releases (2.7.1: https://github.com/Gero-Labs/gerowallet/releases/tag/v2.7.1, 2.7.0: https://github.com/Gero-Labs/gerowallet/releases/tag/v2.7.0)
- Gero repo (Apache 2.0): https://github.com/Gero-Labs/gerowallet
- Chrome Web Store, Gero Dashboard: https://chromewebstore.google.com/detail/gero-dashboard/bgpipimickeadkjlklgciifhnalhdjhe
- Midnight docs, React wallet connect (connector guide): https://docs.midnight.network/guides/react-wallet-connect
- Midnight docs, DApp Connector API release notes (4.1.0): https://docs.midnight.network/relnotes/dapp-connector-api
- Midnight docs, support matrix: https://docs.midnight.network/relnotes/support-matrix
- Midnight docs, Ledger 9 release notes: https://docs.midnight.network/relnotes/ledger-9

**Key architecture notes:**

- Gero implements the **standard Midnight DApp Connector API**. The dApp uses `@midnightntwrk/dapp-connector-api` and the standard Midnight.js providers. There is no Gero npm package to install and no Gero docs site: the connector reference is the Midnight docs plus Gero's release notes.
- Wallets inject `InitialAPI` under `window.midnight`, **each keyed by a freshly generated UUID, not a fixed name**. Enumerate with `Object.values(window.midnight)` and filter by `apiVersion` major (4). **Never hardcode a wallet key.** There is no `window.midnight['gero']` key in any public source.
- Proving is **delegated to the wallet**. Gero implements `getProvingProvider()`: it proves contract circuits (fetching ZK material from the dApp's key-material provider) and the built-in zswap and DUST circuits, on the proof server the user chose. The dApp never sees the proof-server address or credentials.
- DUST is **generated inside the wallet**, not deposited. Registration, deregistration, and destination migration are in-wallet flows (DUST tab), not connector calls. The dApp only reads the balance.
- Gero's test network is **Stagenet**, not Preview. Gero retired Preview in September 2026; Preview relaunched as a new chain on 7 Nov 2026, and whether Gero supports the relaunched Preview is unverified.
- **Private custom-token transfers are live on Stagenet only, not on mainnet.** Do not claim them for mainnet.

**Relationship to other skills:**

- `react-wallet-connector/` is the generic connector foundation: detection, enumeration, the picker, and the `window.midnight` rules. Read it first if you have not built a connector integration before.
- `1am-wallet/` carries the full contract/session depth and uses the shared `references/midnight-session.md` (repo root) this skill reuses. The session code is identical; only the wallet is different.
- `midnight-js/` covers the providers and the wallet SDK.
- `token-transfers/` covers NIGHT pools and units (shielded vs unshielded), and §4 covers DUST mechanics: registration, fee implications, reading the balance, and the Ledger 9 DUST reset. This skill covers only the Gero-side DUST flows.
- `dynamic-midnight-wallet/` covers the Dynamic abstraction path. Gero is one of the external wallets Dynamic itself connects, so the two skills are complementary.
- `indexer/` covers looking a submitted transaction up by its ledger hash.

---

## 1) Install and setup

**Install the extension.** Gero Dashboard 2.7.2, Chrome Web Store, updated 7 Oct 2026. Use the main listing, not the stale "Gero Dashboard (Beta)" listing (v2.5.3, May 2025).

- Main listing: https://chromewebstore.google.com/detail/gero-dashboard/bgpipimickeadkjlklgciifhnalhdjhe
- Download page: https://gerowallet.io/download/

**Browsers.** Chrome, Brave, Edge, AVG Secure Browser (Chromium, Manifest V3). No Firefox, no Safari. Mobile: iOS TestFlight beta, Android on Google Play as "Gero" (Android 11+). The dApp connector is documented for the browser extension only; whether the mobile apps expose a Midnight dApp connector is unverified.

**Create a Midnight wallet.** Gero's onboarding card asks for a blockchain first, then a network: choose Midnight, then mainnet (or the test network you need). The Midnight wallet **derives from the existing Cardano seed** (BIP39), so one backup covers Cardano and Midnight. Keys are generated and stored locally in the extension; Gero never holds a copy.

**Two interfaces, one wallet core.** The full dashboard (portfolio, swaps, staking, governance, dApp connections, settings) and Mini-Gero, a compact wallet in the browser side panel (balances, send, receive, dApp approvals, and a per-site activity card for connected dApps).

**Version check.** Before relying on Gero for a Ledger 9 network, confirm the installed version is newer than 2.7.2 or that Gero has announced Ledger 9 support. See the NEEDS CHECK callout at the top of this skill.

---

## 2) Dependencies

Pin the Ledger 9.1 set. Checked against the Midnight support matrix on 22 Nov 2026. These are the same pins `1am-wallet` §1 uses.

```bash
npm install \
  @midnightntwrk/dapp-connector-api@4.1.0 \
  @midnightntwrk/midnight-js-contracts@5.0.2 \
  @midnightntwrk/midnight-js-types@5.0.2 \
  @midnightntwrk/midnight-js-utils@5.0.2 \
  @midnightntwrk/midnight-js-dapp-connector-proof-provider@5.0.2 \
  @midnightntwrk/ledger-v9@1.0.2 \
  @midnightntwrk/wallet-sdk-facade@5.0.1 \
  @midnight-ntwrk/compact-runtime@0.21.0
```

Notes:

- DApp Connector API 4.1.0 is the current release (5 Nov 2026) under the new `@midnightntwrk` scope. The legacy `@midnight-ntwrk` scope is mirrored only as a transitional alias; do not use it for new code.
- 4.1.0 adds ECDSA signatures in `signData` (`scheme`: `ecdsa_secp256k1_sha256` or `schnorr_bip340`, default schnorr), an `InsufficientFunds` error code, a `./globals` export, and typed `globalThis.midnight`. Whether Gero's connector exposes these 4.1.0 features depends on Gero's reported `apiVersion`, which is unverified; do not assume them.
- Vite needs the WASM and top-level-await setup from `1am-wallet` §1. Copy it; do not improvise the Vite config.

---

## 3) Wallet detection and connection

Follow the `react-wallet-connector` pattern. The extension injects asynchronously, so poll; never assume `window.midnight` exists on first render.

```ts
import "@midnightntwrk/dapp-connector-api"; // side-effect import: augments window.midnight types

// Poll for injection: check every 100ms, give up after ~5s.
async function waitForMidnight(timeoutMs = 5000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (typeof window !== "undefined" && (window as any).midnight) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

// List wallets: enumerate, never hardcode a key.
function listWallets() {
  const injected = (window as any).midnight ?? {};
  return Object.values(injected).filter(
    (w: any) => Number(String(w.apiVersion).split(".")[0]) === 4,
  );
}
```

Rules:

- **Never hardcode a wallet key.** Gero injects under a freshly generated UUID, like every modern connector wallet. The `window.midnight['1am']` fixed-key pattern in the 1AM skill is 1AM-specific and must not be copied for Gero.
- **Filter by `apiVersion` major 4.** Never connect to, or show the user, a wallet outside the supported range.
- **Do not hardcode a name match for Gero.** Gero's `InitialAPI.name` string was not found in any public source. When several wallets are present, render a picker from `listWallets()` showing each wallet's `name` and `icon`, and let the user choose. Render the name and icon as sanitized text only, never with `dangerouslySetInnerHTML`. A case-insensitive "gero" name match is a reasonable fallback, but it is unverified; label it as such if you use it.

**Connect.** `connect(networkId)` returns the ConnectedAPI. The extension prompts the user to authorize.

```ts
const api = await wallet.connect("mainnet");
```

Network IDs and Gero's support status for each:

| Network ID | Gero support |
|---|---|
| `'mainnet'` | Verified (2.7.1: shielded balances on mainnet). Ledger 9 support NEEDS CHECK, see the top callout. |
| `'preprod'` | Verified (2.7.1: connector verified end to end against a live third-party dApp on Preprod, balance read to deposit). Ledger 9 support NEEDS CHECK. |
| `'preview'` | Unverified. Gero retired Preview in Sept 2026; Preview relaunched as a new chain 7 Nov 2026. |
| `'undeployed'` | Unverified (local dev). |
| Stagenet | Gero's test network, but `'stagenet'` is not in the documented connector network ID list. How a dApp targets Stagenet through Gero is unverified. |

**Read config and status after connecting:**

```ts
const config = await api.getConfiguration(); // { networkId, indexer, node, prover URIs }
const { status } = await api.getConnectionStatus(); // 'connected' | 'disconnected'
```

Treat the config URIs as opaque and pass them to the SDK. Never hardcode endpoints.

---

## 4) Session setup

Reuse the shared session file, `references/midnight-session.md` at the repo root (the same file `templates/locker-dapp` ships as `lib/midnight.ts`, and the one `1am-wallet` uses). Do not duplicate the session code in this skill or in your dApp.

```ts
import { dappConnectorNetwork } from "@midnightntwrk/midnight-js-dapp-connector-proof-provider";
// + dappConnectorProofProvider, dappConnectorWalletProviders (see references/midnight-session.md)

const network = dappConnectorNetwork(api); // network + endpoints from the wallet
const proofProvider = dappConnectorProofProvider(api, zkConfigProvider, costModel);
const walletProviders = dappConnectorWalletProviders(api);
providers.config = { networkId, ttlSeconds: 3600 };
```

Why this works with Gero: Gero implements `getProvingProvider()` and `balanceUnsealedTransaction()`, so the standard providers delegate proving and funding to the wallet. Gero verified the full flow end to end against a live third-party dApp on Preprod. Proving runs on the proof server the user chose in Gero (Gero Cloud, local, or Arkhia); the dApp never sees the proof-server address or credentials. See §7.

---

## 5) Addresses and balances

A Midnight wallet has three surfaces: unshielded, shielded, and DUST. Read only what the app needs; shielded reads can trigger a user prompt.

```ts
const { unshieldedAddress } = await api.getUnshieldedAddress();
const shieldedAddresses = await api.getShieldedAddresses(); // bech32m-encoded public keys
const unshielded = await api.getUnshieldedBalances();
const shielded = await api.getShieldedBalances();
const { balance, cap } = await api.getDustBalance();
const dustAddress = await api.getDustAddress();
```

Notes:

- `getShieldedBalances()` works on mainnet and Preprod (verified in the 2.7.1 notes). `getShieldedAddresses()` returns bech32m-encoded public keys.
- **Shielded scan behavior.** If the dApp asks for a private balance before Gero's shielded scan is done, Gero parks the request in the side panel and prompts the user to unlock and share, retry, or decline, instead of failing. The toolbar badge shows pending prompts. Treat a slow shielded response as "the user is being prompted", not as an error. Do not retry aggressively; one parked request is one prompt.
- Preprod balances read **tNIGHT and tDUST**; the screens are identical to mainnet.
- Gero supports sending, receiving, and viewing **any Midnight token, including USDM**, not only NIGHT (2.7.1).
- DUST registration is not a connector call. The user registers inside Gero (DUST tab); the dApp only reads the balance. See §6.

---

## 6) DUST in Gero

This section covers the Gero-side flows. For DUST mechanics (registration, fee implications, reading the balance, the Ledger 9 reset), read `token-transfers/` §4.

**Registration happens in the wallet.** DUST generation is entirely inside Gero: the user opens the DUST tab and registers, deregisters, or migrates the destination on-chain. No bridge, no external portal. Registration needs a pure-ADA UTxO; if the wallet lacks one, **Gero-sponsored collateral** lends one from a shared pool so registration goes through on the first try.

**One battery, two sources.** DUST generates from **native NIGHT on Midnight and from cNIGHT held on Cardano wallets**, feeding a single DUST battery shown as charge, generation rate, and time to full. DUST generated from cNIGHT counts toward fee capacity. **Duplicate detection**: Gero detects duplicate DUST registrations and guides consolidation, so generation is not split across registrations.

**mNIGHT.** cNIGHT after bridging to the Midnight ledger is mNIGHT; it generates DUST as native NIGHT.

**Sponsored fees.** 2.7.1 added sponsored DUST fees. In 2.7.2, when the DUST balance reads zero, Gero's own Send flow offers a fee sponsor instead of blocking the transaction. Who sponsors, the eligibility rules, and any dApp-side surface for sponsorship are not documented by Gero; do not claim a dApp can request sponsorship. One secondary report (thecoinrepublic.com, 2 Oct 2026) says one Midnight wallet can use its generated DUST to sponsor fees for another wallet inside Gero; that is not Gero-confirmed, so treat it as reported, not verified.

**What the dApp does.** Read `getDustBalance()` and `getDustAddress()` (§5). If the user's DUST reads zero, tell the user to open Gero and register or top up; the dApp cannot register for them. DApp-side zero-DUST behavior (what the connector returns, whether a sponsor is offered) is unverified.

---

## 7) Proof servers

Gero gives the user three proof-server options, each behind an **explicit privacy consent screen**. Switchable from the dashboard or the side panel.

| Option | What it is |
|---|---|
| **Gero Cloud** | Zero setup, the default. Proofs run on Gero's infrastructure. |
| **Local proof server** | Docker on the user's own machine; nothing leaves the device. One address per ledger, auto-chosen by network. Gero publishes no image name, command, port, or ledger-profile config for its local server wiring; do not invent a Docker command. The Midnight proof server itself is `midnightntwrk/proof-server:9.0.2` per the support matrix, but Gero's local-server wiring is Gero-specific. |
| **Arkhia zkPaaS** | Third-party proving with the user's own key. |

**What this means for the dApp: nothing to implement.** The dApp delegates proving to the wallet through `getProvingProvider()` (§4) and never sees the proof-server address or credentials. The user's choice affects only where the proofs run, not the dApp's code. The one dApp-visible effect is latency and failure mode: if the chosen proof server is not answering, Gero parks the request and prompts the user instead of failing, and Mini-Gero shows a per-site activity card (prove, fund, submit, with elapsed time, a "proofs done, waiting for the site" state, and the failure reason).

**Cross-Device Proving (XDP).** The user's desktop generates proofs for their phone's Midnight sends over an end-to-end-encrypted channel; Gero's infrastructure sees only ciphertext. Pairs with the GeroWallet iOS beta.

**Shielded proving consent.** Gero asks for explicit approval before Midnight proving operations. Expect a user prompt on the first prove of a session; do not treat the prompt delay as a failure.

**Stale ledger mapping warning.** The 2.7.1 notes say the local proof server uses ledger 8 for mainnet/Preprod and ledger 9 for Stagenet. That mapping predates the Ledger 9 upgrade and is stale now. Do not repeat it as current.

---

## 8) Deploy and call contracts

The flow is the same as `1am-wallet` §6. Gero-specific notes:

- **ZK material comes from the dApp.** When the wallet proves a contract circuit, it fetches the ZK material from the dApp's key-material provider. Serve the `compiler/`, `keys/`, and `zkir/` artifacts from your dApp so the wallet can fetch them. If the wallet cannot fetch them, proving fails; check the key-material provider first.
- **Submissions return the ledger transaction hash**, the same hash the indexer and the official wallet SDK use. Look the transaction up in the indexer immediately; see `indexer/`.
- **Proving runs on the user's proof server** (§7). The dApp never sees the address or credentials, so proof-server problems surface as parked requests and user prompts, not as dApp errors.
- **Deploy through the wallet** the same way as 1AM: build the contract with the session providers from §4, then deploy and call circuits through them. There is no Gero-specific deploy call.

---

## 9) Transaction flow

Prove, fund, submit. The wallet does the funding step.

1. **Prove** via the wallet proof provider (§4). The wallet proves the contract call on the user's chosen proof server.
2. **Fund** with `balanceUnsealedTransaction()`. After the dApp proves a contract call through the wallet, the wallet funds the transaction and pays its DUST fee. This is the step that makes the connector flow work without the dApp holding funds.
3. **Submit.** The submission returns the ledger transaction hash (§8).

For plain token transfers, use the Midnight.js transfer helpers with the session providers; Gero supports any Midnight token, including USDM. For NIGHT pool and unit details (shielded vs unshielded, what `makeTransfer` expects), read `token-transfers/`.

**Zero-DUST behavior.** If the user's DUST balance is zero, the wallet cannot pay the fee. In Gero's own Send flow, 2.7.2 offers a fee sponsor instead of blocking. Whether the connector flow offers a sponsor is unverified; the safe dApp behavior is to surface the zero balance and direct the user to Gero to register or top up (§6).

---

## 10) Networks

| Network | What works in Gero | Notes |
|---|---|---|
| **Mainnet** | Shielded balances, shielded transfers, DUST generation, dApp connector, any-token support. | Live since 2.7.0; shielded balances since 2.7.1. Ledger 9 support NEEDS CHECK (top callout). Private custom-token transfers are NOT live on mainnet. |
| **Preprod** | Connector verified end to end against a live third-party dApp, balance read to deposit. tNIGHT/tDUST. | Ledger 9 support NEEDS CHECK (top callout). |
| **Stagenet** | Gero's test network. Public transfers, private custom-token transfers, DUST balancing, and proving all work. Native NIGHT remains public. Auto-recovery on genesis reset. | Private custom-token transfers are live here and only here. How a dApp targets Stagenet through the connector is unverified: `'stagenet'` is not in the documented network ID list. |
| **Preview** | Gero retired Preview in Sept 2026. | Preview relaunched as a new chain 7 Nov 2026. Whether Gero supports the relaunched Preview is unverified. |

Rules:

- **Always take endpoints from `getConfiguration()` or `dappConnectorNetwork(api)`.** Never hardcode indexer, node, or prover URLs.
- **Do not repeat the 2.7.1 ledger mapping.** It describes mainnet/Preprod as ledger 8 and Stagenet as ledger 9; that was true in September 2026 and is stale after the Ledger 9 upgrade.
- **Do not claim private custom-token transfers on mainnet.** Stagenet only, until the Midnight Foundation announces otherwise.

---

## 11) Wallet API reference

The connector is the standard Midnight DApp Connector API 4.1.0. The tables below list what Gero implements, per the 2.7.1 release notes and the Midnight docs. For the full spec, read the Midnight docs connector guide.

**InitialAPI** (what `window.midnight` exposes per wallet):

| Member | Notes |
|---|---|
| `connect(networkId)` | Returns the ConnectedAPI. Prompts the user to authorize. |
| `name` | Display name. Gero's exact string is unverified; do not hardcode a match. |
| `icon` | Display icon. Render as sanitized text only. |
| `apiVersion` | Version string. Filter on major 4. Gero's reported version is unverified. |

**ConnectedAPI** (what `connect()` returns; Gero-implemented methods):

| Method | Notes |
|---|---|
| `getConfiguration()` | Service URIs (`networkId`, indexer, node, prover). Opaque; pass to the SDK. |
| `getConnectionStatus()` | `{ status: 'connected' \| 'disconnected' }`. |
| `getUnshieldedAddress()` | `{ unshieldedAddress }`. |
| `getShieldedAddresses()` | bech32m-encoded public keys. |
| `getUnshieldedBalances()` | Unshielded balances. |
| `getShieldedBalances()` | Shielded balances. Mainnet and Preprod verified. |
| `getDustBalance()` | `{ balance, cap }`. |
| `getDustAddress()` | The DUST address. |
| `getProvingProvider()` | Delegated proving: contract circuits (ZK material from the dApp) plus built-in zswap and DUST circuits, on the user's proof server. |
| `balanceUnsealedTransaction()` | The wallet funds the transaction and pays its DUST fee. |
| `signData` | Per the 4.1.0 spec: `scheme` `ecdsa_secp256k1_sha256` or `schnorr_bip340`, default schnorr. Whether Gero exposes the 4.1.0 `signData` is unverified. |

**Error codes** include `InsufficientFunds` (4.1.0). Whether Gero surfaces it depends on its reported `apiVersion`, which is unverified.

---

## 12) Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Gero cannot transact on mainnet/Preprod after the Ledger 9 upgrade | Gero 2.7.2 predates Ledger 9; support is unverified | Check for a newer Gero release at https://github.com/Gero-Labs/gerowallet/releases and confirm Ledger 9 support before relying on Gero. Do not work around it in the dApp. |
| `window.midnight` is undefined | Extension not installed, or injection is async | Poll for up to ~5s (§3). If still undefined, direct the user to install Gero Dashboard from the Chrome Web Store. |
| No wallets listed after enumeration | `apiVersion` filter excluded everything, or no Midnight wallet is installed | Log the raw `Object.values(window.midnight)` and check each `apiVersion`. Confirm Gero is installed and unlocked. |
| Wallet connects but `getShieldedBalances()` hangs | Shielded scan still running; Gero parked the request and is prompting the user | Wait. Tell the user to check the Gero side panel and the toolbar badge. Do not retry aggressively. |
| Proof request stalls | Chosen proof server not answering; Gero parked the request | Tell the user to check the Mini-Gero activity card, retry from the side panel, or switch proof servers in Gero settings. |
| `getProvingProvider()` fails | Wallet cannot fetch ZK material from the dApp | Serve `compiler/`, `keys/`, and `zkir/` from the dApp (§8). Check the key-material provider first. |
| Transaction fails with insufficient funds / zero DUST | User has no DUST | Direct the user to Gero's DUST tab to register or top up (§6). The dApp cannot register for them. |
| Stagenet vs Preview confusion | Gero retired Preview; Stagenet is its test network | Use Stagenet for Gero testing. Do not assume Preview works in Gero. |
| Midnight mainnet wallet not syncing | Known 2.7.2 fix: "Midnight mainnet wallets not syncing since 30 September" | Update Gero to 2.7.2 or newer. |
| `ETARGET` or provider errors on session setup | Wrong Midnight.js / connector pins | Re-pin to the §2 set and re-test. Upgrade the connector and Midnight.js packages together. |
| Missing side-effect import | `window.midnight` types not augmented | Add `import "@midnightntwrk/dapp-connector-api"` in `App.tsx` (§3). |

---

## 13) Agent checklist

- [ ] Gero Dashboard installed from the main Chrome Web Store listing (2.7.2 or newer), not the stale Beta listing.
- [ ] Ledger 9 support confirmed with Gero (release notes or announcement) before relying on Gero for mainnet or Preprod.
- [ ] Dependencies pinned to the §2 Ledger 9.1 set, which must equal `references/versions.json` (`npm run check:versions` in this repo).
- [ ] Side-effect import of `@midnightntwrk/dapp-connector-api` present in `App.tsx`.
- [ ] Wallet detection polls for injection, enumerates with `Object.values(window.midnight)`, filters `apiVersion` major 4, and never hardcodes a key or a name match.
- [ ] Session built from `references/midnight-session.md`, not duplicated.
- [ ] Endpoints taken from `getConfiguration()` / `dappConnectorNetwork(api)`, never hardcoded.
- [ ] Shielded reads handled as user-prompted (parked requests), not retried as errors.
- [ ] DUST read via `getDustBalance()`; registration directed to the Gero DUST tab, never assumed to be a connector call.
- [ ] ZK material (`compiler/`, `keys/`, `zkir/`) served from the dApp for wallet proving.
- [ ] No claim of private custom-token transfers on mainnet; no claim of Preview, undeployed, or Stagenet connector support beyond what §3 and §10 state.
- [ ] Troubleshooting table consulted before inventing a workaround.

---

## 14) Related skills

- `react-wallet-connector/` — generic connector foundation: detection, enumeration, picker.
- `1am-wallet/` — full contract/session depth; uses the shared `references/midnight-session.md`.
- `midnight-js/` — providers and the wallet SDK.
- `token-transfers/` — NIGHT pools and units; §4 covers DUST mechanics: registration, fees, balance reads, the Ledger 9 reset.
- `dynamic-midnight-wallet/` — the abstraction path; Gero is one of the external wallets Dynamic connects.
- `indexer/` — transaction lookup by ledger hash.
- `midnight-mip-planning/` — check MIP status before teaching a standard as final (MIP-0015 wallet secrets, MIP-0031 message signing, and MIP-0008 CAIP-2 are adjacent to this skill and all Proposed or Draft).
