---
name: midnight-security
description: Privacy audit checklist, data leak patterns, and defensive Compact contract patterns for Midnight Network. Use when a user asks about what data is publicly visible on-chain, how to prevent accidental disclosure, how to audit a contract for privacy issues, how to implement commitment/nullifier patterns, domain separation, replay protection, witness trust, or front-running resistance. Also covers transaction semantics (guaranteed vs fallible phase), partial success implications, and what an observer can infer from the public transcript even when witness data is hidden.
---

# Midnight Security Skill

Midnight's privacy model is opt-in privacy on top of a public chain. The ZK proof proves correctness of execution — it does not hide the *existence* of a transaction, its *structure*, or anything in `export ledger`. Security on Midnight means being precise about what leaks and designing contracts so that leaks are intentional.

**Primary references:**
- `docs.midnight.network/concepts/how-midnight-works/keeping-data-private`
- `docs.midnight.network/concepts/how-midnight-works/semantics`
- `docs.midnight.network/concepts/how-midnight-works/smart-contracts`
- Official security docs: "coming soon" as of 2026 — this skill fills that gap

---

## 1) The Fundamental Visibility Rule

**Everything in `export ledger` is public. Everything in `witness` is private. The proof is public. The witness data is not.**

More precisely, for every ledger operation:

| Operation | What is revealed |
|---|---|
| `ledger.insert(v)` | The value `v` |
| `ledger.lookup(k)` | The key `k` and the returned value |
| `set.insert(v)` | The value `v` |
| `set.member(f(x))` | The value `f(x)` — not `x` directly |
| `map.insert(k, v)` | The key `k` and value `v` |
| `counter.increment(n)` | The increment amount `n` and new value |
| `merkleTree.insert(v)` | **Does NOT reveal `v`** — only that the tree grew |
| `merkleTree.checkRoot(path)` | That someone proved membership — not which entry |
| Circuit arguments | All of them — they are part of the public transcript |
| `witness` return values | Nothing on-chain — the ZK proof only proves they existed |

The public transcript is what the chain records: ledger reads, writes, and the structure of those operations. Witness values exist only in the proof's private inputs — they are never posted.

---

## 2) Privacy Audit Checklist

Run this against every contract before shipping.

### Ledger fields
- [ ] Every `export ledger` field: who can read it, and is that acceptable?
- [ ] Is any `export ledger` field per-user data that should be local (witness)?
- [ ] Does the field exist only because the frontend needs to read it? If only one user cares, it should not be on-chain.
- [ ] For any `Map<K, V>`: is the key `K` itself sensitive? (Map keys are public on insert/lookup.)
- [ ] Is a `Set<T>` used when anonymity is required? (`Set.member(v)` reveals `v` — use `MerkleTree` instead.)

### Circuit arguments
- [ ] Every circuit parameter: is it part of the public transcript? (Yes, all of them.)
- [ ] Is any sensitive value passed directly as a circuit argument instead of through a witness?

### Commitments and hashes
- [ ] Any `persistentHash` over a small value space (e.g., boolean, vote, role)? → brute-forcible → use `persistentCommit` with a fresh nonce instead.
- [ ] Any two commitments that reuse the same nonce? → identical inputs produce identical commitments on-chain → linkable.
- [ ] Is `transientHash`/`transientCommit` used for ledger storage? → does not survive contract upgrades → use `persistent*`.

### Domain separators
- [ ] Every `persistentHash` call: does it include a unique domain separator string?
- [ ] Is the same secret key used to derive multiple public keys without domain separation? → same key, same hash → different purposes become linked.
- [ ] Is the same domain separator used for both a commitment and its nullifier? → potential collision.

### Witness trust
- [ ] Every witness output: is it validated with `assert` before being used in logic?
- [ ] Does any circuit assume that a witness returns "honest" data without checking it?

### Replay and reuse
- [ ] Any auth pattern using a secret key without a sequence counter or nullifier? → replay attack.
- [ ] Any commitment that can be reused to re-authorize the same action? → missing nullifier.

### Transaction structure leaks
- [ ] Does calling a specific circuit reveal intent even if data is hidden? (e.g., calling `submitVote` reveals that someone voted)
- [ ] Does the number of `merkleTree.insert` calls within a circuit reveal anything about the private inputs?

---

## 3) What Leaks Even With Witnesses

