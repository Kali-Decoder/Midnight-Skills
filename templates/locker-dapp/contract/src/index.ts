import { CompiledContract } from '@midnight-ntwrk/compact-runtime';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { witnesses } from './witnesses';

export {
  Contract,
  ledger,
  pureCircuits,
  type Ledger,
} from './managed/locker/contract/index.js';
import { Contract } from './managed/locker/contract/index.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const zkConfigPath = path.resolve(currentDir, 'managed', 'locker');

export const CompiledLockerContract = CompiledContract.make('locker', Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);
