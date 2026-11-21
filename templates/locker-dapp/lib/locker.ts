import { deployContract, findDeployedContract } from '@midnightntwrk/midnight-js-contracts';
import type { ProvableCircuitId } from '@midnight-ntwrk/compact-js';
import type { MidnightProviders } from '@midnightntwrk/midnight-js-types';
import { CompiledLockerContract, ledger, type LockerContract, type LockerPrivateState } from '../contract/src/index';
import type { ConnectedSession } from './midnight';
import { queryLatestState } from './midnight';

const PRIVATE_STATE_ID = 'LockerPrivateState';
const ZK_PATH = '/zk/locker';

// The session's providers are contract-agnostic; narrow them to this contract's circuits + private state.
type LockerProviders = MidnightProviders<ProvableCircuitId<LockerContract>, typeof PRIVATE_STATE_ID, LockerPrivateState>;
const providersFor = (session: ConnectedSession) => session.providers as unknown as LockerProviders;

export async function deployLocker(session: ConnectedSession, beneficiarySecretKey: Uint8Array): Promise<string> {
  // deployContract builds, proves (via the wallet), balances, submits, and stores the private state + signing key.
  const deployed = await deployContract(providersFor(session), {
    compiledContract: CompiledLockerContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: { beneficiarySecretKey },
  });
  return deployed.deployTxData.public.contractAddress;
}

async function connect(session: ConnectedSession, contractAddress: string) {
  return findDeployedContract(providersFor(session), {
    compiledContract: CompiledLockerContract,
    contractAddress,
    privateStateId: PRIVATE_STATE_ID,
  });
}

export async function lockTokens(
  session: ConnectedSession,
  contractAddress: string,
  amount: bigint,
  releaseTimeUnix: bigint,
  beneficiaryPkBytes: Uint8Array,
) {
  const locker = await connect(session, contractAddress);
  // beneficiaryPk is Bytes<32> (a plain Uint8Array); release() takes a UserAddress ({ bytes }).
  await locker.callTx.lockTokens(amount, releaseTimeUnix, beneficiaryPkBytes);
}

export async function releaseTokens(session: ConnectedSession, contractAddress: string, recipientBytes: Uint8Array) {
  const locker = await connect(session, contractAddress);
  await locker.callTx.release({ bytes: recipientBytes });
}

export async function fetchLockerState(session: ConnectedSession, contractAddress: string) {
  const state = await queryLatestState(session, contractAddress);
  if (!state) return null;
  const l = ledger(state.data);
  return { balance: l.balance, unlockTime: l.unlockTime, lockActive: l.lockActive };
}

export { ZK_PATH };
