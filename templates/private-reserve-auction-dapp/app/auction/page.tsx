'use client';

import dynamic from 'next/dynamic';

// Wallet + Midnight SDK code (WASM ledger, IndexedDB private state) is browser-only: never prerender it.
const AuctionClient = dynamic(() => import('./AuctionClient'), { ssr: false });

export default function AuctionPage() {
  return <AuctionClient />;
}
