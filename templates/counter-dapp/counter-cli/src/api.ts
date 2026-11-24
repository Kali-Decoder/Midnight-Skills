import { type ContractAddress, ContractState } from '@midnight-ntwrk/compact-runtime';
import { Counter, type CounterPrivateState, witnesses } from '@midnight-ntwrk/counter-contract';
import { unshieldedToken } from '@midnightntwrk/ledger-v9';
import { deployContract, findDeployedContract } from '@midnightntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnightntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnightntwrk/midnight-js-indexer-public-data-provider';
import { NodeZkConfigProvider } from '@midnightntwrk/midnight-js-node-zk-config-provider';
import { createLedger9MidnightProvider, createLedger9WalletProvider } from '@midnightntwrk/midnight-js-types';
import { InMemoryTransactionHistoryStorage } from '@midnightntwrk/wallet-sdk-abstractions';
import { WalletFacade, WalletEntrySchema, type FacadeState } from '@midnightntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnightntwrk/wallet-sdk-dust-wallet';
import { WalletSeeds, generateRandomSeed } from '@midnightntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnightntwrk/wallet-sdk-shielded';
import {
  createKeystore,
  PublicKey,
  UnshieldedWallet,
  type UnshieldedKeystore,
} from '@midnightntwrk/wallet-sdk-unshielded-wallet';
import { type Logger } from 'pino';
import * as Rx from 'rxjs';
import { WebSocket } from 'ws';
import {
  type CounterCircuits,
  type CounterContract,
  CounterPrivateStateId,
  type CounterProviders,
  type DeployedCounterContract,
} from './common-types';
import { type Config, contractConfig } from './config';
import { levelPrivateStateProvider } from '@midnightntwrk/midnight-js-level-private-state-provider';
import { assertIsContractAddress, toHex } from '@midnightntwrk/midnight-js-utils';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { Buffer } from 'buffer';
import {
  MidnightBech32m,
  ShieldedAddress,
  ShieldedCoinPublicKey,
  ShieldedEncryptionPublicKey,
} from '@midnightntwrk/wallet-sdk-address-format';

let logger: Logger;

globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

const counterCompiledContract = CompiledContract.make('counter', Counter.Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(contractConfig.zkConfigPath),
);

export interface WalletContext {
  wallet: WalletFacade;
  seeds: WalletSeeds;            // Wallet SDK 2.x starts from seeds, not key objects
  unshieldedKeystore: UnshieldedKeystore;
  networkId: string;
}

export const getCounterLedgerState = async (
  providers: CounterProviders,
  contractAddress: ContractAddress,
): Promise<bigint | null> => {
  assertIsContractAddress(contractAddress);
  logger.info('Checking contract ledger state...');
  const state = await providers.publicDataProvider
    .queryContractState(contractAddress)
    // Midnight.js 5 returns era-tagged bytes; decode with this app's own compact-runtime copy
    .then((read) => (read != null ? Counter.ledger(read.contractState.deserialize({ v9: ContractState }).data).round : null));
  logger.info(`Ledger state: ${state}`);
  return state;
};

export const counterContractInstance: CounterContract = new Counter.Contract(witnesses);

export const joinContract = async (
  providers: CounterProviders,
  contractAddress: string,
): Promise<DeployedCounterContract> => {
  const counterContract = await findDeployedContract(providers, {
    contractAddress,
    compiledContract: counterCompiledContract,
    privateStateId: 'counterPrivateState',
    initialPrivateState: { privateCounter: 0 },
  });
  logger.info(`Joined contract at address: ${counterContract.deployTxData.public.contractAddress}`);
  return counterContract;
};

export const deploy = async (
  providers: CounterProviders,
  privateState: CounterPrivateState,
): Promise<DeployedCounterContract> => {
  logger.info('Deploying counter contract...');
  const counterContract = await deployContract(providers, {
    compiledContract: counterCompiledContract,
    privateStateId: 'counterPrivateState',
    initialPrivateState: privateState,
  });
  logger.info(`Deployed contract at address: ${counterContract.deployTxData.public.contractAddress}`);
  return counterContract;
};

