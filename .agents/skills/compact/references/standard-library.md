# Compact Language Skill: 6) Standard Library — Key Functions

> Reference for the `compact` skill. Back to [SKILL.md](../SKILL.md).

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

### Ledger 9 Additions (language 0.28.0)

All of these compile with 0.36.1. The snippets below were checked as one contract.

```compact
pragma language_version >= 0.28.0;
import CompactStandardLibrary;

// Contract type: the interface of another deployed contract.
contract Adder {
  circuit addTo(n: Uint<64>): Uint<64>;   // may NOT be `pure` inside a contract type
}

export ledger lastDigest: Bytes<32>;
export ledger verified: Boolean;
export ledger ethAddr: Bytes<20>;

// Keccak-256 (native circuit)
export circuit hashIt(x: Bytes<32>): Bytes<32> {
  const d = keccak256<Bytes<32>>(x);
  lastDigest = disclose(d);
  return d;
}

// Native secp256k1 ECDSA verification
export circuit checkSig(msgHash: Bytes<32>, sig: Secp256k1EcdsaSignature, pk: Secp256k1Point): [] {
  const ok = secp256k1EcdsaVerify(msgHash, sig, pk);   // rejects the identity point as pk
  assert(ok, "bad signature");
  verified = disclose(ok);
  ethAddr = disclose(secp256k1EthereumAddress(pk));
}

// Event emission: events are public; emitting from the constructor is an error
export circuit announce(name: Bytes<32>, payload: Bytes<256>): [] {
  emit(Misc { name: disclose(name), payload: disclose(payload) });
}

// Contract-to-contract call: the callee reference AND every argument must be disclosed
export circuit callAdder(a: Adder, n: Uint<64>): Uint<64> {
  return disclose(a).addTo(disclose(n));
}
```

| Addition | Notes |
|---|---|
| `keccak256<T>(v): Bytes<32>` | Also `sha512<T>(v): Bytes<64>` (no feature flag needed since 0.36) |
| `secp256k1EcdsaVerify(msgHash, sig, pk): Boolean` | `msgHash` is taken as given (hash the message yourself). `Secp256k1Point` values cannot be created in Compact; pass them as arguments or return them from witnesses. Also `secp256k1PointX/Y`, `ecAdd`/`ecMul`/`ecMulGenerator` overloads. |
| `emit(e)` | `e` is a standard event struct: `Misc { name: Bytes<32>, payload: Bytes<256> }`, `ShieldedSpend`, `UnshieldedReceive`, `Paused`, … Indexed by the indexer (`contractEvents`). |
| `contract X { circuit ...; }` + `contract implements X;` | Cross-contract calls (phase 1). Values of contract type come from arguments or ledger state; Compact cannot create them. Cycles fail at run time. Callers and callees must both be built with 0.36.x / runtime 0.21. |
| `kernel.caller()` | Returns `Maybe<PublicAddress>` (added in 0.35) |

**Breaking changes to know:** a `pure circuit` *inside a contract type* is a compile error (top-level `pure circuit` helpers are fine); undisclosed cross-contract arguments are a disclosure error; casting any field type other than `Field` to `Boolean` is a type error; `--feature-zkir-v3` was removed (ZKIR v3 is the only backend); the stdlib `add`/`mul` circuits were removed; curve types (`JubjubPoint`, `Secp256k1Point`, …) must be imported from `CompactStandardLibrary`, not exported at top level.