These things are always visible to any chain observer, regardless of privacy measures:

- **Which contract was called** — the contract address is public
- **Which circuit was called** — the `entryPoint` field in the indexer
- **When it was called** — block timestamp
- **That a transaction occurred** — existence is always public
- **Circuit argument values** — every parameter passed to an `export circuit`
- **All ledger writes** — every `export ledger` field that changes
- **The shape of the public transcript** — how many reads, writes, inserts happened (though not the private values behind them)

**Practical implication:** If your circuit takes `vote: Boolean` as an argument, the vote is public even though you never write it to the ledger directly. Move it to a witness.

---

## 4) Data Leak Patterns (The Common Mistakes)

### Pattern 1: Sensitive value as circuit argument

```compact
// ❌ vote is a circuit argument → public transcript → everyone sees it
export circuit submitVote(vote: Boolean): [] {
  votes.insert(disclose(makeCommitment(vote)));
}

// ✅ vote comes from witness → stays in proof's private inputs
witness userVote(): Boolean;

export circuit submitVote(): [] {
  const vote = userVote();  // private
  votes.insert(disclose(makeCommitment(vote)));  // only commitment is public
}
```

### Pattern 2: Using `Set` when anonymity is required

```compact
// ❌ Set.member(v) reveals v — which user's commitment is being checked
export ledger members: Set<Bytes<32>>;

export circuit prove(): [] {
  const pk = publicKey(secretKey());
  assert(members.member(pk), "not a member");  // reveals pk
}

// ✅ MerkleTree proves membership without revealing which entry
export ledger members: MerkleTree<16, Bytes<32>>;
witness findMemberPath(pk: Bytes<32>): MerkleTreePath<16, Bytes<32>>;

export circuit prove(): [] {
  const pk = publicKey(secretKey());
  const path = findMemberPath(pk);
  assert(
    members.checkRoot(merkleTreePathRoot<16, Bytes<32>>(path)),
    "not a member"
  );
  // Only proves: "someone in the tree called this." Does not reveal who.
}
```

### Pattern 3: Hash without nonce over small value space

```compact
// ❌ persistentHash over Boolean → 2 possible outputs → trivially brute-forced
export ledger commitment: Bytes<32>;
export circuit commit(vote: Boolean): [] {
  commitment = disclose(persistentHash<Boolean>(vote));
}

// ✅ persistentCommit with fresh nonce → infeasible to brute-force
witness voteNonce(): Bytes<32>;
export circuit commit(vote: Boolean): [] {  // vote still a circuit arg here — see pattern 1
  const nonce = voteNonce();
  commitment = disclose(persistentCommit<Boolean>(vote, nonce));
}
// Combine with pattern 1 to also move vote to witness
```

### Pattern 4: Nonce reuse linking commitments

```compact
// ❌ same secret key as nonce → if same value committed twice, identical on-chain
export circuit recordBalance(amount: Uint<64>): [] {
  const sk = secretKey();
  const c = persistentCommit<Uint<64>>(amount, sk);  // reusing sk as nonce
  commitments.insert(disclose(c));
}

// ✅ derive a unique nonce per commitment using round counter or fresh randomness
export ledger round: Counter;
export circuit recordBalance(amount: Uint<64>): [] {
  const sk = secretKey();
  const nonce = persistentHash<Vector<2, Bytes<32>>>(
    [sk, pad(32, "balance-nonce"), round as Field as Bytes<32>]
  );
  const c = persistentCommit<Uint<64>>(amount, nonce);
  commitments.insert(disclose(c));
  round.increment(1);
}
```

### Pattern 5: Missing domain separator — key reuse across purposes

```compact
// ❌ same sk → same hash for auth and for commitment → linkable across contracts
pure circuit publicKey(sk: Bytes<32>): Bytes<32> {
  return persistentHash<Bytes<32>>(sk);
}

pure circuit commitmentKey(sk: Bytes<32>): Bytes<32> {
  return persistentHash<Bytes<32>>(sk);  // identical output
}

// ✅ unique domain separator per purpose
pure circuit authPublicKey(sk: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([pad(32, "myapp:auth:v1"), sk]);
}

pure circuit commitmentKey(sk: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([pad(32, "myapp:commit:v1"), sk]);
}
```

### Pattern 6: Untrusted witness output

