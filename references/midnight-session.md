# Shared Browser Session + Providers (Ledger 9 / Midnight.js 5)

Canonical provider wiring for DApp Connector browser dApps (1AM, Lace). Copy into `lib/midnight.ts`.

Verified 21 Nov 2026 against `@midnightntwrk/midnight-js-*` 5.0.2, `ledger-v9` 1.0.2, `dapp-connector-api` 4.1.0 and
`compact-runtime` 0.21.0. `templates/locker-dapp`, `templates/leaderboard-dapp` and `templates/private-party-dapp` ship
this exact file, and all three type-check and pass `next build`.

See also [gotchas.md](gotchas.md) and [versions.json](versions.json).

## What changed from the Ledger 8 version

| Ledger 8 (Midnight.js 4) | Ledger 9 (Midnight.js 5) |
|---|---|
| `setNetworkId(config.networkId)` from `midnight-js-network-id` | Removed. `networkId` goes in `providers.config` (`{ networkId, ttlSeconds }`) |
| Hand-rolled `proofProvider` / `walletProvider` / `midnightProvider` around the connector | `dappConnectorProofProvider` + `dappConnectorWalletProviders` from `@midnightntwrk/midnight-js-dapp-connector-proof-provider` (era-aware) |
| Endpoints read from `api.getConfiguration()` by hand | `dappConnectorNetwork(api)` → `{ networkId, indexer: { queryURL, subscriptionURL }, nodeURL, nodeWsURL }` |
| `createPatchedPublicDataProvider` (the `offset: null` workaround) | Not needed. Plain `indexerPublicDataProvider(network.indexer)` (object form) |
| In-memory store with `setContractAddress()` | `PrivateStateProvider` is now `forContract(address)`-scoped; use `levelPrivateStateProvider` (IndexedDB in the browser) |
| `ContractState.deserialize(fromHex(hex))` from a custom query | `queryContractState(addr)` → `read.contractState.deserialize({ v9: ContractState })` |
| `coinPublicKeyToBytes()` hex fallback (silently returned 32 zero bytes for Bech32m input) | Connector keys are **Bech32m**: decode with `ShieldedCoinPublicKey.codec.decode(networkId, MidnightBech32m.parse(s))` |
| `createUnprovenDeployTx` + `submitTxAsync` + manual private-state writes | `deployContract` / `findDeployedContract` (stores private state + signing key for you) |

## Packages

```bash
npm install @midnight-ntwrk/compact-runtime@0.21.0 @midnight-ntwrk/compact-js@3.0.2 \
  @midnightntwrk/ledger-v9@1.0.2 @midnightntwrk/dapp-connector-api@4.1.0 \
  @midnightntwrk/midnight-js-contracts@5.0.2 @midnightntwrk/midnight-js-types@5.0.2 \
  @midnightntwrk/midnight-js-utils@5.0.2 @midnightntwrk/midnight-js-dapp-connector-proof-provider@5.0.2 \
  @midnightntwrk/midnight-js-indexer-public-data-provider@5.0.2 \
  @midnightntwrk/midnight-js-fetch-zk-config-provider@5.0.2 \
  @midnightntwrk/midnight-js-level-private-state-provider@5.0.2 \
  @midnightntwrk/wallet-sdk-address-format@4.0.1
```

`compact-runtime` and `compact-js` are still published only under `@midnight-ntwrk` (the compiler's generated code
imports `@midnight-ntwrk/compact-runtime`). Everything else above is `@midnightntwrk`.

## `lib/midnight.ts`