export const increment = async (counterContract: DeployedCounterContract) => {
  logger.info('Incrementing...');
  const finalizedTxData = await counterContract.callTx.increment();
  logger.info(`Transaction ${finalizedTxData.public.txId} added in block ${finalizedTxData.public.blockHeight}`);
  return finalizedTxData.public;
};

export const displayCounterValue = async (
  providers: CounterProviders,
  counterContract: DeployedCounterContract,
): Promise<{ counterValue: bigint | null; contractAddress: string }> => {
  const contractAddress = counterContract.deployTxData.public.contractAddress;
  const counterValue = await getCounterLedgerState(providers, contractAddress);
  if (counterValue === null) {
    logger.info(`There is no counter contract deployed at ${contractAddress}.`);
  } else {
    logger.info(`Current counter value: ${Number(counterValue)}`);
  }
  return { contractAddress, counterValue };
};

// Wallet SDK 2.x: signRecipe signs each part at its own stage, so the old
// signTransactionIntents ("Failed to clone intent") workaround is gone.
export const createWalletAndMidnightProvider = async (ctx: WalletContext) => {
  const state = await ctx.wallet.waitForSyncedState();
  const signSegment = (payload: Uint8Array) => Promise.resolve(ctx.unshieldedKeystore.signData(payload));
  const walletProvider = createLedger9WalletProvider({
    getCoinPublicKey: () => state.shielded.coinPublicKey.toHexString(),
    getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
    async balanceTx(tx, ttl) {
      const recipe = await ctx.wallet.balanceUnboundTransaction(ctx.wallet.adoptTransaction(tx.serialize(), 'Unbound'), {
        ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000),
      });
      return ctx.wallet.finalizeRecipe(await ctx.wallet.signRecipe(recipe, signSegment));
    },
  });
  const midnightProvider = createLedger9MidnightProvider((tx) =>
    ctx.wallet.submitTransaction(ctx.wallet.adoptTransaction(tx.serialize(), 'Finalized')),
  );
  return { walletProvider, midnightProvider };
};

export const waitForSync = (wallet: WalletFacade) =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(5_000),
      Rx.filter((state) => state.isSynced),
    ),
  );

export const waitForFunds = (wallet: WalletFacade): Promise<bigint> =>
  Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(10_000),
      Rx.filter((state) => state.isSynced),
      Rx.map((s) => s.unshielded.balances[unshieldedToken().raw] ?? 0n),
      Rx.filter((balance) => balance > 0n),
    ),
  );

// One configuration for WalletFacade.init (Wallet SDK 2.x); `forks` defaults to DefaultForkSchedule.
const buildWalletConfig = ({ networkId, indexer, indexerWS, node, proofServer }: Config) => ({
  networkId,
  indexerClientConnection: { indexerHttpUrl: indexer, indexerWsUrl: indexerWS },
  provingServerUrl: new URL(proofServer),
  relayURL: new URL(node.replace(/^http/, 'ws')),
  costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
  txHistoryStorage: new InMemoryTransactionHistoryStorage(WalletEntrySchema),
});

const formatBalance = (balance: bigint): string => balance.toLocaleString();

