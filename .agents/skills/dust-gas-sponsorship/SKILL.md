---
name: dust-gas-sponsorship
description: Let one wallet pay Midnight transaction fees for another wallet's transaction, so users with zero DUST can transact from their first click. Use whenever a dApp onboards new users, offers a free tier, or covers usage for its users: the two-sided sponsorship flow (user proves and binds, sponsor adds DUST and submits), the sponsor service and its acceptance policy, sponsor economics and monitoring, and the hosted alternatives (NIGHTGATE, Capacity Exchange).
author: Kali-Decoder
---

## Midnight DUST Gas Sponsorship

Every transaction on Midnight pays its fee in DUST, and DUST only comes
from NIGHT that was registered for DUST generation, held over time. A
brand-new wallet has zero DUST and cannot submit a single transaction,
including one that moves no funds. DUST sponsorship removes that wall:
the user authorizes the action, a sponsor wallet pays the DUST fee, and
the two roles never mix. The result is a gasless experience for the
user and a fee the sponsor controls.

**What this skill produces:**

- A sponsored call: the user proves and binds a transaction with zero
  DUST, the sponsor attaches the fee and submits it
- A sponsor service with an acceptance policy: auth, rate limits, a
  per-request cap, and a check that the transaction targets your
  contract
- A sized sponsor wallet: enough registered NIGHT, enough DUST UTXOs
  for the throughput you need, and monitoring that warns before it
  runs dry
- A decision between running your own sponsor, using hosted
  sponsorship (NIGHTGATE), or letting users pay in another token
  (Capacity Exchange)

**Safety note (do not hide from the user):**

- Build-purpose only. Learn sponsorship on **Preprod or Preview**
  with test NIGHT (tNIGHT) from the faucet before touching Mainnet.
  A production skill would need an audit first.
- The sponsor wallet holds real NIGHT and pays real fees. Keep its
  seed in an environment variable on the server, never in code, chat,
  logs, or screenshots.
- Never authenticate a caller by who paid the fee. See section 2.

**Ledger 9 note:** this skill is written for Ledger 9: Wallet SDK
2.0.1, Midnight.js 5.0.1 in the reference example (the live
`references/versions.json` pin is 5.0.2; check it before pinning),
indexer 4.4.101, Compact toolchain 0.36.1. The reference example
predates nothing: the official docs guide was published 24 Nov 2026.
Older sponsorship write-ups (May 2026, Wallet SDK 1.x) teach the same
two-phase mechanism but pre-Ledger 9 call shapes; do not mix their
code with this skill's.

**Verified sources (checked 24 Nov 2026):**

- Sponsor transaction fees with DUST (official docs guide, published
  2026-11-24): https://docs.midnight.network/guides/dust-sponsorship
- Reference implementation, `examples/private-party` in
  midnight-examples (read 24 Nov 2026): `src/sponsor.ts`,
  `src/wallet.ts`, `docs/SPONSORSHIP.md`,
  `scripts/sponsor-service.ts`, `src/test/sponsorship.test.ts`
- Wallet SDK reference snippet:
  https://github.com/midnightntwrk/midnight-wallet/blob/main/packages/docs-snippets/src/snippets/dust-sponsorship.ts
- DUST architecture: https://docs.midnight.network/concepts/dust-architecture
- Managing DUST for transaction fees:
  https://docs.midnight.network/guides/manage-dust
- A visual guide to DUST sponsorship (Midnight blog):
  https://midnight.network/blog/dust-sponsorship-on-midnight
- Building a seamless user journey through abstraction (Midnight
  blog, Capacity Exchange): https://midnight.network/blog/seamless-user-journey-through-abstraction
- State of the Network, August 2026 (Capacity Exchange live):
  https://midnight.network/blog/state-of-the-network-august-2026
- NIGHTGATE: https://odatano.dev/ and
  https://api.preview.odatano.dev/m402

**NEEDS CHECK before this skill ships:**

- Capacity Exchange (section 10): no public integration surface was
  found on 24 Nov 2026, no SDK, repo, or integration guide. The skill
  teaches what it is and that it works on supported apps only. Do not
  present an integration path for it until Sundae Labs publishes one.
- NIGHTGATE versions in section 9 (@odatano/nightgate 0.46.3,
  @odatano/nightgate-mcp 0.23.1) are from odatano.dev on 24 Nov 2026.
  Re-check before teaching them as current.