```typescript
import type { ConnectedAPI, InitialAPI } from '@midnightntwrk/dapp-connector-api';
import {
  dappConnectorNetwork,
  dappConnectorProofProvider,
  dappConnectorWalletProviders,
} from '@midnightntwrk/midnight-js-dapp-connector-proof-provider';
import { indexerPublicDataProvider } from '@midnightntwrk/midnight-js-indexer-public-data-provider';
import { FetchZkConfigProvider } from '@midnightntwrk/midnight-js-fetch-zk-config-provider';
import { levelPrivateStateProvider } from '@midnightntwrk/midnight-js-level-private-state-provider';
import type { MidnightProviders } from '@midnightntwrk/midnight-js-types';
import type { MidnightNetwork } from '@midnightntwrk/midnight-js-utils';
import { CostModel } from '@midnightntwrk/ledger-v9';
import { ContractState } from '@midnight-ntwrk/compact-runtime';
import { MidnightBech32m, ShieldedCoinPublicKey } from '@midnightntwrk/wallet-sdk-address-format';

export type ConnectedSession = {
  api: ConnectedAPI;
  /** Network id + endpoints, read from the wallet. There is no global setNetworkId any more. */
  network: MidnightNetwork;
  providers: MidnightProviders;
  unshieldedAddress: string;
  coinPublicKeyBytes: Uint8Array;
};

export function fromHex(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Uint8Array.from(h.match(/.{1,2}/g) ?? [], (b) => parseInt(b, 16));
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Demo-grade password for the encrypted IndexedDB private-state store: random, kept in localStorage.
 * Production apps should ask the user or derive it from wallet-held material.
 */
function demoStoragePassword(): Promise<string> {
  const k = 'midnight-private-storage-password';
  let pw = localStorage.getItem(k);
  if (!pw) {
    pw = `Mn-${crypto.randomUUID()}-${crypto.randomUUID()}`;
    localStorage.setItem(k, pw);
  }
  return Promise.resolve(pw);
}

export async function detectWallet(): Promise<InitialAPI> {
  const midnight = (window as unknown as { midnight?: Record<string, InitialAPI> }).midnight ?? {};
  const w = midnight['1am'] ?? Object.values(midnight)[0];
  if (!w) throw new Error('No Midnight wallet extension found');
  return w;
}

export async function createConnectedSession(api: ConnectedAPI, zkAssetPath: string): Promise<ConnectedSession> {
  const network = await dappConnectorNetwork(api);
  const [{ unshieldedAddress }, shielded] = await Promise.all([
    api.getUnshieldedAddress(),
    api.getShieldedAddresses(),
  ]);

  // zkAssetPath must serve compiler/ (contract-manifest.json, contract-info.json), keys/ and zkir/.
  const zkConfigProvider = new FetchZkConfigProvider<string>(
    new URL(zkAssetPath, window.location.origin).toString(),
    { fetchFunc: window.fetch.bind(window) },
  );
  const proofProvider = await dappConnectorProofProvider(api, zkConfigProvider, CostModel.initialCostModel());
  const { walletProvider, midnightProvider } = await dappConnectorWalletProviders(api);

  return {
    api,
    network,
    providers: {
      privateStateProvider: levelPrivateStateProvider({
        accountId: unshieldedAddress,
        privateStoragePasswordProvider: demoStoragePassword,
      }),
      publicDataProvider: indexerPublicDataProvider(network.indexer),
      zkConfigProvider,
      proofProvider,
      walletProvider,
      midnightProvider,
      config: { networkId: network.networkId, ttlSeconds: 3600 },
    },
    unshieldedAddress,
    // The connector returns keys in Bech32m, not hex.
    coinPublicKeyBytes: new Uint8Array(
      ShieldedCoinPublicKey.codec.decode(network.networkId, MidnightBech32m.parse(shielded.shieldedCoinPublicKey)).data,
    ),
  };
}

/** Latest on-chain state of a contract, decoded with this app's own compact-runtime copy. */
export async function queryLatestState(session: ConnectedSession, contractAddress: string) {
  const read = await session.providers.publicDataProvider.queryContractState(contractAddress);
  if (!read) return null;
  return read.contractState.deserialize({ v9: ContractState });
}
```

## Per-contract module (deploy / call / read)

The session's providers are contract-agnostic, so narrow them to the contract's circuit ids and private state:

```typescript
import type { ProvableCircuitId } from '@midnight-ntwrk/compact-js';
import { deployContract, findDeployedContract } from '@midnightntwrk/midnight-js-contracts';
import type { MidnightProviders } from '@midnightntwrk/midnight-js-types';
import { CompiledLockerContract, ledger, type LockerContract, type LockerPrivateState } from '../contract/src/index';
import { queryLatestState, type ConnectedSession } from './midnight';

const PRIVATE_STATE_ID = 'LockerPrivateState';
type LockerProviders = MidnightProviders<ProvableCircuitId<LockerContract>, typeof PRIVATE_STATE_ID, LockerPrivateState>;
const providersFor = (s: ConnectedSession) => s.providers as unknown as LockerProviders;

export async function deployLocker(session: ConnectedSession, beneficiarySecretKey: Uint8Array) {
  const deployed = await deployContract(providersFor(session), {
    compiledContract: CompiledLockerContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: { beneficiarySecretKey },
  });
  return deployed.deployTxData.public.contractAddress;
}

export async function release(session: ConnectedSession, contractAddress: string, recipient: Uint8Array) {
  const locker = await findDeployedContract(providersFor(session), {
    compiledContract: CompiledLockerContract,
    contractAddress,
    privateStateId: PRIVATE_STATE_ID,
  });
  await locker.callTx.release({ bytes: recipient }); // UserAddress → { bytes }; Bytes<32> → plain Uint8Array
}

export async function readLocker(session: ConnectedSession, contractAddress: string) {
  const state = await queryLatestState(session, contractAddress);
  return state ? ledger(state.data) : null;
}
```

