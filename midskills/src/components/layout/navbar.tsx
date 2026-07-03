"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Container } from "@/components/layout/container";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { cn } from "@/lib/utils";
import { isNavLinkActive, navTabClass } from "@/lib/tab-styles";

const navLinks = [
  { href: "/get-started", label: "Get Started" },
  { href: "/browse", label: "Skills" },
  { href: "/templates", label: "Templates" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/paths", label: "Paths" },
  { href: "/contribute", label: "Contribute" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--brand-border)] bg-[var(--navbar-bg)] backdrop-blur-md">
      <Container className="flex h-14 items-center justify-between gap-3">
        <Link href="/">
          <BrandLogo className="text-lg sm:text-xl" />
        </Link>

        <div className="flex items-center gap-2">
          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => {
              const active = isNavLinkActive(pathname, link.href);
              return (
                <Link key={link.href} href={link.href} className={navTabClass(active)}>
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <ThemeToggle />

          <button
            type="button"
            className="rounded-lg p-2 text-[var(--muted-foreground)] lg:hidden"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </Container>

      {open && (
        <div className="border-t border-[var(--brand-border)] px-4 py-3 lg:hidden">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => {
              const active = isNavLinkActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(navTabClass(active), "block px-3 py-2.5")}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
