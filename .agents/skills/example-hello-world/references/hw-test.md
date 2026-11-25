# Example Hello World DApp Skill: 11) `src/test/hw.test.ts`

> Reference for the `example-hello-world` skill. Back to [SKILL.md](../SKILL.md).

## 11) `src/test/hw.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';
import { deployContract, findDeployedContract } from '@midnightntwrk/midnight-js-contracts';
import { ContractState, type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import pino from 'pino';

import { getConfig } from '../config.js';
import { MidnightWalletProvider, syncWallet } from '../wallet.js';
import { buildProviders, type HelloWorldProviders } from '../providers.js';
import {
  CompiledHelloWorldContract,
  ledger,
  zkConfigPath,
} from '../../contracts/index.js';
import type { EnvironmentConfiguration } from '@midnightntwrk/testkit-js';

// Required for GraphQL subscriptions in Node.js
globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
  console.error('Promise:', promise);
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

const ALICE_SEED =
  '0000000000000000000000000000000000000000000000000000000000000001';

const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  transport: { target: 'pino-pretty' },
});

describe('Hello World Contract', () => {
  let aliceWallet: MidnightWalletProvider;
  let aliceProviders: HelloWorldProviders;
  let contractAddress: ContractAddress;

  const config = getConfig();

  async function queryLedger(providers: HelloWorldProviders) {
    const read = await providers.publicDataProvider.queryContractState(contractAddress);
    expect(read).not.toBeNull();
    // Midnight.js 5: era-tagged bytes, decoded with this project's compact-runtime
    return ledger(read!.contractState.deserialize({ v9: ContractState }).data);
  }

  beforeAll(async () => {
    const envConfig: EnvironmentConfiguration = {
      walletNetworkId: config.networkId,
      networkId: config.networkId,
      indexer: config.indexer,
      indexerWS: config.indexerWS,
      node: config.node,
      nodeWS: config.nodeWS,
      faucet: config.faucet,
      proofServer: config.proofServer,
    };

    aliceWallet = await MidnightWalletProvider.build(logger, envConfig, ALICE_SEED);
    await aliceWallet.start();
    await syncWallet(logger, aliceWallet.wallet, 600_000);

    aliceProviders = buildProviders(aliceWallet, zkConfigPath, config);
    logger.info('Providers initialized. Ready to test!');
  });

  afterAll(async () => {
    if (aliceWallet) {
      logger.info('Stopping Alice wallet...');
      await aliceWallet.stop();
    }
  });

  it('Deploys the contract', async () => {
    logger.info('Creating private state...');

    const deployed = await deployContract(aliceProviders, {
      compiledContract: CompiledHelloWorldContract,
    });

    logger.info('Setting the contract address...');
    contractAddress = deployed.deployTxData.public.contractAddress;
    logger.info(`Contract deployed at: ${contractAddress}`);
    expect(contractAddress).toBeDefined();
    expect(contractAddress.length).toBeGreaterThan(0);

    const state = await queryLedger(aliceProviders);
    expect(state.message).toEqual('');
  });

  it('Stores Hello World!', async () => {
    const message = 'Hello World!';

    const hw = await findDeployedContract(aliceProviders, {
      compiledContract: CompiledHelloWorldContract,
      contractAddress,
    });
    await hw.callTx.storeMessage(message);

    const state = await queryLedger(aliceProviders);
    expect(state.message).toEqual(message);
  });
});
```
