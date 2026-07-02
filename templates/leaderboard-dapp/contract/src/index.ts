import { CompiledContract } from '@midnight-ntwrk/compact-runtime';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { witnesses } from './witnesses';

export {
  Contract,
  ledger,
  pureCircuits,
  type Ledger,
} from './managed/leaderboard/contract/index.js';
import { Contract } from './managed/leaderboard/contract/index.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const zkConfigPath = path.resolve(currentDir, 'managed', 'leaderboard');

export const CompiledLeaderboardContract = CompiledContract.make('leaderboard', Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);
