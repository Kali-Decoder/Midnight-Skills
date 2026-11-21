import type { ProvableCircuitId } from '@midnight-ntwrk/compact-js';
import { deployContract, findDeployedContract } from '@midnightntwrk/midnight-js-contracts';
import type { MidnightProviders } from '@midnightntwrk/midnight-js-types';
import {
  CompiledLeaderboardContract,
  ledger,
  type LeaderboardContract,
  type LeaderboardPrivateState,
} from '../contract/src/index';
import { setCustomName } from '../contract/src/witnesses';
import type { ConnectedSession } from './midnight';
import { queryLatestState } from './midnight';
import { decodeDisplayName } from './display-name';

const PRIVATE_STATE_ID = 'leaderboardPrivateState';
const SECRET_STORAGE_KEY = 'midnight-leaderboard-secret';
export const ZK_PATH = '/zk/leaderboard';

type LeaderboardProviders = MidnightProviders<
  ProvableCircuitId<LeaderboardContract>,
  typeof PRIVATE_STATE_ID,
  LeaderboardPrivateState
>;
const providersFor = (session: ConnectedSession) => session.providers as unknown as LeaderboardProviders;

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
  const deployed = await deployContract(providersFor(session), {
    compiledContract: CompiledLeaderboardContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: { secretKey: getOrCreateSecretKey() },
  });
  return deployed.deployTxData.public.contractAddress;
}

async function connect(session: ConnectedSession, contractAddress: string) {
  return findDeployedContract(providersFor(session), {
    compiledContract: CompiledLeaderboardContract,
    contractAddress,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: { secretKey: getOrCreateSecretKey() },
  });
}

export async function submitScore(session: ConnectedSession, contractAddress: string, score: number, customName?: string) {
  if (customName) setCustomName(customName);
  const board = await connect(session, contractAddress);
  await board.callTx.submitScore(BigInt(score), Boolean(customName));
}

export async function verifyOwnership(session: ConnectedSession, contractAddress: string, entryId: number) {
  const board = await connect(session, contractAddress);
  await board.callTx.verifyOwnership(BigInt(entryId));
}

export async function fetchLeaderboardState(session: ConnectedSession, contractAddress: string): Promise<LeaderboardState> {
  const state = await queryLatestState(session, contractAddress);
  if (!state) return { entryCount: 0, entries: [] };
  const l = ledger(state.data);
  const entries: LeaderboardEntry[] = [];
  for (const [key, entry] of l.scores) {
    const id = Number(key);
    const score = Number(entry.score);
    entries.push({
      id,
      score,
      displayName: decodeDisplayName(entry.displayName, id, score),
      ownerHash: Array.from(entry.ownerHash, (b) => b.toString(16).padStart(2, '0')).join(''),
    });
  }
  entries.sort((a, b) => b.score - a.score);
  return { entryCount: Number(l.nextId), entries };
}
