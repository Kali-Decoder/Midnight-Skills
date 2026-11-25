# Midnight Indexer Skill: 4) All Query Types

> Reference for the `indexer` skill. Back to [SKILL.md](../SKILL.md).

## 4) All Query Types

### Latest Block

```graphql
query {
  block {
    hash
    height
    timestamp
    protocolVersion
    ledgerParameters
    transactions {
      id
      hash
    }
  }
}
```

### Block by Height or Hash

```graphql
query {
  block(offset: { height: 42 }) {
    hash height timestamp
  }
}

query {
  block(offset: { hash: "3031323..." }) {
    hash height timestamp
  }
}
```

### Contract Action — Latest

```graphql
query($address: HexEncoded!) {
  contractAction(address: $address) {
    __typename
    address
    state
    zswapState
    transaction {
      hash
      block { height ledgerParameters }
      ... on RegularTransaction { fee identifiers }
    }
    unshieldedBalances {
      tokenType
      amount
    }
    ... on ContractCall {
      entryPoint
    }
  }
}
```

### Contract Action at a Specific Block

```graphql
query($address: HexEncoded!) {
  contractAction(
    address: $address,
    offset: { blockOffset: { height: 100 } }
  ) {
    state
    zswapState
  }
}
```

### Contract Action at a Specific Transaction

```graphql
query($address: HexEncoded!, $txHash: HexEncoded!) {
  contractAction(
    address: $address,
    offset: { transactionOffset: { hash: $txHash } }
  ) {
    state
  }
}
```

### Transactions by Hash or Identifier

```graphql
query($hash: HexEncoded!) {
  transactions(offset: { hash: $hash }) {
    __typename            # RegularTransaction | SystemTransaction | BridgeClaimTransaction
    id hash protocolVersion
    block { height hash }
    ... on RegularTransaction {
      identifiers
      fee                 # String (u128); `fees { paidFees estimatedFees }` is deprecated
      transactionResult { status segments { id success } }
    }
    contractActions {
      __typename
      address
      state
      ... on ContractDeploy { address }
      ... on ContractCall { entryPoint }
    }
    unshieldedCreatedOutputs {
      owner value tokenType intentHash outputIndex
    }
    unshieldedSpentOutputs {
      owner value tokenType intentHash outputIndex
    }
  }
}
```

### Unshielded Balances for a Contract

```graphql
query($address: HexEncoded!) {
  contractAction(address: $address) {
    unshieldedBalances {
      tokenType   # hex-encoded token type identifier
      amount      # string (supports u128)
    }
  }
}
```

Note: `ContractDeploy` always returns empty balances. Only `ContractCall` and `ContractUpdate` reflect meaningful balances.

### DUST Generation Status

```graphql
query {
  dustGenerationStatus(
    cardanoRewardAddresses: ["stake_test1uq..."]
  ) {
    cardanoRewardAddress
    dustAddress
    registered
    nightBalance
    generationRate
    currentCapacity
    maxCapacity
    utxoTxHash
    utxoOutputIndex
  }
}
```

The Ledger 9 upgrade reset DUST state: mainnet replayed cNIGHT registrations to full cap; Preprod cleared registrations not backed by cNIGHT (re-register); Preview relaunched empty. Generation parameters are unchanged.

`currentCapacity` is accurate only until the first DUST fee payment (fee payments are shielded — indexer can't track them). Use it as an approximation; query the wallet SDK directly for precise post-payment DUST balance.
