import type { ProvableCircuitId } from '@midnight-ntwrk/compact-js';
import { deployContract, findDeployedContract } from '@midnightntwrk/midnight-js-contracts';
import type { MidnightProviders } from '@midnightntwrk/midnight-js-types';
import {
  CompiledPrivatePartyContract,
  ledger,
  type PartyPrivateState,
  type PrivatePartyContract,
} from '../contract/src/index';
import type { ConnectedSession } from './midnight';
import { queryLatestState } from './midnight';
import { bech32ToUserAddress } from './address';

const PRIVATE_STATE_ID = 'PrivatePartyState';
export const ZK_PATH = '/zk/private-party';

const PARTY_STATE_NAMES = [
  'NOT_STARTED',
  'READY',
  'STARTED',
  'DOORS_CLOSED',
  'FEES_CLAIMED',
] as const;

export type PartyStateName = (typeof PARTY_STATE_NAMES)[number];

type PartyProviders = MidnightProviders<ProvableCircuitId<PrivatePartyContract>, typeof PRIVATE_STATE_ID, PartyPrivateState>;
const providersFor = (session: ConnectedSession) => session.providers as unknown as PartyProviders;

async function connect(session: ConnectedSession, contractAddress: string) {
  return findDeployedContract(providersFor(session), {
    compiledContract: CompiledPrivatePartyContract,
    contractAddress,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: {},
  });
}

function setSize(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'size' in value) {
    const size = (value as { size: unknown }).size;
    if (typeof size === 'function') return Number((size as () => number)());
    if (typeof size === 'number') return size;
  }
  return 0;
}

export async function deployParty(
  session: ConnectedSession,
  partySize: number,
  entryFeeStars: number,
  organizerSecret: Uint8Array,
): Promise<string> {
  const deployed = await deployContract(providersFor(session), {
    compiledContract: CompiledPrivatePartyContract,
    args: [BigInt(partySize), BigInt(entryFeeStars), organizerSecret],
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: {},
  });
  return deployed.deployTxData.public.contractAddress;
}

export async function rsvp(
  session: ConnectedSession,
  contractAddress: string,
  userAddress: { bytes: Uint8Array },
  attendeeSecret: Uint8Array,
) {
  const party = await connect(session, contractAddress);
  await party.callTx.rsvp(userAddress, attendeeSecret);
}

export async function startParty(
  session: ConnectedSession,
  contractAddress: string,
  organizerSecret: Uint8Array,
) {
  const party = await connect(session, contractAddress);
  await party.callTx.startParty(organizerSecret);
}

export async function checkIn(
  session: ConnectedSession,
  contractAddress: string,
  userAddress: { bytes: Uint8Array },
  attendeeSecret: Uint8Array,
) {
  const party = await connect(session, contractAddress);
  await party.callTx.checkIn(userAddress, attendeeSecret);
}

export async function closeEntry(
  session: ConnectedSession,
  contractAddress: string,
  organizerSecret: Uint8Array,
) {
  const party = await connect(session, contractAddress);
  await party.callTx.closeEntry(organizerSecret);
}

export async function claimFees(
  session: ConnectedSession,
  contractAddress: string,
  organizerAddress: { bytes: Uint8Array },
  organizerSecret: Uint8Array,
) {
  const party = await connect(session, contractAddress);
  await party.callTx.claimFees(organizerAddress, organizerSecret);
}

export function decodePartyState(data: Parameters<typeof ledger>[0]) {
  const l = ledger(data);
  const stateIdx = Number(l.partyState);
  return {
    partyState: (PARTY_STATE_NAMES[stateIdx] ?? `UNKNOWN(${stateIdx})`) as PartyStateName | string,
    partyStateIndex: stateIdx,
    maxListSize: Number(l.maxListSize),
    entryFee: Number(l.entryFee),
    rsvpCount: setSize(l.hashedPartyGoers),
    checkedInCount: setSize(l.checkedInParty),
  };
}

export async function fetchPartyState(session: ConnectedSession, contractAddress: string) {
  const state = await queryLatestState(session, contractAddress);
  return state ? decodePartyState(state.data) : null;
}

export function userAddressFromSession(session: ConnectedSession) {
  return bech32ToUserAddress(session.unshieldedAddress, session.network.networkId);
}
