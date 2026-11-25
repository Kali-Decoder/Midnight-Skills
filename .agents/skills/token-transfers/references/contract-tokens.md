# Token Transfers Skill: 5) Contract Tokens (FungibleToken Pattern)

> Reference for the `token-transfers` skill. Back to [SKILL.md](../SKILL.md).

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