- Gero's developer sponsorship API is a pilot (section 11). No
  endpoint or docs were found; do not teach it as a live integration.
- The per-transaction fee range in section 7 (~0.001-0.01 DUST) is
  Preview-era guidance from May 2026. The one measured Ledger 9
  number in this skill is the private-party checkIn at ~0.047 DUST
  on a local devnet. Measure on your own network before budgeting.

**Relationship to other skills:**

- `dust/` covers DUST mechanics: registration, parameters, fee
  estimation, multi-transaction locking, cNIGHT, and the Ledger 9
  reset. Read it first if you have not worked with DUST. This skill
  covers only who pays, not how DUST works.
- `midnight-js/` covers the providers and the wallet SDK this skill
  builds on.
- `compact/` covers writing the contract whose authorization rule
  makes sponsorship safe (section 2).
- `dynamic-midnight-wallet/` covers the Dynamic abstraction path,
  which configures a DUST interface for passkey and social-login
  users.
- `gero-wallet/` covers in-wallet DUST generation and Gero's
  sponsored-fee support.
- `indexer/` covers looking a submitted transaction up by its
  ledger hash.

---

## Workflow

1. Confirm the user cannot pay: a wallet with unregistered NIGHT, or
   no NIGHT at all, has zero DUST (section 1)
2. Make the contract authenticate by secret, never by fee payer
   (section 2)
3. Build the two sides: user proves and binds, sponsor adds DUST and
   submits (sections 3-5)
4. Put the sponsor behind a service with an acceptance policy
   (section 6)
5. Size the sponsor wallet and monitor it (section 7)
6. Run the reference example to see the whole flow, including the
   negative tests (section 8)
7. Decide whether to self-host, use NIGHTGATE, or offer Capacity
   Exchange (sections 9-10)

## 1) The problem sponsorship solves

DUST is a shielded, non-transferable resource. It cannot be bought,
sent, or airdropped. There is no `transferDUST()` call. It is
generated only by NIGHT that was registered for DUST generation, and
the ledger keeps a Registration Table linking NIGHT public keys to
DUST public keys. A DUST UTXO is created only when a NIGHT UTXO is
created *and* its key has an entry in that table.

So a wallet can hold plenty of NIGHT and still be unable to submit a
single transaction. If its key was never registered, its NIGHT
generates no DUST, and with zero DUST there is no fee it can offer,
even for a transaction that moves no funds at all. That is the
cold-start problem, and sponsorship is the fix: it is the only
mechanism that pays fees for another wallet.

One bootstrap exists without a sponsor, worth knowing so you can tell
when sponsorship is the right tool. A first-time `DustRegistration`
carries an `allowFeePayment` field, a Speck-denominated allowance, not
a boolean flag, which lets the registration draw on retroactively
generated DUST to pay for itself. It is limited: only not-yet-
generating NIGHT UTXOs spent in the transaction's guaranteed section
count toward it, the allowance cannot exceed what those inputs
virtually accrued, and it covers that one transaction. Sponsorship
covers everything else.

Units, so the numbers in the logs make sense: 1 NIGHT = 10^6 STAR,
1 DUST = 10^15 SPECK. Every DUST and NIGHT amount from the ledger,
the wallet SDK, and the indexer is in those units.

## 2) The principle: who pays is not who is authorized

| Role | Holds | Can do | Cannot do |
| --- | --- | --- | --- |
| User | The contract secret, zero DUST | Prove and authorize the action | Pay the fee |
| Sponsor | NIGHT registered for DUST generation | Add a DUST fee offer and submit | Act as the user, alter the sealed transaction, or reach the user's secret |

Three mechanisms enforce the separation:

1. **The smart contract authenticates by secret, not by fee payer.**
   In the reference example, the `checkIn` circuit requires
   `commitAddress(_secret, address.bytes)` to match the RSVP on the
   ledger. Only a caller who knows the secret can produce a valid
   proof, so the sponsor's money buys nothing but the fee.
2. **The user binds the transaction first.** The user proves,
   balances its own side, signs, and finalizes before the handoff.
   What crosses the wire is a bound `FinalizedTransaction` the
   sponsor can add a DUST fee offer to, and nothing else.
3. **The network rejects modified transactions.** A cryptographic
   binding ties the contract call to the transaction. Change
   anything after finalization, and verification fails.

