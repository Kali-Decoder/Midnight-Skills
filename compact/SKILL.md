---
name: compact
description: Write, reason about, and debug Compact smart contracts for the Midnight blockchain. Use this skill whenever a user asks about Compact syntax, ledger state, witnesses, circuits, disclosure, ZK patterns, data types, standard library functions, security patterns, nullifier design, Merkle trees, or anything related to writing .compact files. Also trigger for questions about compiling contracts, debugging circuit errors, choosing between ledger ADTs, and implementing privacy-preserving patterns like commitments, hash-based auth, and anonymous membership proofs.
---

# Compact Language Skill

Compact is Midnight's smart contract language. It looks like TypeScript but compiles to zero-knowledge circuits. The compiler handles all cryptographic machinery — you write business logic.

**Primary references:**
- `compact-book.vercel.app` — structured example-driven reference (your best source)
- `docs.midnight.network/compact` — official spec (testing/security pages are "coming soon" as of 2026)

---

## 1) The Mental Model

**Three non-negotiables before writing anything:**

```
1. A circuit is a constraint system, not a function.
   It declares relationships that MUST hold. The proof proves they held.

2. The ledger is public. Everything in `export ledger` is plaintext on-chain.
   Private data lives in witnesses. It never touches the chain.

3. `disclose()` is a compile-time annotation, not encryption.
   It tells the compiler "I am intentionally making this public."
   The compiler prevents accidental disclosure. No runtime cost.
```

**The two worlds:**

| World | Where | Who sees it | Updated by |
|---|---|---|---|
| `export ledger` | Every network node | Everyone | ZK proof |
| `witness` (private) | User's local storage | Only the owner | Never (stays local) |

---

## 2) Contract Structure

Every Compact contract has four mandatory pieces + one optional:

```compact
pragma language_version >= 0.22;      // 1. Language version

import CompactStandardLibrary;         // optional, needed for hashing, Merkle, etc.

export ledger counter: Uint<64>;       // 2. Public state (on-chain, readable by all)

witness callerSecret(): Bytes<32>;     // 3. Private input (body lives in TypeScript)

constructor() {                        // 5. OPTIONAL: runs once on deployment
  counter = 0;
}

export circuit increment(): [] {       // 4. Logic (compiles to ZK circuit)
  counter = disclose((counter + 1) as Uint<64>);
}
```

| Piece | Keyword | Purpose |
|---|---|---|
| Public state | `export ledger` | On-chain, readable by all |
| Private inputs | `witness` | Callbacks the DApp provides (body in TypeScript) |
| Logic | `export circuit` | Compiles to ZK circuits |
| Initialization | `constructor` | Runs once on deploy |
| Organization | `module` / `import` | Namespace and file management |

---

## 3) Data Types

### Primitives

| Type | Range/Size | Notes |
|---|---|---|
| `Boolean` | `true` / `false` | No truthy/falsy coercion |
| `Field` | 0 to prime field order | Only `==` and `!=` — no `<`, `>` |
| `Uint<n>` | n-bit unsigned, wraps on overflow | `Uint<8>` = 0..255 |
| `Uint<0..n>` | Bounded integer, 0 to n-1 | Supports `<`, `>`. Cast can fail at runtime |
| `Bytes<n>` | Exactly n bytes | Use `pad(n, str)` for fixed-length from strings |
| `Opaque<"string">` | Foreign JS data | Circuits see only hash, not contents. Not hidden on-chain |

**Critical:** Use `Field` only for equality checks. Use `Uint<0..n>` whenever you need ordering (`<`, `<=`, `>`, `>=`).

### Composite Types

```compact
// Tuple
const pair: [Field, Boolean] = [42, true];
const first = pair[0];

// Vector (homogeneous, fixed-length)
const v: Vector<4, Uint<8>> = [1, 2, 3, 4];

// Struct (nominal typing — shape isn't enough, name matters)
struct Point { x: Uint<32>, y: Uint<32> }
const p = Point { x: 10, y: 20 };

// Enum (first variant = default)
enum State { VACANT, OCCUPIED }
```

### Type Aliases

```compact
type Hash = Bytes<32>;        // structural alias — fully interchangeable
new type UserId = Bytes<32>;  // nominal alias — requires explicit cast
```

### Default Values

Every type has a zero default: `false`, `0`, `n` zero bytes, first enum variant. Access with `default<T>()`.

---

## 4) Ledger State (Public) and `disclose()`

### Ledger Modifiers

```compact
ledger val: Field;                          // private to contract, not exported
export ledger cnt: Counter;                 // readable from TypeScript/DApp
sealed ledger config: Uint<32>;             // write-once (only in constructor)
export sealed ledger mapping: Map<Boolean, Field>;
```

### The `disclose()` Rule

