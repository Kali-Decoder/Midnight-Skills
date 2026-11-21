// Browser-side Midnight wiring: genesis-funded fee wallet, providers, and
// compiled-contract handles. Mirrors src/node/wallet.ts minus the
// Node-specific pieces (ws, fs, level db).
//
// The embedded wallet exists ONLY to balance and pay for transactions on
// the localnet — fee handling is out of the custody prototype's scope (C24).

import * as Rx from 'rxjs';

import { httpClientProofProvider } from '@midnightntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnightntwrk/midnight-js-indexer-public-data-provider';
import { FetchZkConfigProvider } from '@midnightntwrk/midnight-js-fetch-zk-config-provider';
import {
  createLedger9MidnightProvider,
  createLedger9WalletProvider,
  type MidnightProviders,
  type PrivateStateProvider,
} from '@midnightntwrk/midnight-js-types';
import { InMemoryTransactionHistoryStorage } from '@midnightntwrk/wallet-sdk-abstractions';
import { WalletFacade, WalletEntrySchema } from '@midnightntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnightntwrk/wallet-sdk-dust-wallet';
import { WalletSeeds } from '@midnightntwrk/wallet-sdk-hd';
import { WasmProver } from '@midnightntwrk/wallet-sdk-prover-client/effect';
import { ShieldedWallet } from '@midnightntwrk/wallet-sdk-shielded';
import {
  createKeystore,
  PublicKey,
  UnshieldedWallet,
} from '@midnightntwrk/wallet-sdk-unshielded-wallet';
import { CompiledContract } from '@midnight-ntwrk/compact-js';

import { Contract } from '../../../src/wallet/contract.js';
import { makeWitnesses } from '../../../src/wallet/witnesses.js';
import { hexToBytes } from '../../../src/wallet/hex.js';
import * as FaucetModule from '../../../contracts/managed/faucet/contract/index.js';
import { Contract as IdentityRegistryContract } from '../../../src/wallet/identity.js';

import { proveStarted, proveEnded } from './txTracker.js';
import { wasmProofProvider } from './wasmProver.js';

// The local demo defaults to the Docker proof server because it is the most
// reliable path for live calls. `?prover=browser` opts into the experimental
// in-tab zkir-v2 prover described in BROWSER-PROVING-SCOPE.md.
const proverParam =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('prover')
    : null;
export const BROWSER_PROVER = proverParam === 'browser';

// Localnet genesis wallet — the dev node funds this seed at genesis.
// Demo-only; never use outside a throwaway local network.
export const GENESIS_SEED =
  '0000000000000000000000000000000000000000000000000000000000000001';

const ORIGIN = window.location.origin;
const WS_ORIGIN = ORIGIN.replace(/^http/, 'ws');

export const CONFIG = {
  networkId: 'undeployed',
  indexer: `${ORIGIN}/indexer/api/v4/graphql`,
  indexerWS: `${WS_ORIGIN}/indexer/api/v4/graphql/ws`,
  node: `${ORIGIN}/rpc`,
  // The proof server sends permissive CORS headers, so the browser talks to
  // it directly — proxying the multi-megabyte streaming /prove bodies
  // through Vite's http-proxy breaks the wallet's proving step.
  proofServer: 'http://127.0.0.1:6300',
};

// Ledger 9 / Wallet SDK 2.x: networkId is passed in each configuration
// (setNetworkId was removed in Midnight.js 5); no ledger-v8 tryApply patch.

export async function createWallet(seedHex: string) {
  const seeds = WalletSeeds.fromMasterSeed(hexToBytes(seedHex));
  const networkId = CONFIG.networkId;
  const unshieldedKeystore = createKeystore({ kind: 'schnorr', secret: seeds.unshielded }, networkId);

  const wallet = await WalletFacade.init({
    configuration: {
      networkId,
      indexerClientConnection: {
        indexerHttpUrl: CONFIG.indexer,
        indexerWsUrl: CONFIG.indexerWS,
      },
      // With ?prover=browser the balancing proofs (zswap, dust) are computed in
      // this tab by the Wallet SDK's own WasmProver, reading ledger-v9
      // (generation 10) key material staged under /zk-params and checked
      // against the hashes the ledger release declares.
      provers: BROWSER_PROVER
        ? {
            v9: {
              kind: 'wasm',
              keyMaterialProvider: WasmProver.makeV9KeyMaterialProvider({ source: `${ORIGIN}/zk-params/` }),
            },
          }
        : { v9: { kind: 'server', url: new URL(CONFIG.proofServer) } },
      relayURL: new URL(CONFIG.node.replace(/^http/, 'ws')),
      costParameters: { feeBlocksMargin: 100 },
      txHistoryStorage: new InMemoryTransactionHistoryStorage(WalletEntrySchema),
    },
    shielded: (config) => ShieldedWallet(config).startWithSeed(seeds.shielded),
    unshielded: (config) =>
      UnshieldedWallet(config).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
    dust: (config) => DustWallet(config).startWithSeed(seeds.dust),
  });

  await wallet.start(seeds);
  return { wallet, seeds, unshieldedKeystore };
}

export type WalletContext = Awaited<ReturnType<typeof createWallet>>;

export async function awaitSync(walletCtx: WalletContext) {
  return Rx.firstValueFrom(walletCtx.wallet.state().pipe(Rx.filter((s) => s.isSynced === true)));
}

