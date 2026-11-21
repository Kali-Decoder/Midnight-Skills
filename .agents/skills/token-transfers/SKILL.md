---
name: token-transfers
description: Shielded and unshielded NIGHT token transfers, contract token (FungibleToken) design, balance queries, DUST mechanics, multi-party Zswap transactions, and the Either<ZswapCoinPublicKey, ContractAddress> recipient pattern for Midnight Network. Use when a user asks about sending NIGHT tokens, reading balances, building a token contract, the difference between shielded and unshielded transfers, how DUST is generated and consumed, or how to implement ERC-20-style transfers in Compact.
---

# Token Transfers Skill

Midnight has two distinct token systems that operate independently: **ledger tokens** (NIGHT, UTXO-based, native to the chain) and **contract tokens** (account-based, ERC-20-style, implemented in Compact). They work differently, transfer differently, and serve different purposes.

**Primary references:**
- `docs.midnight.network/concepts/ledgers` — ledger vs contract token model
- `docs.midnight.network/concepts/utxo` — UTXO mechanics and nullifier set
- `docs.midnight.network/concepts/dust-architecture` — DUST generation lifecycle
- `docs.midnight.network/concepts/zswap` — atomic swap and shielded transfer protocol
- `github.com/OpenZeppelin/compact-contracts` — reference FungibleToken implementation

---

## 1) Two Token Systems — Which One You Need

| | Ledger Tokens (NIGHT) | Contract Tokens |
|---|---|---|
| Where they live | Chain ledger, UTXO-based | Inside a Compact contract, account-based |
| Transfer mechanism | Zswap (ZK atomic swap) | Circuit call (`transfer`, `mint`, `burn`) |
| Privacy | Shielded or unshielded at UTXO level | Private state (balances can be private) |
| Fee resource | NIGHT generates DUST (transaction fees) | No fee role — just application logic |
| Wallet SDK method | `facade.transferTransaction(...)` (Wallet SDK 2.x) | `contract.callTx.transfer(to, amount)` |
| Who manages it | Protocol + wallet SDK | Your Compact contract |
| Analogy | Native ETH / BTC | ERC-20 |