If data flows from a `witness` to a ledger write (or circuit return), it **must** be wrapped in `disclose()`. The compiler tracks witness taint through every operation and will error if untainted disclosure reaches the ledger.

```compact
// ❌ COMPILER ERROR — undisclosed witness data reaching ledger
export circuit record(): [] {
  stored = getSecret();
}

// ✅ CORRECT — explicitly disclosed
export circuit record(): [] {
  stored = disclose(getSecret());
}
```

`disclose()` is not encryption. It is a compile-time signal. The disclosed value is plaintext on-chain.

### Ledger ADT Chooser

| Use case | Type |
|---|---|
| Single mutable value | `ledger f: T` (Cell) |
| Monotonically growing counter | `Counter` (use `.increment(n)`) |
| Membership tracking (reveals which) | `Set<T>` |
| Per-key storage | `Map<K, V>` |
| Ordered queue | `List<T>` |
| Anonymous membership proofs (current root) | `MerkleTree<n, T>` |
| Anonymous membership proofs (past roots) | `HistoricMerkleTree<n, T>` |
| Block time, tokens, contract address | `Kernel` |

---

## 5) Circuits and Witnesses

### Circuits

```compact
// Exported = callable from DApp
export circuit post(msg: Opaque<"string">): [] {
  message = disclose(msg);
}

// Pure = no ledger access, no side effects
pure circuit publicKey(sk: Bytes<32>, seq: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<3, Bytes<32>>>([pad(32, "domain:"), seq, sk]);
}

// Internal (no export keyword) — not callable from DApp
circuit hashTokenData(owner: Bytes<32>, meta: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([owner, meta]);
}
```

- `[]` as return type = no return value (procedure-style)
- `assert(condition, "message")` = runtime guard, transaction fails if condition is false
- Always validate witness outputs with `assert` — witnesses are untrusted

### Witnesses

A `witness` declares a private input callback. The **signature** is in Compact, the **body** is in TypeScript.

```compact
// Compact side — declaration only
witness callerAddress(): Bytes<32>;
witness findMerklePath(leaf: Bytes<32>): MerkleTreePath<10, Bytes<32>>;
```

```typescript
// TypeScript side — implementation
function callerAddress(context: WitnessContext): Uint8Array {
  return context.coinPublicKey;  // or wallet-derived address
}

function findMerklePath(
  context: WitnessContext,
  leaf: Uint8Array,
): MerkleTreePath<Uint8Array> {
  return context.ledger.items.findPathForLeaf(leaf)!;
}
```

Witness data **never touches the chain**. Only the ZK proof that the circuit ran correctly goes on-chain.

---

## 6) Standard Library — Key Functions

```compact
import CompactStandardLibrary;
```

### Hashing

| Function | Output | Survives upgrade? | Witness-tainted? | Use for |
|---|---|---|---|---|
| `transientHash<T>(v)` | `Field` | No | Yes | Temporary computations |
| `transientCommit<T>(v, rand)` | `Field` | No | **No** | Temp computation without `disclose()` |
| `persistentHash<T>(v)` | `Bytes<32>` | Yes | Yes | Keys, IDs on-chain |
| `persistentCommit<T>(v, rand)` | `Bytes<32>` | Yes | **No** | Hiding sensitive values on-chain |

**Key distinction:**
- `*Hash` = hash of value only. Brute-forcible for small value spaces.
- `*Commit` = hash of value + random nonce. Infeasible to brute-force even for small values.
- Persistent = survives contract upgrades. Use for ledger storage.
- Transient = temporary. Does NOT survive upgrades.

### Padding and Conversion

```compact
pad(32, "midnight:domain:separator")   // Creates Bytes<32> from string
```

### Merkle Trees

```compact
// Check that a path validates to the current root
assert(
  items.checkRoot(merkleTreePathRoot<10, Bytes<32>>(path)),
  "invalid merkle path"
);

// TypeScript: get the path
const path = context.ledger.items.findPathForLeaf(leaf);  // O(n) scan
const path = context.ledger.items.pathForLeaf(index);      // O(1) with index
```

### Maybe / Option

```compact
export ledger message: Maybe<Opaque<"string">>;

message = some<Opaque<"string">>(newMessage);   // has value
message = none<Opaque<"string">>();              // empty

const val = message.value;  // access inner value (only when present)
```

---

## 7) Security Patterns

The official security docs are "coming soon." Use these patterns from the compact-book.

### What's Public (assume everything is)

| Operation | What it reveals |
|---|---|
| `ledger.insert(v)` | The value `v` |
| `ledger.lookup(k)` | Key `k` and the returned value |
| `set.member(f(x))` | `f(x)`, not `x` |
| `merkleTree.insert(v)` | **Does NOT reveal `v`** |
| Circuit arguments | All of them |
| `witness` return values | Nothing (stays local) |