export const withStatus = async <T>(message: string, fn: () => Promise<T>): Promise<T> => {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r  ${frames[i++ % frames.length]} ${message}`);
  }, 80);
  try {
    const result = await fn();
    clearInterval(interval);
    process.stdout.write(`\r  ✓ ${message}\n`);
    return result;
  } catch (e) {
    clearInterval(interval);
    process.stdout.write(`\r  ✗ ${message}\n`);
    throw e;
  }
};

const registerForDustGeneration = async (
  wallet: WalletFacade,
  unshieldedKeystore: UnshieldedKeystore,
): Promise<void> => {
  const state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));

  if (state.dust.availableCoins.length > 0) {
    const dustBal = state.dust.balance(new Date());
    console.log(`  ✓ Dust tokens already available (${formatBalance(dustBal)} DUST)`);
    return;
  }

  const nightUtxos = state.unshielded.availableCoins.filter(
    (coin: any) => coin.meta?.registeredForDustGeneration !== true,
  );
  if (nightUtxos.length === 0) {
    await withStatus('Waiting for dust tokens to generate', () =>
      Rx.firstValueFrom(
        wallet.state().pipe(
          Rx.throttleTime(5_000),
          Rx.filter((s) => s.isSynced),
          Rx.filter((s) => s.dust.balance(new Date()) > 0n),
        ),
      ),
    );
    return;
  }

  await withStatus(`Registering ${nightUtxos.length} NIGHT UTXO(s) for dust generation`, async () => {
    const recipe = await wallet.registerNightUtxosForDustGeneration(
      nightUtxos,
      unshieldedKeystore.getPublicKey(),
      (payload) => Promise.resolve(unshieldedKeystore.signData(payload)),
    );
    const finalized = await wallet.finalizeRecipe(recipe);
    await wallet.submitTransaction(finalized);
  });

  await withStatus('Waiting for dust tokens to generate', () =>
    Rx.firstValueFrom(
      wallet.state().pipe(
        Rx.throttleTime(5_000),
        Rx.filter((s) => s.isSynced),
        Rx.filter((s) => s.dust.balance(new Date()) > 0n),
      ),
    ),
  );
};

const printWalletSummary = (state: FacadeState, unshieldedKeystore: UnshieldedKeystore, networkId: string) => {
  const unshieldedBalance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;

  const coinPubKey = ShieldedCoinPublicKey.fromHexString(state.shielded.coinPublicKey.toHexString());
  const encPubKey = ShieldedEncryptionPublicKey.fromHexString(state.shielded.encryptionPublicKey.toHexString());
  const shieldedAddress = MidnightBech32m.encode(networkId, new ShieldedAddress(coinPubKey, encPubKey)).toString();

  const DIV = '──────────────────────────────────────────────────────────────';

  console.log(`
${DIV}
  Wallet Overview                            Network: ${networkId}
${DIV}

  Shielded (ZSwap)
  └─ Address: ${shieldedAddress}

  Unshielded
  ├─ Address: ${unshieldedKeystore.getBech32Address().asString()}
  └─ Balance: ${formatBalance(unshieldedBalance)} tNight

  Dust
  └─ Address: ${MidnightBech32m.encode(networkId, state.dust.address).toString()}

${DIV}`);
};

export const buildWalletAndWaitForFunds = async (config: Config, seed: string): Promise<WalletContext> => {
  console.log('');

  const { wallet, seeds, unshieldedKeystore } = await withStatus('Building wallet', async () => {
    const seeds = WalletSeeds.fromMasterSeed(Buffer.from(seed, 'hex'));   // account 0 / index 0, as before
    const unshieldedKeystore = createKeystore({ kind: 'schnorr', secret: seeds.unshielded }, config.networkId);
    const wallet = await WalletFacade.init({
      configuration: buildWalletConfig(config),
      shielded: (cfg) => ShieldedWallet(cfg).startWithSeed(seeds.shielded),
      unshielded: (cfg) => UnshieldedWallet(cfg).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
      dust: (cfg) => DustWallet(cfg).startWithSeed(seeds.dust),
    });
    await wallet.start(seeds);
    return { wallet, seeds, unshieldedKeystore };
  });

  const DIV = '──────────────────────────────────────────────────────────────';
  console.log(`
${DIV}
  Wallet Overview                            Network: ${config.networkId}
${DIV}
  Unshielded Address (send tNight here):
  ${unshieldedKeystore.getBech32Address().asString()}
${config.faucet ? `
  Fund your wallet with tNight from the faucet:
  ${config.faucet}` : ''}
${DIV}
`);

  const syncedState = await withStatus('Syncing with network', () => waitForSync(wallet));
  printWalletSummary(syncedState, unshieldedKeystore, config.networkId);

  const balance = syncedState.unshielded.balances[unshieldedToken().raw] ?? 0n;
  if (balance === 0n) {
    const fundedBalance = await withStatus('Waiting for incoming tokens', () => waitForFunds(wallet));
    console.log(`    Balance: ${formatBalance(fundedBalance)} tNight\n`);
  }

  await registerForDustGeneration(wallet, unshieldedKeystore);

  return { wallet, seeds, unshieldedKeystore, networkId: config.networkId };
};

export const buildFreshWallet = async (config: Config): Promise<WalletContext> => {
  const seed = toHex(Buffer.from(generateRandomSeed()));
  const DIV = '──────────────────────────────────────────────────────────────';
  console.log(`
${DIV}
  New Wallet Seed — save this before continuing
${DIV}
  ${seed}
${DIV}
`);
  return await buildWalletAndWaitForFunds(config, seed);
};

export const configureProviders = async (ctx: WalletContext, config: Config) => {
  const { walletProvider, midnightProvider } = await createWalletAndMidnightProvider(ctx);
  const zkConfigProvider = new NodeZkConfigProvider<CounterCircuits>(contractConfig.zkConfigPath);
  const accountId = walletProvider.getCoinPublicKey();
  const storagePassword = `${Buffer.from(accountId, 'hex').toString('base64')}!`;
  const providers: CounterProviders = {
    privateStateProvider: levelPrivateStateProvider<typeof CounterPrivateStateId>({
      privateStateStoreName: contractConfig.privateStateStoreName,
      accountId,
      privateStoragePasswordProvider: () => storagePassword,
    }),
    publicDataProvider: indexerPublicDataProvider({ queryURL: config.indexer, subscriptionURL: config.indexerWS }),
    zkConfigProvider,
    proofProvider: httpClientProofProvider({ url: config.proofServer, zkConfigProvider }),
    walletProvider,
    midnightProvider,
    config: { networkId: config.networkId, ttlSeconds: 30 * 60 },   // replaces setNetworkId
  };
  return providers;
};

export const getDustBalance = async (
  wallet: WalletFacade,
): Promise<{ available: bigint; pending: bigint; availableCoins: number; pendingCoins: number }> => {
  const state = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s) => s.isSynced)));
  const available = state.dust.balance(new Date());
  const availableCoins = state.dust.availableCoins.length;
  const pendingCoins = state.dust.pendingCoins.length;
  const pending = state.dust.pendingCoins.reduce((sum, c) => sum + c.token.initialValue, 0n); // 2.x: DustFullInfo.token
  return { available, pending, availableCoins, pendingCoins };
};

export const monitorDustBalance = async (wallet: WalletFacade, stopSignal: Promise<void>): Promise<void> => {
  let stopped = false;
  void stopSignal.then(() => { stopped = true; });

  const sub = wallet
    .state()
    .pipe(
      Rx.throttleTime(5_000),
      Rx.filter((s) => s.isSynced),
    )
    .subscribe((state) => {
      if (stopped) return;

      const now = new Date();
      const available = state.dust.balance(now);
      const availableCoins = state.dust.availableCoins.length;
      const pendingCoins = state.dust.pendingCoins.length;

      const registeredNight = state.unshielded.availableCoins.filter(
        (coin: any) => coin.meta?.registeredForDustGeneration === true,
      ).length;
      const totalNight = state.unshielded.availableCoins.length;

      let status = '';
      if (pendingCoins > 0 && availableCoins === 0) {
        status = '⚠ booked by a pending tx (released on rejection, TTL or sync)';
      } else if (available > 0n) {
        status = '✓ ready to deploy';
      } else if (availableCoins > 0) {
        status = 'accruing...';
      } else if (registeredNight > 0) {
        status = 'waiting for generation...';
      } else {
        status = 'no NIGHT registered';
      }

      const time = now.toLocaleTimeString();
      console.log(
        `  [${time}] DUST: ${formatBalance(available)} (${availableCoins} coins, ${pendingCoins} pending) | NIGHT: ${totalNight} UTXOs, ${registeredNight} registered | ${status}`,
      );
    });

  await stopSignal;
  sub.unsubscribe();
};

export function setLogger(_logger: Logger) {
  logger = _logger;
}