> **Never authenticate with `ownPublicKey()`.** It is a witness: the
> prover's machine chooses its return value, and the protocol never
> checks it against the signing wallet. Any check built on it is
> bypassable, by the sponsor or by anyone else. Authorization must
> come from proving knowledge of a secret, as the reference contract
> does. Use `ownPublicKey()` only to route tokens to the caller.
> `ownPublicKey()` always returns the prover's key, not the
> sponsor's, which is also why it is the wrong key for routing DUST
> change back to the sponsor.

## 3) The two-sided flow

The split is enforced by one option, `tokenKindsToBalance`. Omit it
and it defaults to `'all'`, the ordinary self-paying path that
`balanceTx` uses.

| Party | Method | `tokenKindsToBalance` | Pays for |
| --- | --- | --- | --- |
| User | `balanceUnboundTransaction` | `['shielded', 'unshielded']` | Its own value |
| Sponsor | `balanceFinalizedTransaction` | `['dust']` | The transaction fee |

The user is always the prover, so the secret that authenticates the
caller never reaches the sponsor. If the call moves user value, like
the reference example's entry fee, that value still comes from the
user's balance. Sponsorship covers fees, not funds.

Order matters, and it is the whole security argument. The user
proves, balances, signs, and finalizes **first**:

| Guarantee | Why it holds |
| --- | --- |
| The sponsor cannot alter the call | The transaction is bound before handoff; the network rejects modifications |
| The sponsor cannot reach the secret | The user generated the proof; only the proof travels |
| The sponsor cannot act as the user | The contract authenticates by secret, which the sponsor does not hold |
| The user cannot spend the sponsor's funds | The sponsor balances only `['dust']`, signs its own additions, and applies policy first |
| DUST cannot be extracted from the sponsor | DUST is not transferable; it can only be spent on fees the sponsor approves |

If the user hands over an unbalanced or unsigned transaction, the
receiving side could reshape it. Balance, sign, and finalize on the
user's side before anything leaves the user's machine.

## 4) The user side: prove, balance, bind

From `src/sponsor.ts` in the reference implementation. The hex
string this returns is the network boundary: in production this
function runs where the user's keys live, such as a browser wallet.

```ts
export async function prepareSponsoredCall<
  C extends Contract.Any,
  PCK extends Contract.ProvableCircuitId<C>,
>(
  logger: Logger,
  user: MidnightWalletProvider,
  providers: PartyProviders,
  call: Ledger9CallTxOptionsWithPrivateStateId<C, PCK>,
): Promise<string> {
  const unsubmitted = await createUnprovenCallTx<C, PCK>(providers, call);

  // Proving happens here, on the user's side, which is why the secret
  // that authenticates the caller never reaches the sponsor.
  // Midnight.js 5 proof providers take and return era-tagged
  // transaction handles.
  const unboundTx = await providers.proofProvider.proveTx(unsubmitted.private.unprovenTx);

  // Balance only the user's own value side (no DUST), sign, and bind.
  const finalized = await user.balanceOwnValueAndFinalize(unboundTx);

  return toHex(finalized.serialize());
}
```

Note what is not here: no DUST, no fee estimation, no sponsor keys.
A wallet with zero DUST can run every line. Inside
`balanceOwnValueAndFinalize` (`src/wallet.ts`), the wallet calls
`balanceUnboundTransaction` with `tokenKindsToBalance:
['shielded', 'unshielded']`, then `signRecipe`, then
`finalizeRecipe`. The method takes an era-tagged
`LedgerTransaction<'Unbound'>` handle and a TTL that defaults to one
hour.

The user needs a proof server and their own private inputs. They do
not need DUST.

## 5) The sponsor side: attach DUST, submit

From `src/sponsor.ts`. Typically a small backend service, which can
apply acceptance policy, such as rate limits and allowlists, before
spending anything.

```ts
export async function sponsorAndSubmit(
  logger: Logger,
  sponsor: MidnightWalletProvider,
  userTxHex: string,
): Promise<string> {
  // The marker triple matches FinalizedTransaction =
  // Transaction<SignatureEnabled, Proof, Binding>.
  const userTx = Transaction.deserialize<SignatureEnabled, Proof, Binding>(
    'signature',
    'proof',
    'binding',
    fromHex(userTxHex),
  );

  // Attach a DUST fee offer paid by the sponsor, then submit.
  const sponsored = await sponsor.addDustFeesAndFinalize(userTx);

  const txId = await sponsor.submitTx(sponsored);
  return txId;
}
```