### Pattern 1: Commitment (Store Hash, Not Value)

```compact
export ledger balanceCommitments: Map<Bytes<32>, Bytes<32>>;

export circuit commitBalance(value: Uint<64>): [] {
  const nonce = freshNonce();
  const commitment = persistentCommit<Uint<64>>(value, nonce);
  balanceCommitments.insert(disclose(callerAddress()), disclose(commitment));
}
```

**Nonce reuse = privacy catastrophe.** Two commitments with same nonce + value are identical on-chain. Always fresh nonce.

### Pattern 2: Hash-Based Auth (ZK Signatures via Hashing)

```compact
witness secretKey(): Bytes<32>;
export ledger organizer: Bytes<32>;

constructor() {
  organizer = disclose(publicKey(secretKey()));
}

export circuit adminAction(): [] {
  assert(organizer == publicKey(secretKey()), "not authorized");
  // ... do the thing
}

pure circuit publicKey(sk: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>(
    [pad(32, "myapp:admin:v1"), sk]
  );
}
```

**Domain separator is critical.** Same secret key → different public keys for different purposes. Never reuse a public key across domains.

### Pattern 3: Merkle Tree for Anonymous Membership

`Set<T>` reveals which commitment was checked. `MerkleTree<n, T>` only reveals that *some* value was proven.

```compact
export ledger allowlist: MerkleTree<16, Bytes<32>>;
witness findPath(leaf: Bytes<32>): MerkleTreePath<16, Bytes<32>>;

export circuit addToAllowlist(commitment: Bytes<32>): [] {
  allowlist.insert(disclose(commitment));  // insert still requires disclose
}

export circuit proveAllowlisted(): [] {
  const sk = secretKey();
  const leaf = publicKey(sk);
  const path = findPath(leaf);
  assert(
    allowlist.checkRoot(merkleTreePathRoot<16, Bytes<32>>(path)),
    "not in allowlist"
  );
  // proof: caller is in the allowlist. Nothing else revealed.
}
```

Depth guide: each level adds ~1 to circuit depth. 16–20 is typical. Use minimum depth needed.

### Pattern 4: Commitment/Nullifier (Single-Use Anonymous Tokens)

```compact
export ledger commitments: HistoricMerkleTree<16, Bytes<32>>;
export ledger nullifiers: Set<Bytes<32>>;

export circuit spend(): [] {
  const sk = secretKey();
  const commitment = makeCommitment(sk);
  const path = findCommitmentPath(commitment);
  
  // 1. Prove membership
  assert(
    commitments.checkRoot(merkleTreePathRoot<16, Bytes<32>>(path)),
    "not in commitments tree"
  );
  
  // 2. Prevent reuse
  const nul = makeNullifier(sk);
  assert(!nullifiers.member(nul), "already spent");
  nullifiers.insert(disclose(nul));
}

// CRITICAL: commitment and nullifier MUST use different domain separators
pure circuit makeCommitment(sk: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([pad(32, "myapp:commit:v1"), sk]);
}

pure circuit makeNullifier(sk: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([pad(32, "myapp:nullifier:v1"), sk]);
}
```

Use `HistoricMerkleTree` only when proofs must verify against past roots (i.e., items may be added after the proof was computed). Otherwise use plain `MerkleTree`.

---

## 8) Complete Contract Examples

### Minimal Bulletin Board (No Privacy)

```compact
pragma language_version >= 0.22;

export ledger message: Opaque<"string">;

export circuit post(msg: Opaque<"string">): [] {
  message = disclose(msg);
}
```

### Bulletin Board with Ownership (Privacy Pattern)

```compact
pragma language_version >= 0.22;

import CompactStandardLibrary;

export enum State { VACANT, OCCUPIED }

export ledger state: State;
export ledger message: Maybe<Opaque<"string">>;
export ledger sequence: Counter;
export ledger owner: Bytes<32>;

witness localSecretKey(): Bytes<32>;

constructor() {
  state = State.VACANT;
  message = none<Opaque<"string">>();
  sequence.increment(1);
}

export circuit post(newMessage: Opaque<"string">): [] {
  assert(state == State.VACANT, "Board occupied");
  owner = disclose(publicKey(localSecretKey(), sequence as Field as Bytes<32>));
  message = disclose(some<Opaque<"string">>(newMessage));
  state = State.OCCUPIED;
}

export circuit takeDown(): Opaque<"string"> {
  assert(state == State.OCCUPIED, "Board empty");
  assert(owner == publicKey(localSecretKey(), sequence as Field as Bytes<32>), "Not owner");
  const msg = message.value;
  state = State.VACANT;
  sequence.increment(1);
  message = none<Opaque<"string">>();
  return msg;
}

pure circuit publicKey(sk: Bytes<32>, seq: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<3, Bytes<32>>>([pad(32, "bboard:pk:"), seq, sk]);
}
```

