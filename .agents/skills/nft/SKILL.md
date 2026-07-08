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
- Compact devtools: `curl --proto '=https' --tlsv1.2 -sSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh`
- Add to PATH: `source $HOME/.local/bin/env`

### Add OpenZeppelin Contracts for Compact

```bash
mkdir my-nft-project && cd my-nft-project
git init
git submodule add https://github.com/OpenZeppelin/contracts-compact.git
cd contracts-compact && SKIP_ZK=true yarn && cd ..
```

## 2) OpenZeppelin NonFungibleToken Contract

The OpenZeppelin `NonFungibleToken` module provides an ERC721-like implementation in Compact.

### Key Features

| Feature | Status | Notes |
|---|---|---|
| Token ID type | `Uint<128>` | Uint256 not supported (circuit limits) |
| Transfers | ✅ | To ECDSA public keys or contract addresses |
| Approvals | ✅ | Per-token and operator approvals |
| Metadata URI | ✅ | Per-token URI storage |
| Pausable | ✅ | Through Pausable module |
| Ownable | ✅ | Through Ownable module |
| Contract-to-contract | ❌ | Not yet supported (use `_unsafeTransfer`) |

### Import and Use

```compact
pragma language_version >= 0.21.0;

import CompactStandardLibrary;
import "./contracts-compact/node_modules/@openzeppelin-compact/contracts/src/access/Ownable"
  prefix Ownable_;
import "./contracts-compact/node_modules/@openzeppelin-compact/contracts/src/security/Pausable"
  prefix Pausable_;
import "./contracts-compact/node_modules/@openzeppelin-compact/contracts/src/token/NonFungibleToken"
  prefix NonFungibleToken_;

constructor(
  _name: Opaque<"string">,
  _symbol: Opaque<"string">,
  _initOwner: Either<ZswapCoinPublicKey, ContractAddress>,
) {
  Ownable_initialize(_initOwner);
  NonFungibleToken_initialize(_name, _symbol);
}

export circuit mint(
  to: Either<ZswapCoinPublicKey, ContractAddress>,
  tokenId: Uint<128>,
  uri: Opaque<"string">,
): [] {
  Ownable_assertOnlyOwner();
  NonFungibleToken__mint(to, tokenId);
  NonFungibleToken__setTokenURI(tokenId, uri);
}

export circuit transferFrom(
  from: Either<ZswapCoinPublicKey, ContractAddress>,
  to: Either<ZswapCoinPublicKey, ContractAddress>,
  tokenId: Uint<128>,
): [] {
  Pausable_assertNotPaused();
  NonFungibleToken_transferFrom(from, to, tokenId);
}

export circuit approve(
  to: Either<ZswapCoinPublicKey, ContractAddress>,
  tokenId: Uint<128>,
): [] {
  NonFungibleToken_approve(to, tokenId);
}

export circuit setApprovalForAll(
  operator: Either<ZswapCoinPublicKey, ContractAddress>,
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

Expected output:
```
Compiling 5 circuits:
  circuit "mint" (k=11, rows=1180)
  circuit "transferFrom" (k=11, rows=1966)
  circuit "approve" (k=10, rows=966)
  circuit "pause" (k=10, rows=125)
  circuit "unpause" (k=10, rows=121)
Overall progress [====================] 5/5
```

## 5) Deploy and Interact (TypeScript)

```typescript
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { Contract } from './contracts/managed/MyNFT';

const compiledContract = CompiledContract.make('MyNFT', Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets('./contracts/managed/MyNFT'),
);

const providers = await buildProviders(/* see midnight-js skill */);
const deployed = await deployContract(providers, {
  compiledContract,
  privateStateId: 'nftPrivateState',
  initialPrivateState: {},
});

console.log('NFT Contract:', deployed.deployTxData.public.contractAddress);

// Mint an NFT
const mintResult = await deployed.callTx.mint(
  { type: 'left', value: callerPublicKey() },
  1n, // tokenId
  'https://my-nft.com/metadata/1.json',
);
```

## 6) Shielded vs Unshielded NFTs

| Aspect | Unshielded (Public) | Shielded (Private) |
|---|---|---|
| Ownership | Public on-chain | Private, only owner knows |
| Transfers | Visible to all | Hidden, ZK-proven |
| Metadata | Public URI on-chain | Can be committed/hashed |
| Gas/user cost | DUST fees | DUST fees (1AM sponsors on preview) |
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
| Contract-to-contract transfers | Not yet supported. Use `_unsafeTransfer` with caution. |
| String concatenation for base URI | Not supported in Compact. Store full URI per token. |
| `tokenId` overflow | Use `assert(tokenId < MAX_ID, "ID overflow")` before minting. |
| Missing `disclose()` on URI | Metadata URIs are public. Use `disclose()` when storing. |
| Shielded transfer without proof | Owner must sign transfers. Verify with `callerPublicKey()`. |

## 9) Testing NFT Contracts

```compact
// In contracts/src/test/MyNFT.test.compact
pragma language_version >= 0.21.0;

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
    "compact": "cd contracts && compact compile MyNFT.compact artifacts/MyNFT",
    "build": "tsc && npm run compact",
    "test": "cd contracts && compact compile MyNFT.test.compact artifacts/MyNFT.test"
  }
}
```

## 11) Useful Links

- [OpenZeppelin Contracts for Compact](https://docs.openzeppelin.com/contracts-compact) — Library documentation
- [Compact Language Guide](https://docs.midnight.network/compact) — Smart contract language reference
- [Midnight Token Functions](https://docs.midnight.network/compact/standard-library#coin-management) — Native token operations
- [1AM Wallet Integration](/1am-wallet/SKILL.md) — Connect wallet for NFT interactions
- [Compact Skill](/compact/SKILL.md) — Language fundamentals