**Decision rule:** If you are moving NIGHT tokens (the chain's native token), use the wallet SDK transfer. If you are building an application token (governance, game currency, stablecoin, NFT), implement it in Compact using the account/map model.

---

## 2) NIGHT Token — Shielded vs Unshielded

Every NIGHT UTXO is either **shielded** (private, hidden from observers) or **unshielded** (public, visible on-chain).

| | Shielded | Unshielded |
|---|---|---|
| Address prefix | `mn_shield1...` | `mn_addr_preprod1...` / `mn_addr1...` |
| Amount visible | No | Yes |
| Sender/receiver visible | No | Yes |
| DUST generation | Yes (via Zswap registration) | Yes (via registration table) |
| Faucet/bridge sends to | No | Yes — always unshielded first |
| Required for | Privacy-sensitive transfers | Interop, faucet, bridge, contracts |

**Critical:** Faucets and bridges always send to the **unshielded address**. Never give a shielded address to a faucet.

### Address Types from Wallet SDK

```typescript
import * as Rx from 'rxjs';

const state = await Rx.firstValueFrom(
  wallet.state().pipe(Rx.filter((s: any) => s.isSynced)),
);

// Unshielded address — use for faucets, bridges, contract interactions
const unshieldedAddress = state.unshielded.address;
// → "mn_addr_preprod1qxy..."

// Shielded coin public key — used as recipient in Zswap transfers
const shieldedCoinPublicKey = state.shielded.coinPublicKey.toHexString();
// → "0x3a7f..."

// DUST address — for DUST registration queries
const dustAddress = state.dust.address;
```

---

## 3) Sending NIGHT Tokens (Wallet SDK 2.x)

Use `facade.transferTransaction(...)` (Wallet SDK 2.0.1; the 1.x `makeTransfer` is gone from the facade). The wallet selects UTXOs, proves, and pays the DUST fee; unshielded inputs must be **signed** before finalizing. Type-checked against `@midnightntwrk/wallet-sdk-facade` 5.0.1:

```typescript
import { unshieldedToken } from '@midnightntwrk/ledger-v9';
import { MidnightBech32m, UnshieldedAddress } from '@midnightntwrk/wallet-sdk-address-format';
import { createKeystore } from '@midnightntwrk/wallet-sdk-unshielded-wallet';

// facade: WalletFacade from WalletFacade.init (see midnight-js skill), seeds: WalletSeeds
const keystore = createKeystore({ kind: 'schnorr', secret: seeds.unshielded }, networkId);
const signSegment = (payload: Uint8Array) => Promise.resolve(keystore.signData(payload));

const state = await facade.waitForSyncedState();
const nightTokenType = unshieldedToken().raw;                  // hex token type
console.log('NIGHT (Stars):', state.unshielded.balances[nightTokenType] ?? 0n); // 1 NIGHT = 1_000_000 Stars

// Recipients are parsed addresses, not strings
const to = MidnightBech32m.parse('mn_addr_preview1...').decode(UnshieldedAddress, networkId);

const recipe = await facade.transferTransaction(
  [{ type: 'unshielded', outputs: [{ type: nightTokenType, receiverAddress: to, amount: 1_000_000n }] }],
  { ttl: new Date(Date.now() + 60 * 60 * 1000) },
);
const signed = await facade.signRecipe(recipe, signSegment);    // signs the unshielded inputs
const txId = await facade.submitTransaction(await facade.finalizeRecipe(signed));
```

### Multi-Output Transfer (Batch)

Put several outputs (and shielded + unshielded groups) in one call. They settle atomically:

```typescript
const recipe = await facade.transferTransaction(
  [
    {
      type: 'unshielded',
      outputs: [
        { type: nightTokenType, receiverAddress: alice, amount: 500_000n },
        { type: nightTokenType, receiverAddress: bob, amount: 250_000n },
      ],
    },
    // { type: 'shielded', outputs: [{ type: tokenType, receiverAddress: shieldedAddr, amount }] },
  ],
  { ttl: new Date(Date.now() + 60 * 60 * 1000) },
);
```

In a browser dApp, ask the user's wallet instead: `connectedAPI.makeTransfer(desiredOutputs, { payFees })` (DApp Connector 4.1.0). If the wallet can't cover it, the call rejects with error code `InsufficientFunds`.

### Querying Unshielded NIGHT Balance (Without Wallet)

You can also query the indexer directly for unshielded balances at a contract or address:

```typescript
async function getUnshieldedBalance(
  indexerUrl: string,
  contractAddress: string,
): Promise<Map<string, bigint>> {
  const res = await fetch(indexerUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: `
        query($address: HexEncoded!) {
          contractAction(address: $address) {
            ... on ContractCall   { unshieldedBalances { tokenType amount } }
            ... on ContractUpdate { unshieldedBalances { tokenType amount } }
          }
        }
      `,
      variables: { address: contractAddress },
    }),
  });
  const payload = await res.json();
  const balances: Array<{ tokenType: string; amount: string }> =
    payload.data?.contractAction?.unshieldedBalances ?? [];
  return new Map(balances.map(b => [b.tokenType, BigInt(b.amount)]));
}
```

---

## 4) DUST — Mechanics and Developer Implications

DUST is the non-transferable fee resource generated by holding NIGHT. It is not a token you send — it is a capacity resource consumed automatically when you submit transactions.

### Mental model

```
NIGHT  →  generates  →  DUST  →  consumed by  →  transactions
(Solar Panel)          (Electricity)              (Appliances)
```

### Key properties

- **1 NIGHT = 5 DUST maximum capacity** (at full generation: `night_dust_ratio = 5_000_000_000`)
- **1 DUST = 10^15 Specks** (unit used internally)
- Generation time to capacity: ~1 week (`generation_decay_rate = 8267`)
- Grace period: 3 hours (timestamp window for proof acceptance)
- DUST is **shielded and non-transferable** — you cannot send DUST to another user
- DUST starts decaying immediately when its backing NIGHT UTXO is spent

### DUST lifecycle

```
NIGHT UTXO created
        ↓
Registration: DustRegistration links NIGHT public key → DUST public key
        ↓
DUST UTXO starts generating value (grows toward cap over ~1 week)
        ↓
Transaction submitted: DUST UTXO consumed → new DUST UTXO created (value - fees)
        ↓
NIGHT UTXO spent → DUST UTXO immediately begins decaying to zero
```

### Registering NIGHT for DUST generation

```typescript
const state = await Rx.firstValueFrom(
  wallet.state().pipe(Rx.filter((s: any) => s.isSynced)),
);

// Find unregistered NIGHT UTXOs
const unregistered = state.unshielded.availableCoins.filter(
  (coin: any) => coin.meta?.registeredForDustGeneration !== true,
);

if (unregistered.length > 0) {
  const recipe = await wallet.registerNightUtxosForDustGeneration(
    unregistered,
    unshieldedKeystore.getPublicKey(),
    (payload: Uint8Array) => Promise.resolve(unshieldedKeystore.signData(payload)), // SignSegment returns a Promise
  );
  const finalized = await wallet.finalizeRecipe(recipe);
  await wallet.submitTransaction(finalized);
}

// Wait for DUST to become available
await Rx.firstValueFrom(
  wallet.state().pipe(
    Rx.throttleTime(5_000),
    Rx.filter((s: any) => s.isSynced),
    Rx.filter((s) => s.dust.balance(new Date()) > 0n),   // Wallet SDK 2.x
  ),
);
```

### Reading DUST balance

```typescript
const state = await Rx.firstValueFrom(
  wallet.state().pipe(Rx.filter((s: any) => s.isSynced)),
);

const dustBalance = state.dust.balance(new Date()); // Specks (Wallet SDK 2.x; `walletBalance` was 1.x)
const dustCoins = state.dust.availableCoins.length;
const dustPending = state.dust.pendingCoins.length;

console.log(`DUST: ${dustBalance.toLocaleString()} Specks`);
console.log(`Coins: ${dustCoins} available, ${dustPending} pending`);
```

**`pendingCoins > 0 && availableCoins === 0`** → DUST is booked by a pending transaction. In Wallet SDK 2.x the facade releases those bookings itself when the node provably rejects the submission (`TransactionInvalidError`, pool refusal, …); otherwise they free when the TTL passes or on sync. Wait, or call `facade.revertTransaction(tx)` for a transaction you know is dead, instead of restarting the process (the 1.x workaround).

### Ledger 9 DUST reset (Nov 2026)

Generation parameters are unchanged (5 DUST/NIGHT cap, 10^15 Specks per DUST, ~1 week to cap, 3 h grace), but state was reset: **mainnet** replayed cNIGHT registrations to full cap; **Preprod** (9 Nov 2026) cleared registrations not backed by cNIGHT, so register again; **Preview** relaunched as a new chain (7 Nov 2026), so re-request tNIGHT and register.

### Fee sponsorship (1AM)

1AM has advertised that its ProofStation sponsors fees for 1AM-wallet users on preview and mainnet, via `balanceUnsealedTransaction`. That is a third-party policy that may have changed with the Ledger 9 DUST reset, so check 1AM's docs before you skip DUST registration. Headless wallets and other wallets always pay from their own DUST.

---

## 5) Contract Tokens (FungibleToken Pattern)

For application tokens, implement them in Compact. For production use the OpenZeppelin Contracts for Compact library; the contract below is a minimal illustration of the account-model pattern.

> **There is no `msg.sender` on Midnight.** A circuit cannot ask who called it. Identity has to be *proved*, and the only way to prove it is to derive the account from a secret the caller supplies as a witness: the circuit constrains `account == hash(domain, secretKey())`, so naming someone else's account means inverting a hash. **Never take the account itself from a witness** — a witness is the caller's own TypeScript, so `witness callerAddress(): Bytes<32>` returns whatever the caller wants and any account can be debited by anyone. See "Common Pitfalls" below.

### Minimal FungibleToken Contract

```compact
pragma language_version >= 0.28.0;

import CompactStandardLibrary;

export ledger name: Opaque<"string">;
export ledger symbol: Opaque<"string">;
export ledger decimals: Uint<8>;
export ledger totalSupply: Uint<128>;
export ledger balances: Map<Bytes<32>, Uint<128>>;
export ledger minter: Bytes<32>;

// The caller's secret. Never disclosed — only its hash reaches the ledger.
witness secretKey(): Bytes<32>;

// An account id is the hash of a secret, so holding the secret IS the
// authorisation. Domain-separated so the same secret cannot be replayed
// as an identity in another contract.
circuit accountOf(sk: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([pad(32, "fungible:account:v1"), sk]);
}

constructor(
  _name: Opaque<"string">,
  _symbol: Opaque<"string">,
  _decimals: Uint<8>,
) {
  name = disclose(_name);
  symbol = disclose(_symbol);
  decimals = disclose(_decimals);
  totalSupply = 0;
  // Whoever deploys becomes the minter.
  minter = disclose(accountOf(secretKey()));
}

// A holder needs their own id in order to be paid. It is public by
// construction — it is a hash, and it reveals nothing about the secret.
export circuit myAccount(): Bytes<32> {
  return disclose(accountOf(secretKey()));
}

export circuit mint(to: Bytes<32>, amount: Uint<128>): [] {
  // Without this, anyone can mint any amount and the supply means nothing.
  assert(disclose(accountOf(secretKey())) == minter, "only the minter may mint");

  const recipient = disclose(to);
  const current = balances.member(recipient)
    ? balances.lookup(recipient)
    : 0;
  balances.insert(recipient, disclose((current + amount) as Uint<128>));
  totalSupply = disclose((totalSupply + amount) as Uint<128>);
}

export circuit transfer(to: Bytes<32>, amount: Uint<128>): Boolean {
  // The sender is derived, never supplied: a caller can only ever spend from
  // the account whose secret they hold.
  const sender = disclose(accountOf(secretKey()));
  assert(balances.member(sender), "sender has no balance");
  const senderBal = balances.lookup(sender);
  assert(senderBal >= amount, "insufficient balance");

  balances.insert(sender, disclose((senderBal - amount) as Uint<128>));

  const recipient = disclose(to);
  const recipientBal = balances.member(recipient)
    ? balances.lookup(recipient)
    : 0;
  balances.insert(recipient, disclose((recipientBal + amount) as Uint<128>));

  return true;
}

export circuit balanceOf(account: Bytes<32>): Uint<128> {
  // `account` is a circuit parameter, so it is a witness value until disclosed;
  // passing it straight to a ledger op fails the disclosure check at compile time.
  const a = disclose(account);
  if (!balances.member(a)) { return 0; }
  return balances.lookup(a);
}
```

The matching witness implementation — the secret comes from the user's own private state and never leaves the device:

```typescript
// witnesses.ts
export type TokenPrivateState = { secretKey: Uint8Array };

export const witnesses = {
  secretKey: ({ privateState }: WitnessContext<Ledger, TokenPrivateState>):
    [TokenPrivateState, Uint8Array] => [privateState, privateState.secretKey],
};
```

### OpenZeppelin FungibleToken (Full-Featured)

The OpenZeppelin library provides `Ownable`, `Pausable`, and `FungibleToken` modules. For Ledger 9 use the `0.5.0-alpha.2` line (stable `0.4.0` still targets Compact 0.31; pre-releases are unaudited):

```bash
npm install @openzeppelin/compact-contracts@0.5.0-alpha.2
compact compile +0.36.1 MyToken.compact artifacts/MyToken   # compiles as shown below (checked 21 Nov 2026)
```

Accounts are `Either<Bytes<32>, ContractAddress>`. The `Bytes<32>` side is an account ID, `persistentHash(secretKey)`, where the secret comes from OZ's witness. Your TypeScript witnesses must supply it. `FungibleToken.transfer` rejects `ContractAddress` recipients until OZ migrates to Ledger 9 cross-contract calls.

```compact
pragma language_version >= 0.28.0;

import CompactStandardLibrary;
import "./node_modules/@openzeppelin/compact-contracts/access/Ownable"
  prefix Ownable_;
import "./node_modules/@openzeppelin/compact-contracts/security/Pausable"
  prefix Pausable_;
import "./node_modules/@openzeppelin/compact-contracts/token/FungibleToken"
  prefix FungibleToken_;

constructor(
  _name: Opaque<"string">,
  _symbol: Opaque<"string">,
  _decimals: Uint<8>,
  _recipient: Either<Bytes<32>, ContractAddress>,
  _amount: Uint<128>,
  _initOwner: Either<Bytes<32>, ContractAddress>,
) {
  Ownable_initialize(_initOwner);
  FungibleToken_initialize(_name, _symbol, _decimals);
  FungibleToken__mint(_recipient, _amount);
}

export circuit transfer(
  to: Either<Bytes<32>, ContractAddress>,
  value: Uint<128>,
): Boolean {
  Pausable_assertNotPaused();
  return FungibleToken_transfer(to, value);
}

export circuit pause(): [] {
  Ownable_assertOnlyOwner();
  Pausable__pause();
}

export circuit unpause(): [] {
  Ownable_assertOnlyOwner();
  Pausable__unpause();
}
```

Compile output looks like this (illustrative: exact `k`/`rows` depend on the OZ version and change with compiler 0.36.x / ZKIR v3):
```
circuit "pause"    (k=10, rows=…)
circuit "transfer" (k=11, rows=…)
circuit "unpause"  (k=10, rows=…)
```

---

## 6) Calling Token Circuits from TypeScript

```typescript
import { findDeployedContract } from '@midnightntwrk/midnight-js-contracts';

const contract = await findDeployedContract(providers, {
  contractAddress: '09dbe05f...',
  compiledContract,
  privateStateId: 'tokenState',
  initialPrivateState: {},
});

// Transfer tokens
const result = await contract.callTx.transfer(recipientAddressBytes, 100n);
console.log('txId:', result.public.txId);
console.log('blockHeight:', result.public.blockHeight);

// Read balance (no transaction — direct state query)
import { ContractState } from '@midnight-ntwrk/compact-runtime';
import { YourToken } from './managed/your-token';

const stateRaw = await providers.publicDataProvider.queryContractState(contractAddress);
if (stateRaw) {
  const ledgerState = YourToken.ledger(stateRaw.data);
  const balance = ledgerState.balances.lookup(myAccountBytes); // from myAccount()
  console.log('Balance:', balance);
}
```

---

## 7) Reading Token Balances via Indexer

Contract token balances live in `export ledger` — readable from the indexer like any other contract state:

```typescript
import { ContractState } from '@midnight-ntwrk/compact-runtime';

async function getTokenBalance(
  indexerUrl: string,
  contractAddress: string,
  holderAddress: Uint8Array,
  ledgerFn: (data: any) => any,
): Promise<bigint> {
  const res = await fetch(indexerUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: `
        query($address: HexEncoded!) {
          contractAction(address: $address) { state }
        }
      `,
      variables: { address: contractAddress },
    }),
  });
  const payload = await res.json();
  const stateHex = payload.data?.contractAction?.state;
  if (!stateHex) return 0n;

  const normalized = stateHex.startsWith('0x') ? stateHex.slice(2) : stateHex;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }

  const contractState = ContractState.deserialize(bytes);
  const ledgerState = ledgerFn(contractState.data);
  return ledgerState.balances.member(holderAddress)
    ? ledgerState.balances.lookup(holderAddress)
    : 0n;
}
```

---

## 8) Zswap — Atomic Swaps Between Parties

Zswap is Midnight's multi-asset atomic swap protocol built on ZK-SNARK proofs. It enables non-interactive atomic swaps with transaction merging.

### What Zswap enables

- **Atomic exchange**: Alice's NIGHT ↔ Bob's contract token in one transaction
- **Shielded swaps**: Neither sender, receiver, nor amounts need to be publicly visible
- **Non-interactive merging**: Parties can merge offers off-chain before on-chain submission
- **Front-running resistance**: Shielded asset transfers hide pre-trade information

### Developer-facing Zswap surface

As a DApp developer, you interact with Zswap indirectly:

- `facade.transferTransaction(...)` — builds a transfer (shielded outputs go through Zswap)
- `facade.initSwap(inputs, outputs, secrets, { ttl, payFees: false })` — builds a swap **offer** another party can complete and merge
- `walletProvider.balanceTx(tx)` — the balancing step uses Zswap internally to add DUST fees and change outputs
- `ZswapChainState` — returned by indexer queries, needed by some SDK provider methods
- `ZswapSecretKeys` — derived from HD wallet seed (`Roles.Zswap`), used by `ShieldedWallet`

Zswap itself has no "swap two contracts" call. Since Ledger 9, though, contracts can call each other (phase 1, **unshielded only**; see the `compact` skill). So a contract can now orchestrate unshielded token movements across contracts in one transaction. Shielded multi-party swaps still go through Zswap offers (`initSwap` + merging).

---

## 9) Token Units Reference

| Token | Unit | Conversion |
|---|---|---|
| NIGHT | Star | 1 NIGHT = 1,000,000 Stars |
| DUST | Speck | 1 DUST = 10^15 Specks |
| Contract tokens | Defined by `decimals` | Typically 18 decimals (1 token = 10^18 base units) |

Always use `BigInt` for amounts — NIGHT Stars and DUST Specks overflow JavaScript's `number` type at realistic balances.

```typescript
const ONE_NIGHT = 1_000_000n;          // Stars
const ONE_DUST  = 1_000_000_000_000_000n; // Specks
const DUST_PER_NIGHT_MAX = 5_000_000_000n; // Specks per Star at full cap
```

---

## 10) Common Pitfalls

**Taking the caller's identity from a witness** — `witness callerAddress(): Bytes<32>` used as the account to debit is forgeable. A witness is the caller's own TypeScript, so the returned value is chosen by whoever builds the transaction; nothing in the circuit binds it to a key. Any account can then be drained by anyone. Derive the account from a secret instead — `accountOf(secretKey())` — so the circuit constrains it. The same applies to any authorisation check: compare *derived* identities, never a raw witness value.

**Mint circuits with no authority check** — `export circuit mint(to, amount)` with no assert lets anyone mint unlimited supply. Record an authority at construction and `assert` against it.

**Passing a circuit parameter straight to a ledger op** — parameters are witness values until disclosed, so `balances.member(account)` fails to compile with *"potential witness-value disclosure must be declared but is not"*. Bind `const a = disclose(account);` first.

**Sending to shielded address from faucet** — faucets only support unshielded (`mn_addr_preprod1...`) addresses. Giving a shielded address gets zero tokens.

**Spending NIGHT before DUST is available** — spending a NIGHT UTXO causes its associated DUST to start decaying immediately. If you spend NIGHT before DUST reaches useful levels, you lose the generation time invested. Wait until DUST is available before spending NIGHT.

**DUST booked after a failed transaction** — Wallet SDK 2.x releases bookings for provably rejected submissions; others free at TTL or sync. Prefer waiting or `facade.revertTransaction(tx)` over restarting.

**`makeTransfer` / `walletBalance` not found** — Wallet SDK 1.x names. Use `facade.transferTransaction(...)` and `state.dust.balance(time)`.

**`amount` as JS `number` instead of `BigInt`** — 1 NIGHT = 1,000,000 Stars. Realistic balances exceed `Number.MAX_SAFE_INTEGER`. Always use `BigInt` literals (`1_000_000n`).

**`balances.lookup(k)` without `balances.member(k)` check** — calling `lookup` on a key that doesn't exist in the Map is a runtime error in Compact. Always check `member` first.

**Overflow on `Uint<128>` arithmetic** — addition that exceeds `2^128 - 1` wraps silently or errors depending on context. Cast explicitly: `(a + b) as Uint<128>` and add `assert` guards.

**`unshieldedToken().raw` varies by network** — the hex token type identifier for NIGHT is network-specific. Always call `unshieldedToken()` at runtime; never hardcode the hex string.

**OZ versions** — the package is `@openzeppelin/compact-contracts`. Stable `0.4.0` targets Compact 0.31 / Ledger 8, while `0.5.0-alpha.2` targets Ledger 9 (language 0.28.0) and is unaudited. Import through `./node_modules/@openzeppelin/compact-contracts/token/FungibleToken` (no `src/`). In 0.5, owners and accounts are `Either<Bytes<32>, ContractAddress>`, where account IDs come from a secret-key witness. The `ZswapCoinPublicKey` form is gone.

**Contract tokens do not generate DUST** — only NIGHT (the native ledger token) generates DUST. Your custom `FungibleToken` has no fee role.