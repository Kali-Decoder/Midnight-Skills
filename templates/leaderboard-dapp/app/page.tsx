'use client';

import dynamic from 'next/dynamic';

// Wallet + Midnight SDK code (WASM ledger, IndexedDB private state) is browser-only: never prerender it.
const LeaderboardClient = dynamic(() => import('./leaderboard/LeaderboardClient'), { ssr: false });

export default function Page() {
  return <LeaderboardClient />;
}
