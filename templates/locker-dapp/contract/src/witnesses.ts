import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger } from './managed/locker/contract/index.js';

export type LockerPrivateState = {
  beneficiarySecretKey: Uint8Array;
};

// compact-runtime 0.21: WitnessContext<Ledger, PrivateState>; witnesses return a mutable [state, value] tuple.
export const witnesses = {
  beneficiaryKey: ({ privateState }: WitnessContext<Ledger, LockerPrivateState>): [LockerPrivateState, Uint8Array] => [
    privateState,
    privateState.beneficiarySecretKey,
  ],
};
