import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';

export type LeaderboardPrivateState = {
  secretKey: Uint8Array;
};

let customName = new Uint8Array(32);

export const setCustomName = (name: string): void => {
  customName = new Uint8Array(32);
  customName.set(new TextEncoder().encode(name).slice(0, 32));
};

export const witnesses = {
  localSecretKey: (context: WitnessContext<LeaderboardPrivateState>) =>
    [context.privateState, context.privateState.secretKey] as const,
  getCustomName: (context: WitnessContext<LeaderboardPrivateState>) =>
    [context.privateState, customName] as const,
};
