---
name: midnight-dust-sponsorship
description: >
  Implement gasless transaction fee sponsorship on Midnight blockchain using DUST.
  Use when building a DApp that needs zero-DUST onboarding, when one wallet must
  pay fees for another, when implementing a sponsor service, when the user mentions
  "gasless", "fee sponsorship", "sponsor transaction", "pay fees for user", or
  "DUST sponsorship" on Midnight. Also use when debugging sponsorship errors like
  "could not balance dust" or when setting up the tokenKindsToBalance split.
  Implement gasless UX on Midnight where one wallet pays DUST fees for another.
  Use when the user mentions gasless, fee sponsorship, sponsor transaction, pay
  fees for user, DUST sponsorship, fee delegation, or free tier on Midnight.
  Use when building a DApp with zero-DUST onboarding, implementing a sponsor
  service or backend that covers user fees, setting up the tokenKindsToBalance
  split between user and sponsor roles, or debugging "could not balance dust"
  errors. Not for DUST generation, wallet setup, contract deployment, or general
  Midnight questions.
license: Apache-2.0
compatibility: Requires Node.js, @midnight-ntwrk/midnight-js-protocol, @midnight-ntwrk/wallet-sdk, and a Midnight proof server
metadata:
  author: midnight-network
  version: "1.0"
  docs: https://docs.midnight.network/guides/dust-sponsorship
  reference-repo: https://github.com/midnightntwrk/example-private-party
allowed-tools: Bash(git:*) Bash(yarn:*) Bash(npm:*) Read Glob Grep
---

# Midnight DUST Gas Sponsorship

Implement gasless transaction fee sponsorship on Midnight. One wallet pays the DUST fee for another without gaining any authority to act on their behalf.

## When to Use

- DApp onboarding where new users have zero DUST
- Free tier or enterprise deployment covering user fees
- Sponsor backend service that pays fees on behalf of users
- Any scenario where fee payer ≠ transaction author

---

## How It Works

Midnight fees are paid in **DUST**, which is *generated* (not transferred) from registered NIGHT. A wallet with unregistered NIGHT has zero DUST and cannot submit any transaction. Sponsorship solves this by splitting one transaction into two halves:

```
┌─────────────────────────────┬─────────────────────────────┐
│       USER HALF             │      SPONSOR HALF           │
│  tokenKindsToBalance:       │  tokenKindsToBalance:       │
│    ['shielded','unshielded']│    ['dust']                 │
│                             │                             │
│  Covers: value, entry fees  │  Covers: network fee only   │
│  Who proves: USER           │  Who proves: nobody         │
│  Who signs: USER            │  Who signs: SPONSOR         │
│  Who binds: USER (first)    │  Who binds: SPONSOR (second)│
└─────────────────────────────┴─────────────────────────────┘
```

The hex string crossing the wire is a `FinalizedTransaction` — already bound and signed by the user. The sponsor can only add a DUST fee offer, nothing else.

See [references/how-it-works.md](references/how-it-works.md) for the full technical explanation of the three security invariant layers, `tokenKindsToBalance` mechanics, and DUST economics.

---

## Implementation

### Step 1: User Side — `prepareSponsoredCall`

Runs wherever the user's keys live (browser wallet, CLI). No DUST needed.

```typescript
import {
  createUnprovenCallTx,
  type CallTxOptionsWithPrivateStateId,
} from '@midnight-ntwrk/midnight-js-contracts';
import {
  type Binding, type Proof, type SignatureEnabled, Transaction,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { fromHex, toHex } from '@midnight-ntwrk/midnight-js-utils';

export async function prepareSponsoredCall<
  C extends Contract.Any,
  PCK extends Contract.ProvableCircuitId<C>,
>(
  logger: Logger,
  user: MidnightWalletProvider,
  providers: PartyProviders,
  call: CallTxOptionsWithPrivateStateId<C, PCK>,
): Promise<string> {
  // 1. Build unsigned tx
  const unsubmitted = await createUnprovenCallTx<C, PCK>(providers, call);

  // 2. Prove — secret used here, never leaves this machine
  const unboundTx = await providers.proofProvider.proveTx(
    unsubmitted.private.unprovenTx,
  );

  // 3. Balance ONLY value side, sign, bind
  const finalized = await user.balanceOwnValueAndFinalize(unboundTx);

  return toHex(finalized.serialize());
}
```

### Step 2: Sponsor Side — `sponsorAndSubmit`

Runs on the sponsor's backend. Takes user's hex, attaches DUST fee, submits.