```compact
// ❌ trusting that the DApp-provided witness returns the right balance
export circuit transfer(to: Bytes<32>, amount: Uint<64>): [] {
  const balance = userBalance();  // could return anything
  balances.insert(to, disclose(balance - amount));
}

// ✅ assert all witness outputs before using them
export circuit transfer(to: Bytes<32>, amount: Uint<64>): [] {
  const balance = userBalance();
  assert(balance >= amount, "insufficient balance");
  assert(balance <= MAX_SUPPLY, "invalid balance");
  balances.insert(to, disclose((balance - amount) as Uint<64>));
}
```

---

## 5) Defensive Patterns (Full Implementations)

### Hash-Based Authentication (ZK Signature)

Proves knowledge of a secret key without revealing it. The sequence counter prevents replay across rounds.

```compact
pragma language_version >= 0.22;
import CompactStandardLibrary;

export ledger admin: Bytes<32>;
export ledger round: Counter;

witness secretKey(): Bytes<32>;

constructor() {
  admin = publicKey(secretKey(), 0);
  round.increment(1);
}

export circuit adminAction(): [] {
  const sk = secretKey();
  const currentRound = round as Field as Bytes<32>;
  assert(admin == publicKey(sk, currentRound), "not authorized");
  // ... do the action
  round.increment(1);  // invalidates old proofs against this round
  admin = disclose(publicKey(sk, round as Field as Bytes<32>));
}

pure circuit publicKey(sk: Bytes<32>, roundBytes: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<3, Bytes<32>>>([
    pad(32, "myapp:admin:v1"),  // domain separator
    roundBytes,                  // round prevents replay
    sk,
  ]);
}
```

### Commitment/Nullifier (Single-Use Anonymous Token)

Proves a token exists in the Merkle tree and has not been spent, without revealing which token.

```compact
pragma language_version >= 0.22;
import CompactStandardLibrary;

export ledger commitments: HistoricMerkleTree<16, Bytes<32>>;
export ledger nullifiers: Set<Bytes<32>>;
export ledger counter: Counter;

witness secretKey(): Bytes<32>;
witness findCommitmentPath(c: Bytes<32>): MerkleTreePath<16, Bytes<32>>;

export circuit addToken(commitment: Bytes<32>): [] {
  commitments.insert(disclose(commitment));
}

export circuit spend(): [] {
  const sk = secretKey();
  const c = commitment(sk);
  const path = findCommitmentPath(c);

  // 1. Prove token is in the tree (without revealing which)
  assert(
    commitments.checkRoot(merkleTreePathRoot<16, Bytes<32>>(path)),
    "commitment not in tree"
  );

  // 2. Prove token has not been spent
  const nul = nullifier(sk);
  assert(!nullifiers.member(disclose(nul)), "already spent");

  // 3. Record the spend — reveals nullifier, not the commitment
  nullifiers.insert(disclose(nul));
  counter.increment(1);
}

// CRITICAL: commitment and nullifier MUST use different domain separators
// If they shared a domain, the same sk would produce the same hash for both
pure circuit commitment(sk: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([pad(32, "myapp:commit:v1"), sk]);
}

pure circuit nullifier(sk: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([pad(32, "myapp:nullifier:v1"), sk]);
}
```

**Use `HistoricMerkleTree` instead of `MerkleTree`** when: the tree has frequent insertions that would otherwise invalidate outstanding proofs. Use plain `MerkleTree` when proofs are always generated against the current root and items are never removed.

### Anonymous Allowlist (Merkle Membership)

Authorize a set of users without revealing which one is acting.

```compact
pragma language_version >= 0.22;
import CompactStandardLibrary;

export ledger allowlist: MerkleTree<16, Bytes<32>>;

witness secretKey(): Bytes<32>;
witness findAllowlistPath(pk: Bytes<32>): MerkleTreePath<16, Bytes<32>>;

export circuit addToAllowlist(commitment: Bytes<32>): [] {
  // Admin adds a commitment — reveals commitment (hash of user's key)
  // The commitment itself doesn't reveal who the user is unless brute-forced
  allowlist.insert(disclose(commitment));
}

export circuit allowlistedAction(): [] {
  const sk = secretKey();
  const pk = allowlistKey(sk);
  const path = findAllowlistPath(pk);

  assert(
    allowlist.checkRoot(merkleTreePathRoot<16, Bytes<32>>(path)),
    "not on allowlist"
  );

  // Action proceeds. Observer knows: "someone on the allowlist did this."
  // Observer does NOT know: which allowlisted user.
}

pure circuit allowlistKey(sk: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([pad(32, "myapp:allowlist:v1"), sk]);
}
```

