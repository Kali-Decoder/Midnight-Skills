import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';

export type LockerPrivateState = {
  beneficiarySecretKey: Uint8Array;
};

export const witnesses = {
  beneficiaryKey: (context: WitnessContext<LockerPrivateState>) =>
    [context.privateState, context.privateState.beneficiarySecretKey] as const,
};
