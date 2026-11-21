---
name: nft
description: Build shielded and unshielded NFTs on Midnight using OpenZeppelin Compact contracts and native Midnight token functions. Covers NonFungibleToken (ERC721-like), minting, transfers, metadata, and privacy preserving patterns.
---

**Scope**
This skill covers NFT development on Midnight Network. It includes the OpenZeppelin NonFungibleToken contract (ERC721-like implementation in Compact) and native Midnight token operations (shielded/unshielded). Covers minting, transfers, approvals, metadata URIs, and privacy patterns for NFTs.

Place files exactly as shown:
- `contracts/NonFungibleToken.compact` → OpenZeppelin base contract
- `contracts/MyNFT.compact` → your custom NFT contract
- `test/` → contract unit tests

## 1) Installation

### Prerequisites

- [Node.js v22.15+](https://nodejs.org/)
- Compact devtools (pinned release): `curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/download/compact-v0.5.1/compact-installer.sh | sh`
- Compact toolchain for Ledger 9: `compact update 0.36.1` (language `0.28.0`)

### Add OpenZeppelin Contracts for Compact

```bash
mkdir my-nft-project && cd my-nft-project && npm init -y
npm install @openzeppelin/compact-contracts@0.5.0-alpha.2
```

**Version note (21 Nov 2026):** OZ's latest *stable* release, `0.4.0`, targets Compact 0.31 / Ledger 8. The Ledger 9 line (language 0.28.0, `compact-runtime` 0.21.0) is `0.5.0-alpha.2`. OZ marks pre-releases as unaudited and not for production, so ship on a stable release targeting Ledger 9 once one exists. The repo is `github.com/OpenZeppelin/compact-contracts` (the old `contracts-compact` / `@openzeppelin-compact/contracts` names are gone). Import modules through `./node_modules/@openzeppelin/compact-contracts/<area>/<Module>` (no `src/`). The contract below compiles with that layout on 0.36.1.

## 2) OpenZeppelin NonFungibleToken Contract

The OpenZeppelin `NonFungibleToken` module provides an ERC721-like implementation in Compact.

### Key Features

| Feature | Status | Notes |
|---|---|---|
| Token ID type | `Uint<128>` | Uint256 not supported (circuit limits) |
| Transfers | ✅ | To account IDs (`persistentHash(secretKey)` from the `wit_NonFungibleTokenSK` witness) |
| Approvals | ✅ | Per-token and operator approvals |
| Metadata URI | ✅ | Per-token URI storage |
| Pausable | ✅ | Through Pausable module |
| Ownable | ✅ | Through Ownable module |
| Contract recipients | ⚠️ | Compact supports cross-contract calls since Ledger 9, but OZ's NFT module *has not migrated to them yet*. `transfer`/`transferFrom`/`_mint` reject `ContractAddress` recipients; `_unsafe*` variants allow them, but the token is stranded until OZ's C2C migration lands |

### Import and Use

```compact
pragma language_version >= 0.28.0;

import CompactStandardLibrary;
import "./node_modules/@openzeppelin/compact-contracts/access/Ownable"
  prefix Ownable_;
import "./node_modules/@openzeppelin/compact-contracts/security/Pausable"
  prefix Pausable_;
import "./node_modules/@openzeppelin/compact-contracts/utils/Utils"
  prefix Utils_;
import "./node_modules/@openzeppelin/compact-contracts/token/NonFungibleToken"
  prefix NonFungibleToken_;

constructor(
  _name: Opaque<"string">,
  _symbol: Opaque<"string">,
  _initOwner: Either<Bytes<32>, ContractAddress>,
) {
  Ownable_initialize(_initOwner);
  NonFungibleToken_initialize(_name, _symbol);
}

export circuit mint(
  to: Either<Bytes<32>, ContractAddress>,
  tokenId: Uint<128>,
  uri: Opaque<"string">,
): [] {
  Ownable_assertOnlyOwner();
  NonFungibleToken__mint(to, tokenId);
  NonFungibleToken__setTokenURI(tokenId, uri);
}

export circuit transferFrom(
  fromAddress: Either<Bytes<32>, ContractAddress>,
  to: Either<Bytes<32>, ContractAddress>,
  tokenId: Uint<128>,
): [] {
  Pausable_assertNotPaused();
  NonFungibleToken_transferFrom(fromAddress, to, tokenId);
}

export circuit approve(
  to: Either<Bytes<32>, ContractAddress>,
  tokenId: Uint<128>,
): [] {
  NonFungibleToken_approve(to, tokenId);
}

export circuit setApprovalForAll(
  operator: Either<Bytes<32>, ContractAddress>,
  approved: Boolean,
): [] {
  Ownable_assertOnlyOwner();
  NonFungibleToken_setApprovalForAll(operator, approved);
}

export circuit pause(): [] {
  Ownable_assertOnlyOwner();
  Pausable__pause();
}

export circuit unpause(): [] {
  Ownable_assertOnlyOwner();
  Pausable__unpause();
}

// Account ID helper for the TypeScript side: same derivation OZ uses (persistentHash of the secret key)
export pure circuit accountIdOf(secretKey: Bytes<32>): Bytes<32> {
  return Utils_computeAccountId(secretKey);
}
```

## 3) Native Midnight NFT Patterns

Midnight's standard library provides native token functions for shielded/unshielded operations.

### Unshielded NFT (Public)

```compact
import CompactStandardLibrary;

export ledger nextTokenId: Uint<128>;
export ledger owners: Map<Uint<128>, Either<ZswapCoinPublicKey, ContractAddress>>;
export ledger tokenURIs: Map<Uint<128>, Opaque<"string">>;

export circuit mint(
  to: Either<ZswapCoinPublicKey, ContractAddress>,
  uri: Opaque<"string">,
): Uint<128> {
  const tokenId = nextTokenId;
  nextTokenId += 1;
  owners.insert(disclose(tokenId), disclose(to));
  tokenURIs.insert(disclose(tokenId), disclose(uri));
  return tokenId;
}

export circuit transfer(
  from: Either<ZswapCoinPublicKey, ContractAddress>,
  to: Either<ZswapCoinPublicKey, ContractAddress>,
  tokenId: Uint<128>,
): [] {
  const owner = owners.lookup(disclose(tokenId));
  assert(owner == disclose(from), "Not owner");
  owners.insert(disclose(tokenId), disclose(to));
}

export circuit tokenURI(tokenId: Uint<128>): Opaque<"string"> {
  return tokenURIs.lookup(disclose(tokenId));
}
```

### Shielded NFT (Private Ownership)

Use the Compact standard library's shielded token functions:

```compact
import CompactStandardLibrary;

// Mint a shielded NFT
export circuit mintShielded(
  to: ZswapCoinPublicKey,
  metadataHash: Field,
): Uint<128> {
  const tokenId = nextTokenId;
  nextTokenId += 1;

  // Store commitment to ownership + metadata
  const commitment = persistentCommit<Uint<128>>(tokenId, freshNonce());
  shieldedCommitments.insert(disclose(to), commitment);

  return tokenId;
}

// Transfer shielded NFT (prove ownership without revealing tokenId publicly)
export circuit transferShielded(
  tokenId: Uint<128>,
  newOwner: ZswapCoinPublicKey,
): [] {
  // Use ZK proof to demonstrate ownership
  // Owner's shielded wallet signs the transfer
  const oldCommitment = shieldedCommitments.lookup(disclose(callerPublicKey()));
  assert(oldCommitment != default<Field>(), "Not owner");

  shieldedCommitments.remove(disclose(callerPublicKey()));
  shieldedCommitments.insert(disclose(newOwner), oldCommitment);
}
```

## 4) Compile the Contract

```bash
cd contracts
compact compile MyNFT.compact artifacts/MyNFT
```

Output looks like this (the `k`/`rows` numbers depend on the OZ version and changed with compiler 0.36 / ZKIR v3, so treat them as illustrative):
```
Compiling 5 circuits:
  circuit "mint" (k=11, rows=…)
  circuit "transferFrom" (k=11, rows=…)
  ...
```

Use `compact compile +0.36.1 ...` to pin the toolchain. The TypeScript side must implement the OZ witness `wit_NonFungibleTokenSK(): Bytes<32>` (the caller's secret key; its `persistentHash` is the on-chain account ID).

## 5) Deploy and Interact (TypeScript)

OZ's modules read the caller's secret key through **two witnesses**, `wit_OwnableSK` and `wit_NonFungibleTokenSK`, so the contract cannot use `withVacantWitnesses`. Owners and recipients are `Either<Bytes<32>, ContractAddress>` in the generated TS shape (`{ is_left, left, right }`), where `left` is the account ID computed by the contract's `accountIdOf` pure circuit. This flow was executed against the compiled contract on runtime 0.21: the owner mints and transfers, and a non-owner mint is rejected.

```typescript
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import { deployContract } from '@midnightntwrk/midnight-js-contracts';
import { Contract, pureCircuits, type Ledger } from './contracts/artifacts/MyNFT/contract/index.js';

type NftPrivateState = { secretKey: Uint8Array };
const sk = ({ privateState }: WitnessContext<Ledger, NftPrivateState>): [NftPrivateState, Uint8Array] =>
  [privateState, privateState.secretKey];

const compiledContract = CompiledContract.make<Contract<NftPrivateState>>('MyNFT', Contract).pipe(
  CompiledContract.withWitnesses({ wit_OwnableSK: sk, wit_NonFungibleTokenSK: sk }),
  CompiledContract.withCompiledFileAssets('./contracts/artifacts/MyNFT'),
);

const account = (secretKey: Uint8Array) => ({
  is_left: true,
  left: pureCircuits.accountIdOf(secretKey),   // = persistentHash([secretKey]), same as OZ
  right: { bytes: new Uint8Array(32) },
});

const secretKey = crypto.getRandomValues(new Uint8Array(32));   // persist it: it IS the owner identity
const providers = await buildProviders(/* see midnight-js skill: includes config: { networkId, ttlSeconds } */);

const deployed = await deployContract(providers, {
  compiledContract,
  privateStateId: 'nftPrivateState',
  initialPrivateState: { secretKey },
  args: ['My NFT', 'MNFT', account(secretKey)],   // constructor(name, symbol, initOwner)
});

await deployed.callTx.mint(account(secretKey), 1n, 'https://my-nft.com/metadata/1.json');
```

**Dependency warning:** `@openzeppelin/compact-contracts@0.5.0-alpha.2` depends on `@openzeppelin/compact-cli`, which pulls a Ledger 8 chain (`compact-deployer` → Midnight.js 4.1.1, `compact-runtime` 0.16.0). Pin `@midnight-ntwrk/compact-runtime@0.21.0` in your own `package.json` (and an `overrides` entry if your app resolves the 0.16 copy). Otherwise the compiled contract fails with `Version mismatch: compiled code expects 0.21.0, runtime is 0.16.0`.

## 6) Shielded vs Unshielded NFTs

| Aspect | Unshielded (Public) | Shielded (Private) |
|---|---|---|
| Ownership | Public on-chain | Private, only owner knows |
| Transfers | Visible to all | Hidden, ZK-proven |
| Metadata | Public URI on-chain | Can be committed/hashed |
| Gas/user cost | DUST fees | DUST fees (1AM has advertised sponsorship; confirm after the Ledger 9 DUST reset) |
| Use case | Public art, collectibles | Confidential assets, private collectibles |
| Token ID | Visible | Can be hidden with commitments |

### When to Use Shielded NFTs

- **Confidential ownership**: When who owns the NFT should remain private
- **Private collectibles**: High-value items where ownership is sensitive
- **Compliance-by-design**: Only reveal ownership when required

### When to Use Unshielded NFTs

- **Public art**: Ownership is part of the value proposition
- **Transparent DAOs**: Governance tokens as NFTs
- **Standard collectibles**: Where public provenance adds value

## 7) Metadata Handling

### Public Metadata (Unshielded)

```compact
export ledger tokenURIs: Map<Uint<128>, Opaque<"string">;

export circuit setTokenURI(
  tokenId: Uint<128>,
  uri: Opaque<"string">,
): [] {
  tokenURIs.insert(disclose(tokenId), disclose(uri));
}
```

### Private Metadata (Shielded)

```compact
// Store only a commitment on-chain
export ledger metadataCommitments: Map<Uint<128>, Field>;

export circuit setPrivateMetadata(
  tokenId: Uint<128>,
  metadataHash: Field, // hash of off-chain metadata
): [] {
  const commitment = persistentCommit<Uint<128>>(tokenId, freshNonce());
  metadataCommitments.insert(disclose(tokenId), commitment);
}
```

## 8) Common Pitfalls

| Issue | Solution |
|---|---|
| `Uint<256>` token IDs | Not supported. Use `Uint<128>` max (circuit constraint). |
| Contract recipients | OZ's NFT module hasn't migrated to Ledger 9 cross-contract calls yet. `_unsafeTransfer` strands the token in the receiving contract. |
| `parse error: found keyword "from"` | `from` is reserved in language 0.28; rename the parameter (e.g. `fromAddress`). |
| `Either<ZswapCoinPublicKey, …>` type errors | OZ 0.5 uses `Either<Bytes<32>, ContractAddress>` (account ID = `persistentHash(secretKey)`). |
| String concatenation for base URI | Not supported in Compact. Store full URI per token. |
| `tokenId` overflow | Use `assert(tokenId < MAX_ID, "ID overflow")` before minting. |
| Missing `disclose()` on URI | Metadata URIs are public. Use `disclose()` when storing. |
| Authorization | OZ authorizes via the secret-key witness (`wit_NonFungibleTokenSK`). Never derive authority from `ownPublicKey()`. |

## 9) Testing NFT Contracts

```compact
// In contracts/src/test/MyNFT.test.compact
pragma language_version >= 0.28.0;

import MyNFT;
import CompactStandardLibrary;

constructor() {
  MyNFT_initialize("MyNFT", "MNFT");
}

export circuit testMint(): [] {
  const tokenId = MyNFT_mint(disclose(callerPublicKey()), "uri1");
  assert(tokenId == 1, "First token should be 1");
}

export circuit testTransfer(): [] {
  MyNFT_transferFrom(
    callerPublicKey(),
    someOtherKey(),
    1,
  );
  const newOwner = MyNFT_ownerOf(1);
  assert(newOwner == someOtherKey(), "Transfer failed");
}
```

## 10) Package.json Scripts

```json
{
  "scripts": {
    "compact": "cd contracts && compact compile +0.36.1 MyNFT.compact artifacts/MyNFT",
    "build": "tsc && npm run compact",
    "test": "cd contracts && compact compile +0.36.1 --skip-zk MyNFT.test.compact artifacts/MyNFT.test"
  }
}
```

## 11) Useful Links

- [OpenZeppelin Contracts for Compact](https://docs.openzeppelin.com/contracts-compact) — Library documentation
- [Compact Language Guide](https://docs.midnight.network/compact) — Smart contract language reference
- [Midnight Token Functions](https://docs.midnight.network/compact/standard-library#coin-management) — Native token operations
- [1AM Wallet Integration](/1am-wallet/SKILL.md) — Connect wallet for NFT interactions
- [Compact Skill](/compact/SKILL.md) — Language fundamentals
