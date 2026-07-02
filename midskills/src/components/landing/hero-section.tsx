import Link from "next/link";
import { Container } from "@/components/layout/container";
import { BrandLogo } from "@/components/shared/brand-logo";
import { SkillsCliInstall } from "@/components/shared/skills-cli-install";
import { SupportedToolsMarquee } from "@/components/shared/supported-tools-showcase";

const STEPS = [
  { label: "Discover", desc: "Browse skills & templates" },
  { label: "Integrate", desc: "Load into your agent" },
  { label: "Ship", desc: "Deploy on Midnight" },
];

const PILLARS = [
  "Compact smart contracts",
  "Wallet & SDK flows",
  "Privacy patterns & ZK",
];

export function SupportedToolsBanner() {
  return (
    <section className="tools-showcase-dark border-b border-white/10 bg-[#0a0a0a] py-4 sm:py-5">
      <Container>
        <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-widest text-white/45">
          Works with
        </p>
        <SupportedToolsMarquee />
      </Container>
    </section>
  );
}

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-[var(--brand-border)] bg-[var(--brand-wash)] sm:flex sm:min-h-[calc(100dvh-var(--header-height))] sm:items-center sm:justify-center">
      <div className="pointer-events-none absolute inset-0">
        <div className="bg-grid bg-grid-fade absolute inset-0 opacity-40" />
        <div className="bg-grid-dots bg-grid-fade absolute inset-0 opacity-50" />
      </div>

      <Container className="relative py-10 text-center sm:py-20">
        <div className="mx-auto flex max-w-4xl flex-col items-center">
          <div className="chip mx-auto px-3 py-1.5">
            <BrandLogo className="text-sm" />
            <span>Midnight Skills Marketplace</span>
          </div>

          <h1 className="text-animate-in mt-5 text-balance text-[1.75rem] font-bold leading-[1.15] text-[var(--foreground)] sm:text-[2.5rem] sm:leading-[1.2] md:text-[3rem] lg:text-[3.5rem]">
            Build privacy-preserving apps on{" "}
            <span className="text-shimmer">Midnight</span>
          </h1>

          <p className="text-animate-in text-animate-delay-1 mx-auto mt-4 max-w-2xl text-pretty px-1 text-sm leading-[1.7] text-[var(--muted-foreground)] sm:mt-6 sm:px-0 sm:text-base">
            MIDSKILLS is the open knowledge marketplace for Midnight Network — Compact contracts,
            wallet integration, SDK guides, and runnable dApp templates for AI agents and developers.
          </p>

          <p className="text-animate-in text-animate-delay-2 mx-auto mt-3 max-w-2xl text-pretty px-1 text-sm leading-[1.7] text-[var(--muted-foreground)] sm:mt-4 sm:px-0 sm:text-base">
            Discover, share, and integrate reusable skills without stale docs or reinventing
            privacy patterns from scratch.
          </p>

          <div className="text-animate-in text-animate-delay-2 mt-6 flex w-full max-w-md flex-col items-stretch gap-2 sm:mt-8 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
            {PILLARS.map((item) => (
              <span key={item} className="chip w-full justify-center px-3 py-2 sm:w-auto sm:py-1">
                {item}
              </span>
            ))}
          </div>

          <div className="mt-7 flex w-full max-w-sm flex-col items-stretch gap-3 sm:mt-10 sm:max-w-none sm:flex-row sm:items-center sm:justify-center sm:gap-6">
            <Link
              href="/get-started"
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--primary)] px-8 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[color-mix(in_oklab,var(--primary),white_15%)] sm:h-12 sm:w-auto sm:px-10"
            >
              Get Started
            </Link>
            <Link
              href="/browse"
              className="py-1 text-center text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            >
              Browse skills →
            </Link>
          </div>

          <div className="text-animate-in text-animate-delay-3 mx-auto mt-8 w-full max-w-xl text-left sm:mt-10">
            <SkillsCliInstall
              label="Or install directly"
              hint="Run this in your project root to add every Midnight skill to your agent."
            />
          </div>

          <div className="mt-10 grid w-full max-w-md grid-cols-1 gap-3 sm:mt-16 sm:max-w-2xl sm:grid-cols-3 sm:gap-4">
            {STEPS.map((step, i) => (
              <div
                key={step.label}
                className="surface flex items-center gap-3 p-3 text-left sm:flex-col sm:items-center sm:border-0 sm:bg-transparent sm:p-0 sm:text-center sm:shadow-none sm:backdrop-blur-none"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-soft)] text-xs font-bold text-[var(--foreground)] sm:h-9 sm:w-9">
                  {i + 1}
                </div>
                <div className="min-w-0 sm:mt-2.5">
                  <h3 className="text-xs font-semibold text-[var(--foreground)] sm:text-[11px]">{step.label}</h3>
                  <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted-foreground)] sm:text-[10px]">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
