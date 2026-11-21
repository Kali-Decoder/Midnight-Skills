// Ledger 9 / Midnight.js 5 browser session for DApp Connector wallets (1AM, Lace).
// Canonical copy: references/midnight-session.md. Keep the templates in sync with it.
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
