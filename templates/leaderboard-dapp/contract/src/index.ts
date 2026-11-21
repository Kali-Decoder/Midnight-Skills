import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { witnesses, type LeaderboardPrivateState } from './witnesses';

export {
  Contract,
  ledger,
  pureCircuits,
  type Ledger,
} from './managed/leaderboard/contract/index.js';
import { Contract } from './managed/leaderboard/contract/index.js';

// Browser bundle: no node:path / node:url. Keys + ZKIR load through the session's FetchZkConfigProvider.
export const zkConfigPath = '/zk/leaderboard';

export type LeaderboardContract = Contract<LeaderboardPrivateState>;
export type { LeaderboardPrivateState };

export const CompiledLeaderboardContract = CompiledContract.make<LeaderboardContract>('leaderboard', Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);
