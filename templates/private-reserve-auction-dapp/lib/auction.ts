import type { ProvableCircuitId } from '@midnight-ntwrk/compact-js';
import { deployContract, findDeployedContract } from '@midnightntwrk/midnight-js-contracts';
import type { MidnightProviders } from '@midnightntwrk/midnight-js-types';
import { CompiledAuctionContract, ledger, type AuctionContract, type AuctionPrivateState } from '../contract/src/index';
import { queryLatestState, type ConnectedSession } from './midnight';
import { bech32ToUserAddress } from './address';

const PRIVATE_STATE_ID = 'PrivateAuctionState';
export const ZK_PATH = '/zk/private-reserve-auction';
const AUCTION_STATE_NAMES = ['OPEN', 'CLOSED', 'SETTLED'] as const;
export type AuctionStateName = (typeof AUCTION_STATE_NAMES)[number];

type AuctionProviders = MidnightProviders<ProvableCircuitId<AuctionContract>, typeof PRIVATE_STATE_ID, AuctionPrivateState>;
const providersFor = (s: ConnectedSession) => s.providers as unknown as AuctionProviders;
const stars = (night: number) => BigInt(Math.round(night * 1_000_000));

export async function deployAuction(session: ConnectedSession, reservePriceNight: number, maxBidders: number, sellerSecret: Uint8Array) {
  const deployed = await deployContract(providersFor(session), {
    compiledContract: CompiledAuctionContract,
    args: [stars(reservePriceNight), BigInt(maxBidders), sellerSecret],
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: {},
  });
  return deployed.deployTxData.public.contractAddress;
}

const connect = (session: ConnectedSession, contractAddress: string) =>
  findDeployedContract(providersFor(session), {
    compiledContract: CompiledAuctionContract,
    contractAddress,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: {},
  });

export const placeBid = async (session: ConnectedSession, contractAddress: string, bidNight: number, user: { bytes: Uint8Array }, bidderSecret: Uint8Array) =>
  (await connect(session, contractAddress)).callTx.bid(stars(bidNight), user, bidderSecret);

export const closeAuction = async (session: ConnectedSession, contractAddress: string, sellerSecret: Uint8Array) =>
  (await connect(session, contractAddress)).callTx.closeAuction(sellerSecret);

export const revealPrice = async (session: ConnectedSession, contractAddress: string, reservePriceNight: number, sellerSecret: Uint8Array) =>
  (await connect(session, contractAddress)).callTx.revealPrice(stars(reservePriceNight), sellerSecret);

export const claimItem = async (session: ConnectedSession, contractAddress: string, user: { bytes: Uint8Array }, bidderSecret: Uint8Array) =>
  (await connect(session, contractAddress)).callTx.claimItem(user, bidderSecret);

export const claimProceeds = async (session: ConnectedSession, contractAddress: string, seller: { bytes: Uint8Array }, sellerSecret: Uint8Array) =>
  (await connect(session, contractAddress)).callTx.claimProceeds(seller, sellerSecret);

export async function fetchAuctionState(session: ConnectedSession, contractAddress: string) {
  const state = await queryLatestState(session, contractAddress);
  if (!state) return null;
  const l = ledger(state.data);
  const stateIdx = Number(l.auctionState);
  return {
    auctionState: (AUCTION_STATE_NAMES[stateIdx] ?? `UNKNOWN(${stateIdx})`) as AuctionStateName | string,
    auctionStateIndex: stateIdx,
    maxBidders: Number(l.maxBids),
    publicPriceNight: Number(l.publicPrice) / 1_000_000,
    highestBidNight: Number(l.highestBid) / 1_000_000,
    bidCount: Number(l.bidCount),             // Counter → bigint
    bidderCount: Number(l.bidders.size()),    // ledger Map/Set → size()
  };
}

export const userAddressFromSession = (session: ConnectedSession) =>
  bech32ToUserAddress(session.unshieldedAddress, session.network.networkId);