// In-memory PrivateStateProvider — secrets live for the page session only.
// (C16 wallet-local-storage is its own component; the demo deliberately
// re-derives the device secret from the passkey on every page load.)
// Midnight.js 5 scopes private state per contract via forContract(address).
export function inMemoryPrivateStateProvider(): PrivateStateProvider {
  const states = new Map<string, Map<string, unknown>>();
  const signingKeys = new Map<string, unknown>();
  const scoped = (address: string) => {
    let m = states.get(address);
    if (!m) states.set(address, (m = new Map()));
    return m;
  };
  const unsupported = async (): Promise<never> => {
    throw new Error('not supported in the demo');
  };
  const provider = {
    forContract(address: string) {
      const m = scoped(address);
      return {
        get: async (id: string) => (m.has(id) ? m.get(id) : null),
        set: async (id: string, state: unknown) => void m.set(id, state),
        remove: async (id: string) => void m.delete(id),
        clear: async () => m.clear(),
      };
    },
    clearAll: async () => states.clear(),
    setSigningKey: async (address: string, key: unknown) => void signingKeys.set(address, key),
    getSigningKey: async (address: string) => signingKeys.get(address) ?? null,
    removeSigningKey: async (address: string) => void signingKeys.delete(address),
    clearSigningKeys: async () => signingKeys.clear(),
    exportPrivateStates: unsupported,
    importPrivateStates: unsupported,
    exportSigningKeys: unsupported,
    importSigningKeys: unsupported,
  };
  return provider as unknown as PrivateStateProvider;
}

export async function createProviders(
  walletCtx: WalletContext,
  contractName: 'account' | 'faucet' | 'identity_registry',
): Promise<MidnightProviders> {
  const { wallet, unshieldedKeystore } = walletCtx;
  const state = await awaitSync(walletCtx);
  const signSegment = (payload: Uint8Array) => Promise.resolve(unshieldedKeystore.signData(payload));

  const walletProvider = createLedger9WalletProvider({
    getCoinPublicKey: () => state.shielded.coinPublicKey.toHexString(),
    getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
    async balanceTx(tx, ttl) {
      const recipe = await wallet.balanceUnboundTransaction(wallet.adoptTransaction(tx.serialize(), 'Unbound'), {
        ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000),
      });
      return wallet.finalizeRecipe(await wallet.signRecipe(recipe, signSegment));
    },
  });
  const midnightProvider = createLedger9MidnightProvider((tx) =>
    wallet.submitTransaction(wallet.adoptTransaction(tx.serialize(), 'Finalized')),
  );

  // Must serve compiler/ (contract-manifest.json), keys/ and zkir/ under /zk/<name>.
  const zkConfigProvider = new FetchZkConfigProvider<string>(`${ORIGIN}/zk/${contractName}`, {
    fetchFunc: window.fetch.bind(window),
  });

  // Wrapped so the UI's proving dock sees when the prover is actually
  // working (build → prove → submit phases in txTracker). With
  // ?prover=browser the proof is computed in this tab by the zkir wasm
  // prover; otherwise it goes to the local proof server.
  const baseProofProvider = httpClientProofProvider({ url: CONFIG.proofServer, zkConfigProvider });
  const proofProvider = BROWSER_PROVER
    ? wasmProofProvider(zkConfigProvider)
    : {
        supportedEras: baseProofProvider.supportedEras,
        proveTx: async (...args: Parameters<typeof baseProofProvider.proveTx>) => {
          proveStarted();
          try {
            return await baseProofProvider.proveTx(...args);
          } finally {
            proveEnded();
          }
        },
      };

  return {
    privateStateProvider: inMemoryPrivateStateProvider(),
    publicDataProvider: indexerPublicDataProvider({ queryURL: CONFIG.indexer, subscriptionURL: CONFIG.indexerWS }),
    zkConfigProvider,
    proofProvider,
    walletProvider,
    midnightProvider,
    config: { networkId: CONFIG.networkId, ttlSeconds: 30 * 60 },
  };
}

export function compiledAccountContract() {
  return CompiledContract.make('account', Contract as any).pipe(
    CompiledContract.withWitnesses(makeWitnesses() as any),
    CompiledContract.withCompiledFileAssets('/zk/account'),
  );
}

export function compiledFaucetContract() {
  return CompiledContract.make('faucet', (FaucetModule as any).Contract).pipe(
    CompiledContract.withVacantWitnesses,
    CompiledContract.withCompiledFileAssets('/zk/faucet'),
  );
}

export function compiledIdentityRegistryContract() {
  return CompiledContract.make('identity_registry', IdentityRegistryContract as any).pipe(
    CompiledContract.withVacantWitnesses,
    CompiledContract.withCompiledFileAssets('/zk/identity_registry'),
  );
}

// User-facing byte helpers (mirrors src/node/wallet.ts).

export function userAddressBytes(walletCtx: WalletContext): Uint8Array {
  const pk: any = walletCtx.unshieldedKeystore.getPublicKey();
  const hex: string = typeof pk?.toHexString === 'function' ? pk.toHexString() : String(pk?.bytes ?? pk);
  const out = new Uint8Array(32);
  out.set(hexToBytes(hex.replace(/^0x/, '')).subarray(0, 32));
  return out;
}

export function coinPublicKeyBytes(state: any): Uint8Array {
  const cpk = state.shielded.coinPublicKey;
  const hex: string = typeof cpk?.toHexString === 'function' ? cpk.toHexString() : String(cpk?.bytes ?? cpk);
  const out = new Uint8Array(32);
  out.set(hexToBytes(hex.replace(/^0x/, '')).subarray(0, 32));
  return out;
}
