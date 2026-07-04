import { CompiledContract } from '@midnight-ntwrk/compact-runtime';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export {
  Contract,
  ledger,
  pureCircuits,
  type Ledger,
} from './managed/private-party/contract/index.js';
import { Contract } from './managed/private-party/contract/index.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const zkConfigPath = path.resolve(currentDir, 'managed', 'private-party');

export const CompiledPrivatePartyContract = CompiledContract.make(
  'private-party',
  Contract,
).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);
