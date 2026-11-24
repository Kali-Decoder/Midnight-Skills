import { Counter, type CounterPrivateState } from '@midnight-ntwrk/counter-contract';
import type { MidnightProviders } from '@midnightntwrk/midnight-js-types';
import type { DeployedContract, FoundContract } from '@midnightntwrk/midnight-js-contracts';
import type { ProvableCircuitId } from '@midnight-ntwrk/compact-js';

export type CounterCircuits = ProvableCircuitId<Counter.Contract<CounterPrivateState>>;

export const CounterPrivateStateId = 'counterPrivateState';

export type CounterProviders = MidnightProviders<CounterCircuits, typeof CounterPrivateStateId, CounterPrivateState>;

export type CounterContract = Counter.Contract<CounterPrivateState>;

export type DeployedCounterContract = DeployedContract<CounterContract> | FoundContract<CounterContract>;