And the compiled contract (`contract/src/index.ts`). `CompiledContract` comes from `@midnight-ntwrk/compact-js`, not
`compact-runtime`. Keep `node:path` / `node:url` out of anything the browser bundles:

```typescript
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { Contract } from './managed/locker/contract/index.js';
import { witnesses, type LockerPrivateState } from './witnesses';

export type LockerContract = Contract<LockerPrivateState>;
export const CompiledLockerContract = CompiledContract.make<LockerContract>('locker', Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets('/zk/locker'), // a label in the browser; keys load via FetchZkConfigProvider
);
```

Witnesses take `WitnessContext<Ledger, PrivateState>` (two type parameters in runtime 0.21) and return a mutable
`[PrivateState, value]` tuple.

## Serving ZK assets

`FetchZkConfigProvider` verifies an integrity manifest by default. Copy **`compiler/`, `keys/` and `zkir/`** from the
compiler output into `public/zk/<contract>/`. Without `compiler/contract-manifest.json` and `contract-info.json`, every
contract operation fails with `EraMismatchError` (`artifact-era-undeclared`).

```javascript
for (const dir of ['compiler', 'keys', 'zkir']) cpSync(join(src, dir), join(dest, dir), { recursive: true });
```

## Next.js page

The SDK pulls in WASM and `level` (IndexedDB in the browser, a native module on the server). Never prerender it:

```tsx
'use client';
import dynamic from 'next/dynamic';
const LockerClient = dynamic(() => import('./locker/LockerClient'), { ssr: false });
export default function Page() {
  return <LockerClient />;
}
```

## Headless / Node (Wallet SDK 2.x)

For scripts, tests and backends without a browser wallet. Type-checked against Wallet SDK 2.0.1. `buildHeadlessWallet`
was run against public Preview on 21 Nov 2026 and synced (protocol version `2001100`).

