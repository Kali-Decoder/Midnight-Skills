import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger } from './managed/leaderboard/contract/index.js';

export type LeaderboardPrivateState = {
  secretKey: Uint8Array;
};

let customName = new Uint8Array(32);

export const setCustomName = (name: string): void => {
  customName = new Uint8Array(32);
  customName.set(new TextEncoder().encode(name).slice(0, 32));
};

type Ctx = WitnessContext<Ledger, LeaderboardPrivateState>;

export const witnesses = {
  localSecretKey: ({ privateState }: Ctx): [LeaderboardPrivateState, Uint8Array] => [privateState, privateState.secretKey],
  getCustomName: ({ privateState }: Ctx): [LeaderboardPrivateState, Uint8Array] => [privateState, customName],
};
