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
| Wallet SDK method | `wallet.makeTransfer(outputs)` | `contract.callTx.transfer(to, amount)` |
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

## 3) Sending NIGHT Tokens (Wallet SDK)

Use `wallet.makeTransfer(outputs)` to transfer NIGHT. The wallet handles UTXO selection, Zswap proving, and DUST fee payment.

```typescript
import * as Rx from 'rxjs';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8';

// Get current state
const state = await Rx.firstValueFrom(
  wallet.state().pipe(Rx.filter((s: any) => s.isSynced)),
);

// Check unshielded NIGHT balance before sending
const nightTokenType = unshieldedToken().raw; // hex token type identifier
const nightBalance = state.unshielded.balances[nightTokenType] ?? 0n;
console.log('NIGHT balance (Stars):', nightBalance);
// 1 NIGHT = 1_000_000 Stars

// Send unshielded NIGHT to an unshielded address
const transferRecipe = await wallet.makeTransfer([
  {
    value: 1_000_000n,                    // 1 NIGHT in Stars
    tokenType: nightTokenType,
    receiverAddress: 'mn_addr_preprod1...', // recipient's unshielded address
  },
]);

const finalized = await wallet.finalizeRecipe(transferRecipe);
const txId = await wallet.submitTransaction(finalized);
console.log('Transfer submitted:', txId);
```

### Multi-Output Transfer (Batch)

```typescript
// Send to multiple recipients in one atomic transaction
const transferRecipe = await wallet.makeTransfer([
  {
    value: 500_000n,
    tokenType: nightTokenType,
    receiverAddress: 'mn_addr_preprod1_alice...',
  },
  {
    value: 250_000n,
    tokenType: nightTokenType,
    receiverAddress: 'mn_addr_preprod1_bob...',
  },
]);
```

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
    (payload: Uint8Array) => unshieldedKeystore.signData(payload),
  );
  const finalized = await wallet.finalizeRecipe(recipe);
  await wallet.submitTransaction(finalized);
}

// Wait for DUST to become available
await Rx.firstValueFrom(
  wallet.state().pipe(
    Rx.throttleTime(5_000),
    Rx.filter((s: any) => s.isSynced),
    Rx.filter((s: any) => s.dust.walletBalance(new Date()) > 0n),
  ),
);
```

### Reading DUST balance

```typescript
const state = await Rx.firstValueFrom(
  wallet.state().pipe(Rx.filter((s: any) => s.isSynced)),
);

const dustBalance = state.dust.walletBalance(new Date()); // Specks
const dustCoins = state.dust.availableCoins.length;
const dustPending = state.dust.pendingCoins.length;

console.log(`DUST: ${dustBalance.toLocaleString()} Specks`);
console.log(`Coins: ${dustCoins} available, ${dustPending} pending`);
```

**`pendingCoins > 0 && availableCoins === 0`** → DUST is locked by a pending or failed transaction. Restart the wallet process to release it. This is a known wallet SDK issue.

### DUST on sponsored networks (preview, mainnet)

On `preview` and `mainnet`, 1AM ProofStation sponsors all fees. Users need zero NIGHT and zero DUST. The `balanceUnsealedTransaction` call to the 1AM wallet handles fee payment server-side. Do not attempt DUST registration flows on these networks — they are unnecessary.

---

## 5) Contract Tokens (FungibleToken Pattern)

For application tokens, implement them in Compact. The standard pattern follows the OpenZeppelin Contracts for Compact library.

### Minimal FungibleToken Contract

```compact
pragma language_version >= 0.22;

import CompactStandardLibrary;

// Either<ZswapCoinPublicKey, ContractAddress> = shielded wallet OR another contract
// This is the standard recipient type for contract tokens

export ledger name: Opaque<"string">;
export ledger symbol: Opaque<"string">;
export ledger decimals: Uint<8>;
export ledger totalSupply: Uint<128>;
export ledger balances: Map<Bytes<32>, Uint<128>>;

witness callerAddress(): Bytes<32>;

constructor(
  _name: Opaque<"string">,
  _symbol: Opaque<"string">,
  _decimals: Uint<8>,
) {
  name = disclose(_name);
  symbol = disclose(_symbol);
  decimals = disclose(_decimals);
  totalSupply = 0;
}

export circuit mint(to: Bytes<32>, amount: Uint<128>): [] {
  const recipient = disclose(to);
  const current = balances.member(recipient)
    ? balances.lookup(recipient)
    : 0;
  balances.insert(recipient, disclose((current + amount) as Uint<128>));
  totalSupply = disclose((totalSupply + amount) as Uint<128>);
}