Inside `addDustFeesAndFinalize` (`src/wallet.ts`), the wallet calls
`balanceFinalizedTransaction` with `tokenKindsToBalance: ['dust']`,
then `signRecipe`, then `finalizeRecipe`. The sponsor is a payer,
never an author.

Copy the deserialize call exactly: reconstructing the user's
transaction needs explicit type arguments, because the marker triple
alone infers a wider type that is not assignable to
`FinalizedTransaction`.

The sponsor needs NIGHT that is *registered for DUST generation*.
Plain NIGHT is not enough, an unregistered sponsor is just as stuck
as the user it is trying to help.

## 6) The sponsor service

The reference example ships the sponsor as a small HTTP service
(`scripts/sponsor-service.ts`): `GET /health` and `POST /sponsor`
taking `{ "tx": "<hex>" }`. The bundled service is a shape, not a
production service: it does no authentication, no rate limiting, no
per-request cap, and no check that the transaction targets your
contract. Add all four before the endpoint is reachable:

- **Authenticate** the caller, so only your dApp's users can ask
  for sponsorship.
- **Rate-limit** per user, so one user cannot burn the sponsor's
  DUST on repeat calls.
- **Cap** what the service will pay per request, and reject anything
  above it.
- **Check the transaction targets your own contract** before paying
  for it, so the service cannot be used to subsidize arbitrary
  transactions.

Do not let a transaction sit in a queue on the sponsor's side. The
real deadline is the intent TTL fixed when the transaction is
constructed, not the `ttl` passed on the user's balancing call, that
one is inert once `'dust'` is excluded. A queued transaction can
expire before the sponsor touches it.

## 7) Sponsor economics

Full content: [references/sponsor-economics.md](references/sponsor-economics.md). It covers cost model, pricing, abuse limits, and budget monitoring for a sponsor. Open it when you reach this step.

## 8) Run the reference example

In `examples/private-party`, Dave is a party guest who holds NIGHT
for the entry fee but never registered for DUST generation, so his
DUST balance is exactly zero. Alice, the organizer, sponsors her
guests.

```bash
git clone https://github.com/midnightntwrk/midnight-examples.git
cd midnight-examples
yarn install && yarn compile
cd examples/private-party

yarn env:up             # start the local environment
yarn wait:dust          # wait until the sponsor wallet has generated DUST
yarn test:sponsorship   # run the sponsored flow, including the negative cases
yarn sponsor:serve      # or run the sponsor as an HTTP service
```

| File | What it contains |
| --- | --- |
| `src/sponsor.ts` | `prepareSponsoredCall` (user side) and `sponsorAndSubmit` (sponsor side) |
| `src/wallet.ts` | The role-specific balancing methods |
| `src/test/sponsorship.test.ts` | Security validation: the sponsored happy path, plus proof that the payer cannot act and the actor cannot pay |
| `scripts/sponsor-service.ts` | The sponsor as a small HTTP service |

The suite proves the premise before it demonstrates the fix: it
asserts that Dave holds NIGHT, that every one of his UTXOs reports
`registeredForDustGeneration === false`, and that his DUST balance
is `0n`. It then shows him RSVPing and checking in anyway, and
re-asserts his DUST is still exactly zero afterwards. The headline
test prints one transaction, two payers: Dave's NIGHT falls by
exactly the 5 STAR entry fee, his DUST never moves off zero, and
Alice's DUST is what fell. The negative test has Alice attempt
`checkIn` with Dave's address and her own secret; it fails with
"You are not on the list".

To adopt the pattern, swap in your own smart contract. Your contract
supplies the authorization rule; the two functions and their
ordering stay the same.

## 9) Hosted path: NIGHTGATE

Run your own sponsor when the fees are core to your product and you
want full control of policy and cost. Use hosted sponsorship when
you want gasless UX without operating a sponsor wallet.

NIGHTGATE, by ODATANO, exposes Midnight as an OData V4 API with
sponsored transactions: anchor, attest, and prove actions run with
no NIGHT or DUST needed from the caller. Packages
`@odatano/nightgate` (0.46.3) and `@odatano/nightgate-mcp`
(0.23.1), versions as of 24 Nov 2026. Networks: Midnight Preprod
and Preview; mainnet soon. A key made by signing in with a Cardano
wallet starts free, 300 calls for 90 days. A forwarded call costs
1, an indexer subscription 5; metadata and the verify lane are
free. Top-ups are paid with tNIGHT through an m402 payment vault on
Midnight, built with `@odatano/nightgate-tx` on the user's machine;
with a key, the platform sponsor pays the tDUST of the vault's
`deposit` and `pay` calls. The MCP server carries 28 tools plus 9
for analytics, including `sponsor_swap`, and scoped, budgeted
bearer tokens for AI agents instead of a full user key.