```typescript
import { WalletFacade, WalletEntrySchema } from '@midnightntwrk/wallet-sdk-facade';
import { MidnightBech32m, UnshieldedAddress } from '@midnightntwrk/wallet-sdk-address-format';
import { ShieldedWallet } from '@midnightntwrk/wallet-sdk-shielded';
import { UnshieldedWallet, createKeystore, PublicKey } from '@midnightntwrk/wallet-sdk-unshielded-wallet';
import { DustWallet } from '@midnightntwrk/wallet-sdk-dust-wallet';
import { WalletSeeds } from '@midnightntwrk/wallet-sdk-hd';
import { InMemoryTransactionHistoryStorage } from '@midnightntwrk/wallet-sdk-abstractions';
import { httpClientProofProvider } from '@midnightntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnightntwrk/midnight-js-indexer-public-data-provider';
import { NodeZkConfigProvider } from '@midnightntwrk/midnight-js-node-zk-config-provider';
import { levelPrivateStateProvider } from '@midnightntwrk/midnight-js-level-private-state-provider';
import { createLedger9WalletProvider, createLedger9MidnightProvider, type MidnightProviders } from '@midnightntwrk/midnight-js-types';
import { networks, type MidnightNetwork } from '@midnightntwrk/midnight-js-utils';

export const localNetwork: MidnightNetwork = {
  networkId: 'undeployed',
  indexer: {
    queryURL: 'http://localhost:8088/api/v4/graphql',
    subscriptionURL: 'ws://localhost:8088/api/v4/graphql/ws',
  },
  nodeURL: 'http://localhost:9944',
  nodeWsURL: 'ws://localhost:9944',
};

export function pickNetwork(name: 'undeployed' | 'preview' | 'preprod' | 'mainnet'): MidnightNetwork {
  if (name === 'undeployed') return localNetwork;
  if (name === 'preview') return networks.preview();
  const token = process.env.BLOCKFROST_PROJECT_ID;
  if (!token) throw new Error(`${name} is served by Blockfrost: set BLOCKFROST_PROJECT_ID`);
  return name === 'preprod' ? networks.preprod(token) : networks.mainnet(token);
}

export async function buildHeadlessWallet(network: MidnightNetwork, masterSeed: Uint8Array, proofServerUrl = 'http://localhost:6300') {
  const seeds = WalletSeeds.fromMasterSeed(masterSeed);
  const indexerClientConnection = {
    indexerHttpUrl: network.indexer.queryURL,
    indexerWsUrl: network.indexer.subscriptionURL,
  };

  const facade = await WalletFacade.init({
    configuration: {
      networkId: network.networkId,
      indexerClientConnection,
      relayURL: new URL(network.nodeWsURL),
      provingServerUrl: new URL(proofServerUrl),
      costParameters: { feeBlocksMargin: 5 },
      txHistoryStorage: new InMemoryTransactionHistoryStorage(WalletEntrySchema),
    },
    shielded: (config) => ShieldedWallet(config).startWithSeed(seeds.shielded),
    unshielded: (config) =>
      UnshieldedWallet(config).startWithPublicKey(
        PublicKey.fromKeyStore(createKeystore({ kind: 'schnorr', secret: seeds.unshielded }, config.networkId)),
      ),
    dust: (config) => DustWallet(config).startWithSeed(seeds.dust),
  });
  await facade.start(seeds);
  const state = await facade.waitForSyncedState();
  return { facade, seeds, state };
}

export async function buildProviders(
  network: MidnightNetwork,
  wallet: Awaited<ReturnType<typeof buildHeadlessWallet>>,
  zkConfigDir: string,
  privateStoragePassword: string,
  proofServerUrl = 'http://localhost:6300',
): Promise<MidnightProviders> {
  const { facade, seeds, state } = wallet;
  const keystore = createKeystore({ kind: 'schnorr', secret: seeds.unshielded }, network.networkId);
  const zkConfigProvider = new NodeZkConfigProvider<string>(zkConfigDir);

  const walletProvider = createLedger9WalletProvider({
    getCoinPublicKey: () => state.shielded.coinPublicKey.toHexString(),
    getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
    balanceTx: async (tx, ttl) => {
      const handle = facade.adoptTransaction(tx.serialize(), 'Unbound');
      const recipe = await facade.balanceUnboundTransaction(handle, {
        ttl: ttl ?? new Date(Date.now() + 3600_000),
      });
      const signed = await facade.signRecipe(recipe, (data) => Promise.resolve(keystore.signData(data)));
      return facade.finalizeRecipe(signed);
    },
  });

  const midnightProvider = createLedger9MidnightProvider(async (tx) =>
    facade.submitTransaction(facade.adoptTransaction(tx.serialize(), 'Finalized')),
  );

  return {
    privateStateProvider: levelPrivateStateProvider({
      accountId: keystore.getBech32Address().asString(),
      privateStoragePasswordProvider: async () => privateStoragePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(network.indexer),
    zkConfigProvider,
    proofProvider: httpClientProofProvider({ url: proofServerUrl, zkConfigProvider }),
    walletProvider,
    midnightProvider,
    config: { networkId: network.networkId, ttlSeconds: 3600 },
  };
}

export async function dustBalance(facade: WalletFacade): Promise<bigint> {
  const s = await facade.waitForSyncedState();
  return s.dust.balance(new Date());
}

export async function sendNight(facade: WalletFacade, facadeNetworkId: string, keystore: ReturnType<typeof createKeystore>, to: string, amount: bigint, nightTokenType: string) {
  const recipe = await facade.transferTransaction(
    [{ type: 'unshielded', outputs: [{ type: nightTokenType, receiverAddress: MidnightBech32m.parse(to).decode(UnshieldedAddress, facadeNetworkId), amount }] }],
    { ttl: new Date(Date.now() + 3600_000) },
  );
  const signed = await facade.signRecipe(recipe, (data) => Promise.resolve(keystore.signData(data)));
  return facade.submitTransaction(await facade.finalizeRecipe(signed));
}
```
