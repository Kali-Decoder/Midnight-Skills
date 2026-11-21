import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { witnesses, type LockerPrivateState } from './witnesses';

export {
  Contract,
  ledger,
  pureCircuits,
  type Ledger,
} from './managed/locker/contract/index.js';
import { Contract } from './managed/locker/contract/index.js';

// Browser bundle: no node:path / node:url. Midnight.js loads keys + ZKIR through the session's
// FetchZkConfigProvider (served from /zk/locker), so this path is only a label for compact-js.
export const zkConfigPath = '/zk/locker';

export type LockerContract = Contract<LockerPrivateState>;
export type { LockerPrivateState };

export const CompiledLockerContract = CompiledContract.make<LockerContract>('locker', Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);
