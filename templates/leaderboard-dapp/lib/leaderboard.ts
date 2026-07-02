import { createUnprovenDeployTx, submitCallTxAsync, submitTxAsync } from '@midnight-ntwrk/midnight-js-contracts';
import { ContractState, sampleSigningKey } from '@midnight-ntwrk/compact-runtime';
import { CompiledLeaderboardContract, Contract, ledger } from '../contract/src/index';
import { setCustomName } from '../contract/src/witnesses';
import type { ConnectedSession } from './midnight';
import { decodeDisplayName } from './display-name';
import { fromHex, pollForState } from './midnight';

const PRIVATE_STATE_ID = 'leaderboardPrivateState';
const SECRET_STORAGE_KEY = 'midnight-leaderboard-secret';
export const ZK_PATH = '/zk/leaderboard';

export type LeaderboardEntry = {
  id: number;
  score: number;
  displayName: string;
  ownerHash: string;
};

export type LeaderboardState = {
  entryCount: number;
  entries: LeaderboardEntry[];
};

function makeCompiledContract() {
  return CompiledLeaderboardContract as any;
}

export function getOrCreateSecretKey(): Uint8Array {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(SECRET_STORAGE_KEY);
    if (stored) {
      return Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
    }
    const secret = crypto.getRandomValues(new Uint8Array(32));
    localStorage.setItem(SECRET_STORAGE_KEY, btoa(String.fromCharCode(...secret)));
    return secret;
  }
  return crypto.getRandomValues(new Uint8Array(32));
}

export async function deployLeaderboard(session: ConnectedSession): Promise<string> {
  const secretKey = getOrCreateSecretKey();
  const initialPrivateState = { secretKey };
  const deployTxData = await (createUnprovenDeployTx as any)(
    {
      zkConfigProvider: session.providers.zkConfigProvider,
      walletProvider: session.providers.walletProvider,
    },
    {
      compiledContract: makeCompiledContract(),
      args: [],
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState,
      signingKey: sampleSigningKey(),
    },
  );
  const contractAddress = deployTxData.public.contractAddress;
  await (submitTxAsync as any)(session.providers, { unprovenTx: deployTxData.private.unprovenTx });
  await session.providers.privateStateProvider.setContractAddress(contractAddress);
  await session.providers.privateStateProvider.set(PRIVATE_STATE_ID, initialPrivateState);
  await session.providers.privateStateProvider.setSigningKey(
    contractAddress,
    deployTxData.private.signingKey,
  );
  return contractAddress;
}

export async function submitScore(
  session: ConnectedSession,
  contractAddress: string,
  score: number,
  customName?: string,
) {
  if (customName) {
    setCustomName(customName);
  }
  await (submitCallTxAsync as any)(session.providers, {
    compiledContract: makeCompiledContract(),
    contractAddress,
    circuitId: 'submitScore',
    args: [BigInt(score), Boolean(customName)],
    privateStateId: PRIVATE_STATE_ID,
  });
}

export async function verifyOwnership(
  session: ConnectedSession,
  contractAddress: string,
  entryId: number,
) {
  await (submitCallTxAsync as any)(session.providers, {
    compiledContract: makeCompiledContract(),
    contractAddress,
    circuitId: 'verifyOwnership',
    args: [BigInt(entryId)],
    privateStateId: PRIVATE_STATE_ID,
  });
}

export function decodeLeaderboardState(stateHex: string): LeaderboardState {
  const contractState = ContractState.deserialize(fromHex(stateHex));
  const l = ledger(contractState.data);
  const entries: LeaderboardEntry[] = [];
  for (const [key, entry] of l.scores as Map<bigint, { score: bigint; displayName: Uint8Array; ownerHash: Uint8Array }>) {
    const id = Number(key);
    const score = Number(entry.score);
    entries.push({
      id,
      score,
      displayName: decodeDisplayName(entry.displayName, id, score),
      ownerHash: Array.from(entry.ownerHash)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(''),
    });
  }
  entries.sort((a, b) => b.score - a.score);
  return { entryCount: Number(l.nextId as unknown as bigint), entries };
}

export async function fetchLeaderboardState(
  queryUrl: string,
  contractAddress: string,
): Promise<LeaderboardState> {
  const hex = await pollForState(queryUrl, contractAddress);
  return decodeLeaderboardState(hex);
}
