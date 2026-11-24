import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="mb-4 text-2xl font-semibold">Private Reserve Auction</h1>
      <p className="mb-6 text-zinc-600 dark:text-zinc-400">
        The seller's reserve price stays private; only whether it was met is revealed.
      </p>
      <Link href="/auction" className="rounded-md bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
        Open the auction
      </Link>
    </main>
  );
}