NIGHTGATE is the hosted path for document anchoring, attestations,
and shielded transfers. It is not a replacement for the
self-hosted flow when your dApp needs its own contract calls
sponsored under its own policy.

## 10) Pay in another token: Capacity Exchange

The Capacity Exchange, built by Sundae Labs and live since August
2026, lets users settle transaction fees on supported Midnight
applications using USDM, Moneta's 1:1 USD-backed stablecoin,
instead of DUST. The exchange converts the alternative token
payment into the network's required execution resource behind the
scenes, through what Sundae Labs describes as a decentralized
market of sponsors. Users with only a passkey or social login can
transact, their DUST costs sponsored by the dApp itself or paid
for with assets from other chains.

What this means for a builder today: if your app is supported, your
users can pay fees in USDM without holding NIGHT or DUST. What it
does not mean: there is no public integration surface verified for
this skill, no SDK, repo, or integration guide was found on 24 Nov
2026, so this skill cannot teach adding Capacity Exchange support
to an app yet. See the NEEDS CHECK at the top.

## 11) Wallet-side sponsorship: Gero

Gero Wallet 2.7.1 added sponsored DUST fees and USDM support: one
Midnight wallet can use its DUST to sponsor fees for another. A
pilot lets developers sponsor fees through an API, but no endpoint
or documentation was found on 24 Nov 2026, so treat the API as a
pilot, not a live integration. The `gero-wallet/` skill covers
Gero's Ledger 9 status, which is itself still NEEDS CHECK.

## 12) Troubleshooting

Submission failures surface as `1010: Invalid Transaction: Custom
error: N`.

| Code | Name | Fix |
| --- | --- | --- |
| `170` | `InvalidDustSpendProof` | Wait for the sponsor wallet to sync, then add the DUST fee offer again and submit; a wallet that pays the fee before it has synced every DUST event gets this rejection |
| `173` | `InsufficientDustForRegistrationFee` | Wait for generation before registering; see `waitForGeneratedDust` in the wallet SDK |
| `196` | `DustDoubleSpend` | Stale wallet view reused spent DUST; resync the sponsor wallet and rebuild |

| Symptom | Fix |
| --- | --- |
| `could not balance dust` on the sponsor side | The sponsor's DUST does not cover fee plus overhead. Check the wait-for-dust step succeeded, and remember DUST accrues over time rather than appearing at once |
| The user's balancing step fails | If the circuit moves value, the user must still be able to fund that. Sponsorship pays the fee, not the payload |
| The sponsored transaction expires | The intent TTL fixed at construction is the real deadline. Do not queue transactions on the sponsor's side |
| Nondeterministic balancing failures in tests | Suites sharing one devnet and one sponsor wallet must not run in parallel; concurrent spends of the same UTXOs conflict |

## 13) Common mistakes

- **Including `'dust'` in the user's `tokenKindsToBalance`.**
  Fails if the user has no DUST, which is the whole point of
  sponsorship. The user balances `['shielded', 'unshielded']` only.
- **The sponsor re-balancing token types the user already settled.**
  `['dust', 'shielded', 'unshielded']` on the sponsor side causes
  double-spend errors. The sponsor balances `['dust']` only.
- **No TTL.** Always pass a TTL on both steps. Without it, a slow
  proof server or congestion can leave an expired transaction and a
  consumed DUST UTXO.
- **Treating DUST as a transferable token.** There is no
  `transferDUST()`. Sponsorship is the only way to cover fees for
  another wallet.
- **Authenticating with `ownPublicKey()`.** It is a prover-chosen
  witness, bypassable by design. Authenticate by secret (section 2).
- **Moving the sponsor's NIGHT.** Every spend of a backing NIGHT
  UTXO starts its DUST decaying. Consolidation included.
- **Shipping the bundled sponsor service as is.** It has no auth,
  no rate limits, no cap, and no contract-target check. Add all
  four (section 6).
- **Letting a contract hold the fee logic.** Smart contracts do not
  hold or spend DUST in the current protocol. Sponsorship is a
  wallet-side mechanism, always.