---

## 6) Transaction Semantics — Security Implications

Midnight transactions execute in two phases with different failure behavior:

```
well-formedness check  →  guaranteed phase  →  fallible phase
```

| Phase | Failure behavior | Fee behavior |
|---|---|---|
| Well-formedness | Transaction rejected entirely, not included | No fee |
| Guaranteed | Transaction rejected entirely, not included | No fee |
| Fallible | Guaranteed phase effects persist; fallible phase rolled back | **Fees forfeited** |

**Security implications:**

**Partial success is real.** If your contract does work in the guaranteed phase (e.g., burns a token) and then fails in the fallible phase (e.g., a balance check fails), the burn is permanent but the balance isn't updated. Design state transitions so they either succeed atomically or the guaranteed phase does nothing consequential.

**Fees are forfeited on fallible failure.** An attacker who can force fallible failures can drain DUST from users' wallets. Ensure `assert` conditions in fallible circuits cannot be triggered by external state that an attacker can manipulate between proof generation and submission.

**Front-running via public transcript.** Because the public transcript (including which circuit was called and all circuit arguments) is visible in the mempool before finalization, an observer can potentially act on that information before the transaction lands. If ordering matters (e.g., a swap), design circuits that include slippage bounds or use commitment reveals to defer sensitive data.

---

## 7) What ZK Proofs Do and Do Not Guarantee

**ZK proofs guarantee:**
- The circuit logic ran correctly with some valid private inputs
- The public transcript faithfully records what the circuit read/wrote to the ledger
- The prover knew a witness satisfying all circuit constraints at proof time

**ZK proofs do NOT guarantee:**
- That the private inputs were "honest" from the application's perspective (only that they satisfied the circuit's `assert` statements)
- Anything about the prover's identity
- That the same witness values were used as in a previous call
- Confidentiality of circuit arguments — those are always public

**Practical consequence:** Every invariant your contract cares about must be enforced by an `assert` in the circuit. The ZK proof only proves what the circuit checks.

---

## 8) Merkle Tree Depth Selection

| Depth | Max leaves | Circuit impact | Use for |
|---|---|---|---|
| 8 | 256 | Minimal | Tiny allowlists, tests |
| 10 | 1,024 | Low | Small user sets |
| 16 | 65,536 | Moderate | Medium DApps |
| 20 | 1,048,576 | Higher | Large user sets |
| 32 | ~4 billion | Significant | Maximum scale |

Use the minimum depth needed. Each additional level increases circuit size and proof time. Overflow (inserting beyond capacity) is a runtime error — size your tree for your expected maximum.

`HistoricMerkleTree` stores all past roots — it has higher storage cost than `MerkleTree`. Only use it when you need to prove membership against a past root (e.g., when tree is frequently updated between proof generation and submission).

---

## 9) Security Quick-Reference Table

| Risk | Bad pattern | Safe pattern |
|---|---|---|
| Sensitive value on-chain | Circuit argument for private data | Move to `witness` |
| Membership reveals identity | `Set<T>` membership check | `MerkleTree<n, T>` path proof |
| Brute-forcible hash | `persistentHash` over small domain | `persistentCommit` with fresh nonce |
| Linked commitments | Same nonce across multiple commits | Round counter or fresh nonce per commit |
| Key reuse across purposes | Same `sk` → same hash everywhere | Unique domain separator per purpose |
| Commitment = nullifier collision | Same domain for both | Different `pad(32, ...)` strings |
| Replay attack | Auth without sequence counter | Include round/counter in public key derivation |
| Double-spend | No nullifier tracking | `Set<Bytes<32>>` nullifier registry |
| Untrusted witness | Use witness output directly | `assert` all witness outputs before use |
| Upgrade breaks commitments | `transientHash` in ledger | `persistentHash` / `persistentCommit` |
| Partial success trap | Consequential work in guaranteed phase | Keep guaranteed phase minimal |
| Front-running | Sensitive args in circuit parameters | Use witness + commitment reveal pattern |