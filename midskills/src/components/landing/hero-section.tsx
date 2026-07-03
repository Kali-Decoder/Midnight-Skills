import Link from "next/link";
import { Container } from "@/components/layout/container";
import { BrandLogo } from "@/components/shared/brand-logo";
import { SkillsCliInstall } from "@/components/shared/skills-cli-install";
import { SupportedToolsMarquee } from "@/components/shared/supported-tools-showcase";
import { HeroSkillsAnimation } from "@/components/landing/hero-skills-animation";
import type { HeroSkillItem } from "@/lib/hero-skill-types";

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

export function HeroSection({ skills }: { skills: HeroSkillItem[] }) {
  return (
    <section className="relative overflow-hidden border-b border-[var(--brand-border)] bg-[var(--brand-wash)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="bg-grid bg-grid-fade absolute inset-0 opacity-40" />
        <div className="bg-grid-dots bg-grid-fade absolute inset-0 opacity-50" />
      </div>

      <Container className="relative py-10 sm:py-14 lg:py-16">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12 xl:gap-16">
          {/* Copy */}
          <div className="mx-auto flex w-full max-w-xl flex-col items-center text-center lg:mx-0 lg:max-w-none lg:items-start lg:text-left">
            <div className="chip px-3 py-1.5">
              <BrandLogo className="text-sm" />
              <span>Midnight Skills Marketplace</span>
            </div>

            <h1 className="text-animate-in mt-5 text-balance text-[1.75rem] font-bold leading-[1.15] text-[var(--foreground)] sm:text-[2.5rem] sm:leading-[1.2] lg:text-[2.75rem] xl:text-[3.25rem]">
              Build privacy-preserving apps on{" "}
              <span className="text-shimmer">Midnight</span>
            </h1>

            <p className="text-animate-in text-animate-delay-1 mt-4 max-w-xl text-pretty text-sm leading-[1.7] text-[var(--muted-foreground)] sm:text-base">
              MIDSKILLS is the open knowledge marketplace for Midnight Network — Compact contracts,
              wallet integration, SDK guides, and runnable dApp templates for AI agents and developers.
            </p>

            <div className="text-animate-in text-animate-delay-2 mt-5 flex w-full flex-wrap justify-center gap-2 lg:justify-start">
              {PILLARS.map((item) => (
                <span key={item} className="chip px-3 py-1.5 text-[11px] sm:text-xs">
                  {item}
                </span>
              ))}
            </div>

            <div className="text-animate-in text-animate-delay-2 mt-7 flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link
                href="/get-started"
                className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--primary)] px-8 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[color-mix(in_oklab,var(--primary),white_15%)] sm:w-auto sm:min-w-[160px]"
              >
                Get Started
              </Link>
              <Link
                href="/browse"
                className="btn-secondary h-11 w-full px-6 sm:w-auto"
              >
                Browse skills
              </Link>
            </div>

            <div className="text-animate-in text-animate-delay-3 mt-6 w-full max-w-md lg:max-w-lg">
              <SkillsCliInstall
                label="Install directly"
                hint="Run in your project root to add every Midnight skill to your agent."
              />
            </div>
          </div>

          {/* Skills animation */}
          <div className="text-animate-in text-animate-delay-1 mx-auto w-full max-w-md lg:max-w-none">
            <HeroSkillsAnimation skills={skills} />
          </div>
        </div>

        {/* Steps */}
        <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-3 sm:mt-12 sm:grid-cols-3 sm:gap-4 lg:mt-14">
          {STEPS.map((step, i) => (
            <div
              key={step.label}
              className="surface flex items-center gap-3 p-4 text-left sm:flex-col sm:items-center sm:p-5 sm:text-center"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-soft)] text-xs font-bold text-[var(--foreground)]">
                {i + 1}
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-semibold text-[var(--foreground)] sm:text-sm">{step.label}</h3>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted-foreground)]">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tools strip */}
        <div className="mt-10 border-t border-[color:var(--brand-border)] pt-8 lg:mt-12">
          <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
            Works with
          </p>
          <SupportedToolsMarquee />
        </div>
      </Container>
    </section>
  );
}
