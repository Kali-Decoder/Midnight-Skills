"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Container } from "@/components/layout/container";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserMenu } from "@/components/shared/user-menu";
import type { SessionUser } from "@/lib/session";
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

function NavLinks({
  pathname,
  compact,
  onNavigate,
}: {
  pathname: string;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      {navLinks.map((link) => {
        const active = isNavLinkActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={cn(
              navTabClass(active),
              compact && "shrink-0 px-2 py-1 text-xs",
              onNavigate && "block px-3 py-2.5",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}

export function Navbar({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const closeMenu = useCallback(() => setOpen(false), []);

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeMenu();
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeMenu]);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--brand-border)] bg-[var(--navbar-bg)] backdrop-blur-md">
      <Container className="flex h-14 items-center justify-between gap-2 sm:gap-3">
        <Link href="/home" className="min-w-0 shrink">
          <BrandLogo className="text-base sm:text-lg md:text-xl" />
        </Link>

        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <nav className="scroll-fade-x hidden max-w-[min(52vw,28rem)] items-center gap-0.5 overflow-x-auto md:flex lg:hidden">
            <NavLinks pathname={pathname} compact />
          </nav>

          <nav className="hidden items-center gap-1 lg:flex">
            <NavLinks pathname={pathname} />
          </nav>

          {user ? (
            <UserMenu user={user} className="hidden sm:block" />
          ) : (
            <a
              href="/api/auth/github/start"
              className="btn-secondary hidden h-9 shrink-0 px-3 text-xs font-semibold sm:inline-flex"
            >
              Sign in
            </a>
          )}

          <ThemeToggle />

          <button
            type="button"
            className="rounded-lg p-2 text-[var(--muted-foreground)] md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </Container>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 top-14 z-40 bg-black/20 backdrop-blur-[1px] md:hidden"
            aria-label="Close menu"
            onClick={closeMenu}
          />
          <div className="relative z-50 border-t border-[var(--brand-border)] bg-[var(--navbar-bg)] md:hidden">
            <Container className="py-3">
              <nav className="flex flex-col gap-1">
                <NavLinks pathname={pathname} onNavigate={closeMenu} />
              </nav>
              <div className="mt-3 border-t border-[var(--brand-border)] pt-3">
                {user ? (
                  <UserMenu user={user} className="w-full" />
                ) : (
                  <a
                    href="/api/auth/github/start"
                    className="btn-secondary flex h-10 w-full items-center justify-center text-sm font-semibold"
                  >
                    Sign in with GitHub
                  </a>
                )}
              </div>
            </Container>
          </div>
        </>
      )}
    </header>
  );
}