export circuit transfer(to: Bytes<32>, amount: Uint<128>): Boolean {
  const sender = disclose(callerAddress());
  assert(balances.member(sender), "sender has no balance");
  const senderBal = balances.lookup(sender);
  assert(senderBal >= amount, "insufficient balance");

  balances.insert(sender, disclose((senderBal - amount) as Uint<128>));

  const recipientBal = balances.member(disclose(to))
    ? balances.lookup(disclose(to))
    : 0;
  balances.insert(disclose(to), disclose((recipientBal + amount) as Uint<128>));

  return true;
}

export circuit balanceOf(account: Bytes<32>): Uint<128> {
  if (!balances.member(account)) { return 0; }
  return balances.lookup(account);
}
```

### OpenZeppelin FungibleToken (Full-Featured)

The OpenZeppelin library provides a production-grade implementation with `Ownable`, `Pausable`, and `FungibleToken` modules:

```bash
# Install as a git submodule
git init && git submodule add https://github.com/OpenZeppelin/compact-contracts.git
cd compact-contracts && nvm install && yarn && SKIP_ZK=true yarn compact
```

```compact
pragma language_version >= 0.22;

import CompactStandardLibrary;
import "./compact-contracts/node_modules/@openzeppelin/compact-contracts/src/access/Ownable"
  prefix Ownable_;
import "./compact-contracts/node_modules/@openzeppelin/compact-contracts/src/security/Pausable"
  prefix Pausable_;
import "./compact-contracts/node_modules/@openzeppelin/compact-contracts/src/token/FungibleToken"
  prefix FungibleToken_;

constructor(
  _name: Opaque<"string">,
  _symbol: Opaque<"string">,
  _decimals: Uint<8>,
  _recipient: Either<ZswapCoinPublicKey, ContractAddress>,
  _amount: Uint<128>,
  _initOwner: Either<ZswapCoinPublicKey, ContractAddress>,
) {
  Ownable_initialize(_initOwner);
  FungibleToken_initialize(_name, _symbol, _decimals);
  FungibleToken__mint(_recipient, _amount);
}

export circuit transfer(
  to: Either<ZswapCoinPublicKey, ContractAddress>,
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

Compile output example:
```
circuit "pause"    (k=10, rows=125)
circuit "transfer" (k=11, rows=1180)
circuit "unpause"  (k=10, rows=121)
```

---

## 6) Calling Token Circuits from TypeScript

```typescript
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';

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
  const balance = ledgerState.balances.lookup(callerAddressBytes);
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

- `wallet.makeTransfer(outputs)` — triggers a Zswap transaction for NIGHT
- `walletProvider.balanceTx(tx)` — the balancing step uses Zswap internally to add DUST fees and change outputs
- `ZswapChainState` — returned by indexer queries, needed by some SDK provider methods
- `ZswapSecretKeys` — derived from HD wallet seed (`Roles.Zswap`), used by `ShieldedWallet`

Zswap does not expose a direct "swap two contracts" API at the DApp layer yet — that is exchange infrastructure. At the current SDK level, Zswap is primarily surfaced as the mechanism for NIGHT transfers and DUST fee payment.

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

**Sending to shielded address from faucet** — faucets only support unshielded (`mn_addr_preprod1...`) addresses. Giving a shielded address gets zero tokens.

**Spending NIGHT before DUST is available** — spending a NIGHT UTXO causes its associated DUST to start decaying immediately. If you spend NIGHT before DUST reaches useful levels, you lose the generation time invested. Wait until DUST is available before spending NIGHT.

**DUST locked after failed transaction** — known wallet SDK issue. `pendingCoins > 0 && availableCoins === 0` means DUST is stuck. Restart the wallet/DApp process to release the lock.

**`amount` as JS `number` instead of `BigInt`** — 1 NIGHT = 1,000,000 Stars. Realistic balances exceed `Number.MAX_SAFE_INTEGER`. Always use `BigInt` literals (`1_000_000n`).

**`balances.lookup(k)` without `balances.member(k)` check** — calling `lookup` on a key that doesn't exist in the Map is a runtime error in Compact. Always check `member` first.

**Overflow on `Uint<128>` arithmetic** — addition that exceeds `2^128 - 1` wraps silently or errors depending on context. Cast explicitly: `(a + b) as Uint<128>` and add `assert` guards.

**`unshieldedToken().raw` varies by network** — the hex token type identifier for NIGHT is network-specific. Always call `unshieldedToken()` at runtime; never hardcode the hex string.

**OZ contract import path changed between versions** — the import path changed from `@openzeppelin-compact/contracts` to `@openzeppelin/compact-contracts` between library versions. Check the README of the exact version you are using.

**Contract tokens do not generate DUST** — only NIGHT (the native ledger token) generates DUST. Your custom `FungibleToken` has no fee role.