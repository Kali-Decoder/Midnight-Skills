import path from 'node:path';

export const currentDir = path.resolve(new URL(import.meta.url).pathname, '..');

export const contractConfig = {
  privateStateStoreName: 'counter-private-state',
  zkConfigPath: path.resolve(currentDir, '..', '..', 'contract', 'src', 'managed', 'counter'),
};

export interface Config {
  readonly networkId: string;
  readonly logDir: string;
  indexer: string;
  indexerWS: string;
  node: string;
  proofServer: string;
  readonly faucet?: string;
}

export class StandaloneConfig implements Config {
  networkId = 'undeployed';
  logDir = path.resolve(currentDir, '..', 'logs', 'standalone', `${new Date().toISOString()}.log`);
  indexer = 'http://127.0.0.1:8088/api/v4/graphql';
  indexerWS = 'ws://127.0.0.1:8088/api/v4/graphql/ws';
  node = 'http://127.0.0.1:9944';
  proofServer = 'http://127.0.0.1:6300';
}

export class PreviewConfig implements Config {
  networkId = 'preview';
  logDir = path.resolve(currentDir, '..', 'logs', 'preview', `${new Date().toISOString()}.log`);
  indexer = 'https://indexer.preview.midnight.network/api/v4/graphql';
  indexerWS = 'wss://indexer.preview.midnight.network/api/v4/graphql/ws';
  node = 'https://rpc.preview.midnight.network';
  proofServer = 'http://127.0.0.1:6300';
  faucet = 'https://faucet.preview.midnight.network/';
}

const blockfrostToken = (): string => {
  const t = process.env.BLOCKFROST_PROJECT_ID;   // a preprod token (nightpreprod…)
  if (!t) throw new Error('Preprod is served by Blockfrost: set BLOCKFROST_PROJECT_ID');
  return t;
};

export class PreprodConfig implements Config {
  networkId = 'preprod';
  logDir = path.resolve(currentDir, '..', 'logs', 'preprod', `${new Date().toISOString()}.log`);
  indexer = `https://midnight-preprod.blockfrost.io/api/v0?project_id=${blockfrostToken()}`;
  indexerWS = `wss://midnight-preprod.blockfrost.io/api/v0/ws?project_id=${blockfrostToken()}`;
  node = `https://rpc.midnight-preprod.blockfrost.io?project_id=${blockfrostToken()}`;
  proofServer = 'http://127.0.0.1:6300';
  faucet = 'https://midnight-tmnight-preprod.nethermind.dev/';
}