**Why sequence?** Prevents replay attacks — same secret key produces different public key each round.

### NFT Contract (Commitment-Based Ownership)

```compact
pragma language_version >= 0.22;

import CompactStandardLibrary;

export ledger totalSupply: Uint<64>;
export ledger nextTokenId: Uint<64>;
export ledger tokenCommitments: Map<Uint<64>, Bytes<32>>;

witness callerAddress(): Bytes<32>;

constructor() {
  totalSupply = 0;
  nextTokenId = 1;
}

circuit hashTokenData(owner: Bytes<32>, metaHash: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([owner, metaHash]);
}

export circuit mint(metaHash: Bytes<32>): [] {
  const caller = disclose(callerAddress());
  const tokenId = nextTokenId;
  const commitment = hashTokenData(caller, metaHash);
  tokenCommitments.insert(tokenId, disclose(commitment));
  totalSupply = disclose((totalSupply + 1) as Uint<64>);
  nextTokenId = disclose((tokenId + 1) as Uint<64>);
}

export circuit transfer(tokenId: Uint<64>, newOwner: Bytes<32>, metaHash: Bytes<32>): [] {
  const caller = disclose(callerAddress());
  const expected = hashTokenData(caller, metaHash);
  const pubId = disclose(tokenId);
  assert(tokenCommitments.member(pubId), "Token does not exist");
  assert(tokenCommitments.lookup(pubId) == expected, "Not the owner");
  const nextCommitment = hashTokenData(disclose(newOwner), metaHash);
  tokenCommitments.insert(pubId, disclose(nextCommitment));
}
```

---

## 9) Compilation and Tooling

```bash
# Compile a contract
compact compile contracts/your-contract.compact contracts/managed/your-contract

# Output structure
contracts/managed/your-contract/
  keys/
    circuitName.prover      # 2–10 MB
    circuitName.verifier    # ~2 KB
  zkir/
    circuitName.bzkir       # 1–3 KB
```

TypeScript bindings are also generated — import the `Contract` object from the managed output folder.

**Circuit size on preview:** ProofStation requires minimum circuit size (`k ≥ 6`). Error: `prove: no SRS params for k=6` means the circuit is too small. Pad with additional dummy ledger fields to increase size.

---

## 10) Common Mistakes (The Full List)

**Disclosure mistakes:**
- Writing witness data to the ledger without `disclose()` → compiler error (good, caught early)
- Returning witness data from `export circuit` without `disclose()` → compiler error
- Thinking `disclose()` encrypts data → it doesn't, it's plaintext

**Type mistakes:**
- Using `Field` when you need `<`, `>` → use `Uint<0..n>` instead
- `as Uint<0..n>` cast at runtime → can fail if value is out of range (transaction error, not compile error)
- Confusing `type Hash = Bytes<32>` (structural, interchangeable) with `new type UserId = Bytes<32>` (nominal, requires cast)

**Privacy mistakes:**
- Using `persistentHash` for small value spaces (brute-forcible) → use `persistentCommit` with fresh nonce
- Reusing nonces → two same-value commitments are identical on-chain
- Using `Set<T>` when you need anonymity → `Set.member(v)` reveals `v`. Use `MerkleTree` instead
- Same domain separator for commitment and nullifier → potential collision
- Using `transientHash` for ledger storage → transient values don't survive contract upgrades
- Putting per-user data in `export ledger` → privacy leak

**Ledger mistakes:**
- Forgetting `assert` on witness outputs → witnesses are untrusted, validate them
- Writing logic in `constructor` that should be in circuits → constructor runs once and is done
- Using `HistoricMerkleTree` unnecessarily → adds storage cost; use `MerkleTree` unless past roots are needed
- `export` on internal helper circuits → exposes surface area unnecessarily

---

## 11) Keyword Quick Reference

| Keyword | Purpose |
|---|---|
| `pragma language_version >= n` | Declare minimum language version |
| `import ModuleName` | Import a module |
| `export ledger f: T` | Public on-chain state field |
| `sealed ledger f: T` | Write-once state (constructor only) |
| `witness f(): T` | Private input callback (body in TypeScript) |
| `export circuit f(): T` | Callable ZK circuit |
| `pure circuit f(): T` | Pure function (no ledger access) |
| `constructor()` | Runs once on deployment |
| `disclose(v)` | Mark intentional public disclosure |
| `assert(cond, msg)` | Runtime guard (tx fails if false) |
| `default<T>()` | Zero/empty value for type T |
| `pad(n, str)` | Create `Bytes<n>` from string |
| `some<T>(v)` / `none<T>()` | Maybe/Option constructors |
| `new type A = B` | Nominal type alias |
| `type A = B` | Structural type alias |