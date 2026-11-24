import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Private Reserve Auction',
  description: 'Sealed-reserve auction on Midnight',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">{children}</body>
    </html>
  );
}
