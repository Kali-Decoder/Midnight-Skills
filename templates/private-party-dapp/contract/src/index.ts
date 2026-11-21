import { CompiledContract } from '@midnight-ntwrk/compact-js';

export {
  Contract,
  ledger,
  pureCircuits,
  type Ledger,
} from './managed/private-party/contract/index.js';
import { Contract } from './managed/private-party/contract/index.js';

// Browser bundle: no node:path / node:url. Keys + ZKIR load through the session's FetchZkConfigProvider.
export const zkConfigPath = '/zk/private-party';

export type PartyPrivateState = Record<string, never>;
export type PrivatePartyContract = Contract<PartyPrivateState>;

export const CompiledPrivatePartyContract = CompiledContract.make<PrivatePartyContract>('private-party', Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);
