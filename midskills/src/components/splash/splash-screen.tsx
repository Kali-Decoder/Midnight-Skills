"use client";

import Link from "next/link";
import Image from "next/image";
import { BrandLogo } from "@/components/shared/brand-logo";
import { FloatingAvatars } from "@/components/splash/floating-avatars";
import { CommunityPopup } from "@/components/splash/community-popup";
import type { SplashScreenProps } from "@/lib/user-types";

export function SplashScreen({
  githubUrl,
  sessionUser,
  communityUsers,
  communityTotal,
  authError,
}: SplashScreenProps) {
  const loggedIn = Boolean(sessionUser);

  return (
    <div className="splash-screen relative flex min-h-dvh min-h-[100svh] flex-col items-center justify-center overflow-hidden px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 md:px-8 lg:px-10">
      <div className="splash-screen-bg pointer-events-none absolute inset-0" aria-hidden />
      <div className="bg-grid bg-grid-fade pointer-events-none absolute inset-0 opacity-35" aria-hidden />
      <div className="bg-grid-dots bg-grid-fade pointer-events-none absolute inset-0 opacity-45" aria-hidden />

      <FloatingAvatars communityUsers={communityUsers} />

      <div className="splash-center-glow pointer-events-none absolute inset-0" aria-hidden />

      <div className="splash-content relative z-10 flex w-full max-w-[min(100%,28rem)] flex-col items-center px-2 text-center sm:max-w-md sm:px-0 md:max-w-lg lg:max-w-xl">
        <div className="splash-logo-enter mb-6 sm:mb-8">
          <BrandLogo className="text-xl text-[#0a0a0a] sm:text-2xl md:text-3xl lg:text-[2rem]" />
        </div>

        {loggedIn && sessionUser && (
          <div className="splash-copy-enter mb-4 flex max-w-full items-center gap-2 rounded-full border border-neutral-200 bg-white/90 px-3 py-1.5 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sessionUser.avatarUrl}
              alt=""
              className="h-6 w-6 shrink-0 rounded-full border border-neutral-200 sm:h-7 sm:w-7"
            />
            <span className="truncate text-[11px] font-medium text-neutral-700 sm:text-xs">
              Signed in as <span className="text-neutral-900">@{sessionUser.login}</span>
            </span>
          </div>
        )}

        {authError && (
          <p className="splash-copy-enter mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {authError}
          </p>
        )}

        <p className="splash-copy-enter mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-neutral-400 sm:text-[10px] sm:tracking-[0.25em]">
          Midnight Skills Marketplace
        </p>
        <h1 className="splash-copy-enter splash-copy-delay-1 splash-headline text-balance text-lg font-bold sm:text-xl md:text-2xl lg:text-[1.75rem]">
          Privacy-preserving skills for AI agents
        </h1>
        <p className="splash-copy-enter splash-copy-delay-2 mt-2 max-w-[min(100%,20rem)] text-pretty text-xs leading-relaxed text-neutral-500 sm:mt-3 sm:max-w-sm sm:text-sm">
          Compact contracts, wallet flows, and runnable dApp templates — curated on GitHub.
        </p>

        {loggedIn ? (
          <Link
            href="/home"
            className="splash-btn-enter splash-copy-delay-3 group mt-8 inline-flex h-11 w-full max-w-[min(100%,18rem)] items-center justify-center gap-2.5 rounded-full bg-[#0a0a0a] px-6 text-sm font-semibold text-white transition hover:bg-[#171717] sm:mt-10 sm:h-12 sm:max-w-xs sm:px-8 md:min-w-[240px] md:w-auto"
          >
            Continue to MIDSKILLS
          </Link>
        ) : (
          <a
            href="/api/auth/github/start"
            className="splash-btn-enter splash-copy-delay-3 group mt-8 inline-flex h-11 w-full max-w-[min(100%,18rem)] items-center justify-center gap-2.5 rounded-full bg-[#0a0a0a] px-6 text-sm font-semibold text-white transition hover:bg-[#171717] sm:mt-10 sm:h-12 sm:max-w-xs sm:px-8 md:min-w-[240px] md:w-auto"
          >
            <Image src="/logos/github.png" alt="" width={20} height={20} className="rounded-sm" />
            Explore with GitHub
          </a>
        )}

        <a
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="splash-copy-enter splash-copy-delay-3 mt-4 text-xs text-neutral-400 transition hover:text-neutral-700"
        >
          View repository on GitHub
        </a>
      </div>

      <CommunityPopup users={communityUsers} totalCount={communityTotal} />
    </div>
  );
}