```typescript
export async function sponsorAndSubmit(
  logger: Logger,
  sponsor: MidnightWalletProvider,
  userTxHex: string,
): Promise<string> {
  // Reconstruct with explicit type args (marker triple alone infers wider type)
  const userTx = Transaction.deserialize<SignatureEnabled, Proof, Binding>(
    'signature', 'proof', 'binding',
    fromHex(userTxHex),
  );

  // Attach DUST fee offer, then submit
  const sponsored = await sponsor.addDustFeesAndFinalize(userTx);
  const txId = await sponsor.wallet.submitTransaction(sponsored);
  return txId;
}
```

### Step 3: Wallet Balancing Methods

```typescript
// USER SIDE — balances own value, excludes DUST
async balanceOwnValueAndFinalize(
  tx: UnboundTransaction,
  ttl: Date = ttlOneHour(),
): Promise<FinalizedTransaction> {
  const recipe = await this.wallet.balanceUnboundTransaction(
    tx,
    { shieldedSecretKeys: this.zswapSecretKeys, dustSecretKey: this.dustSecretKey },
    { ttl, tokenKindsToBalance: ['shielded', 'unshielded'] },
  );
  const signed = await this.wallet.signRecipe(
    recipe, (payload) => this.unshieldedKeystore.signData(payload),
  );
  return await this.wallet.finalizeRecipe(signed);
}

// SPONSOR SIDE — balances only DUST fees
async addDustFeesAndFinalize(
  tx: FinalizedTransaction,
  ttl: Date = ttlOneHour(),
): Promise<FinalizedTransaction> {
  const recipe = await this.wallet.balanceFinalizedTransaction(
    tx,
    { shieldedSecretKeys: this.zswapSecretKeys, dustSecretKey: this.dustSecretKey },
    { ttl, tokenKindsToBalance: ['dust'] },
  );
  const signed = await this.wallet.signRecipe(
    recipe, (payload) => this.unshieldedKeystore.signData(payload),
  );
  return await this.wallet.finalizeRecipe(signed);
}
```

---

## Security Rules

### NEVER use `ownPublicKey()` for authorization

`ownPublicKey()` is a witness — the prover's machine chooses its return value. Any check built on it is bypassable. Authorization must come from proving knowledge of a secret:

```typescript
// WRONG
const caller = ctx.pubKey;

// CORRECT — prove knowledge of secret bound to contract state
commitAddress(_secret, address.bytes)
```

### Follow the exact order

The user **must** prove → balance → sign → finalize → serialize before anything leaves their machine. If the user hands over an unbalanced or unsigned transaction, the receiving side could reshape it.

---

## Running the Reference Example

```bash
git clone https://github.com/midnightntwrk/example-private-party
cd example-private-party && yarn install

yarn env:up             # Start local devnet
yarn wait:dust          # Wait for sponsor DUST generation
yarn test:sponsorship   # Run full test suite
yarn sponsor:serve      # Or run sponsor as HTTP service
```

See [references/test-log.md](references/test-log.md) for actual test output and what each assertion proves.

---

## DApp Integration Checklist

- [ ] Contract authenticates by **secret**, not fee payer
- [ ] `tokenKindsToBalance: ['shielded', 'unshielded']` on user side
- [ ] `tokenKindsToBalance: ['dust']` on sponsor side
- [ ] `Transaction.deserialize<SignatureEnabled, Proof, Binding>(...)` with explicit type args
- [ ] Sponsor has NIGHT **registered for DUST generation**
- [ ] Sponsor endpoint is authenticated and rate-limited
- [ ] Transaction TTL appropriate (don't queue too long)
- [ ] Test negative cases: sponsor cannot act as user

---

## Common Errors

| Code | Name | Fix |
|------|------|-----|
| 170 | `InvalidDustSpendProof` | Regenerate DUST spend proof via proof server |
| 173 | `InsufficientDustForRegistrationFee` | Wait for generation; use `waitForGeneratedDust` |
| 196 | `DustDoubleSpend` | Resync sponsor wallet and rebuild |
| — | `could not balance dust` | Sponsor DUST < fee + overhead; run `yarn wait:dust`; set `additionalFeeOverhead: 1_000n` |

---

## Resources

- [DUST Sponsorship Guide](https://docs.midnight.network/guides/dust-sponsorship)
- [DUST Architecture](https://docs.midnight.network/concepts/dust-architecture)
- [SPONSORSHIP.md](https://github.com/midnightntwrk/example-private-party/blob/main/docs/SPONSORSHIP.md)
- [Compact Security](https://docs.midnight.network/compact/smart-contract-security)
