# Compact Language Skill: 8) Complete Contract Examples

> Reference for the `compact` skill. Back to [SKILL.md](../SKILL.md).

## 8) Complete Contract Examples

### Minimal Bulletin Board (No Privacy)

```compact
pragma language_version >= 0.28.0;

export ledger message: Opaque<"string">;

export circuit post(msg: Opaque<"string">): [] {
  message = disclose(msg);
}
```

### Bulletin Board with Ownership (Privacy Pattern)

```compact
pragma language_version >= 0.28.0;

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
pragma language_version >= 0.28.0;

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
