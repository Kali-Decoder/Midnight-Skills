import { createUnprovenDeployTx, submitCallTxAsync, submitTxAsync } from '@midnight-ntwrk/midnight-js-contracts';
import { ContractState, sampleSigningKey } from '@midnight-ntwrk/compact-runtime';
import { CompiledLockerContract, Contract, ledger } from '../contract/src/index';
import type { ConnectedSession } from './midnight';
import { fromHex, pollForState } from './midnight';

const PRIVATE_STATE_ID = 'LockerPrivateState';
const ZK_PATH = '/zk/locker';

function makeCompiledContract() {
  return CompiledLockerContract as any;
}

export async function deployLocker(
  session: ConnectedSession,
  beneficiarySecretKey: Uint8Array,
): Promise<string> {
  const initialPrivateState = { beneficiarySecretKey };
  const deployTxData = await (createUnprovenDeployTx as any)(
    {
      zkConfigProvider: session.providers.zkConfigProvider,
      walletProvider: session.providers.walletProvider,
    },
    {
      compiledContract: makeCompiledContract(),
      args: [],
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState,
      signingKey: sampleSigningKey(),
    },
  );
  const contractAddress = deployTxData.public.contractAddress;
  await (submitTxAsync as any)(session.providers, { unprovenTx: deployTxData.private.unprovenTx });
  await session.providers.privateStateProvider.setContractAddress(contractAddress);
  await session.providers.privateStateProvider.set(PRIVATE_STATE_ID, initialPrivateState);
  await session.providers.privateStateProvider.setSigningKey(
    contractAddress,
    deployTxData.private.signingKey,
  );
  return contractAddress;
}

export async function lockTokens(
  session: ConnectedSession,
  contractAddress: string,
  amount: bigint,
  releaseTimeUnix: bigint,
  beneficiaryPkBytes: Uint8Array,
) {
  await (submitCallTxAsync as any)(session.providers, {
    compiledContract: makeCompiledContract(),
    contractAddress,
    circuitId: 'lockTokens',
    args: [amount, releaseTimeUnix, { bytes: beneficiaryPkBytes }],
    privateStateId: PRIVATE_STATE_ID,
  });
}

export async function releaseTokens(
  session: ConnectedSession,
  contractAddress: string,
  recipientBytes: Uint8Array,
) {
  await (submitCallTxAsync as any)(session.providers, {
    compiledContract: makeCompiledContract(),
    contractAddress,
    circuitId: 'release',
    args: [{ bytes: recipientBytes }],
    privateStateId: PRIVATE_STATE_ID,
  });
}

export function decodeLockerState(stateHex: string) {
  const contractState = ContractState.deserialize(fromHex(stateHex));
  const l = ledger(contractState.data);
  return {
    balance: l.balance as unknown as bigint,
    unlockTime: l.unlockTime as unknown as bigint,
    lockActive: l.lockActive as unknown as boolean,
  };
}

export async function fetchLockerState(queryUrl: string, contractAddress: string) {
  const hex = await pollForState(queryUrl, contractAddress);
  return decodeLockerState(hex);
}

export { ZK_PATH };
