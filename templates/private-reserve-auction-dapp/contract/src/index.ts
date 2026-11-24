import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { Contract } from './managed/private-reserve-auction/contract/index.js';
export { ledger } from './managed/private-reserve-auction/contract/index.js';

export type AuctionPrivateState = Record<string, never>;
export type AuctionContract = Contract<AuctionPrivateState>;

export const CompiledAuctionContract = CompiledContract.make<AuctionContract>('private-reserve-auction', Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets('/zk/private-reserve-auction'), // label only in the browser
);
