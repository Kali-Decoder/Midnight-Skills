// In-process contract simulator over @midnight-ntwrk/compact-runtime.
// Executes circuits (including witness evaluation) against a local
// QueryContext — no node, indexer, or proof server required. Token
// operations record their effects but are not settled; balance-mirror
// ledger fields make the outcomes observable anyway.

import {
  createConstructorContext,
  createCircuitContext,
  sampleContractAddress,
  type ChargedState,
  type CircuitContext,
  type EncodedZswapLocalState,
  type StateValue,
} from '@midnight-ntwrk/compact-runtime';

import {
  Contract,
  ledger,
  deviceCommitment,
  recoveryCommitment,
  type Ledger,
} from '../src/wallet/contract.js';
import {
  makeWitnesses,
  privateStateFromSecrets,
  type AccountPrivateState,
} from '../src/wallet/witnesses.js';
import { split, type Share } from '../src/wallet/shamir.js';

const COIN_PUBLIC_KEY = '00'.repeat(32);

export interface SimulatorSecrets {
  deviceSecret?: Uint8Array;
  grantSecret?: Uint8Array;
  recoverySecret?: Uint8Array;
}

export class AccountSimulator {
  readonly contract: any;
  readonly address = sampleContractAddress();
  readonly initialShares: Share[];
  // compact-runtime 0.21 builds a fresh CircuitContext per call (circuitId is part of
  // it, and circuits are async), so the simulator carries state between calls itself.
  private contractState: StateValue | ChargedState;
  private privateState: AccountPrivateState;
  private zswapState: EncodedZswapLocalState | typeof COIN_PUBLIC_KEY;

  private constructor(contract: any, shares: Share[], init: any) {
    this.contract = contract;
    this.initialShares = shares;
    this.contractState = init.currentContractState.data;
    this.privateState = init.currentPrivateState;
    this.zswapState = init.currentZswapLocalState;
  }

  /** Runs the (async, since compact-runtime 0.21) contract constructor. */
  static async create(opts: { deviceSecret: Uint8Array; recoverySecret: Uint8Array }): Promise<AccountSimulator> {
    const contract = new (Contract as any)(makeWitnesses());
    const shares = split(opts.recoverySecret, 2, 3);
    const init = await contract.initialState(
      createConstructorContext(privateStateFromSecrets(opts), COIN_PUBLIC_KEY),
      deviceCommitment(opts.deviceSecret),
      recoveryCommitment(opts.recoverySecret),
      shares[0].value,
      shares[1].value,
      shares[2].value,
    );
    return new AccountSimulator(contract, shares, init);
  }

  /** Switch the acting client: subsequent calls use these secrets. */
  as(secrets: SimulatorSecrets): this {
    this.privateState = privateStateFromSecrets(secrets);
    return this;
  }

  /** Call an impure circuit; commits the resulting state on success. */
  async call(circuit: string, ...args: unknown[]): Promise<unknown> {
    const ctx: CircuitContext<AccountPrivateState> = createCircuitContext({
      circuitId: circuit,
      contractAddress: this.address,
      coinPublicKeyOrZswapState: this.zswapState,
      contractState: this.contractState,
      privateState: this.privateState,
    });
    const r = await this.contract.impureCircuits[circuit](ctx, ...args);
    this.contractState = r.context.callContext.currentQueryContext.state;
    this.privateState = r.context.callContext.currentPrivateState ?? this.privateState;
    this.zswapState = r.context.callContext.currentZswapLocalState ?? this.zswapState;
    return r.result;
  }

  ledger(): Ledger {
    return ledger(this.contractState);
  }
}
