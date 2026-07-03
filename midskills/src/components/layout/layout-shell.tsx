"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { SiteFooter } from "@/components/layout/site-footer";

function ChromeFallback() {
  return <header className="sticky top-0 z-50 h-14 border-b border-[var(--brand-border)] bg-[var(--navbar-bg)]" />;
}

export function LayoutShell({
  navbar,
  children,
}: {
  navbar: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isSplash = pathname === "/";

  if (isSplash) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="bg-grid bg-grid-fade absolute inset-0 opacity-30" />
        <div className="bg-grid-dots bg-grid-fade absolute inset-0 opacity-30" />
      </div>
      <div className="flex min-h-dvh flex-col">
        <Suspense fallback={<ChromeFallback />}>{navbar}</Suspense>
        <main className="safe-bottom min-w-0 flex-1 overflow-x-hidden">{children}</main>
        <SiteFooter />
      </div>
    </>
  );
}
