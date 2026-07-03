"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import type { Collection } from "@/lib/collection-types";
import { ScrollReveal } from "@/components/landing/scroll-reveal";

const USE_CASES = [
  {
    title: "Privacy-first dApps",
    desc: "Build shielded token flows, payment vaults, time-locks, and selective disclosure — without leaking user data on-chain.",
  },
  {
    title: "AI agent builders",
    desc: "Load Compact syntax, wallet SDK patterns, and debugging guides into Cursor or Claude so agents write correct Midnight code.",
  },
  {
    title: "ZK contract developers",
    desc: "Master witnesses, ledger ADTs, disclose(), nullifiers, and Merkle proofs with example-driven Compact skills.",
  },
  {
    title: "Wallet integrators",
    desc: "Wire 1AM, Lace, or headless wallets — DUST generation, circuit calls, and dust-free transaction flows on Preprod.",
  },
  {
    title: "DeFi & gaming",
    desc: "Token transfers, NFT patterns, privacy-preserving leaderboards, and arcade-style apps with runnable templates.",
  },
  {
    title: "Infra & indexing",
    desc: "GraphQL indexer queries, contract state reads, event subscriptions, and multinetwork provider patterns.",
  },
];

const JOURNEY = [
  {
    step: "01",
    title: "Understand the privacy model",
    desc: "Start with why-midnight — public vs private state, zk-SNARKs, and what Compact actually protects.",
  },
  {
    step: "02",
    title: "Pick your stack",
    desc: "Filter skills by category: Foundation, Wallet, SDK, Domain, or Templates. Use learning paths for curated sequences.",
  },
  {
    step: "03",
    title: "Load into your agent",
    desc: "Run npx skills add Kali-Decoder/Midnight-skills or copy a skill folder — your AI assistant gets Midnight-specific knowledge instantly.",
  },
  {
    step: "04",
    title: "Ship a runnable dApp",
    desc: "Clone a template, compile Compact, connect 1AM wallet, and deploy circuits on Preprod.",
  },
];

const BUILD_WORKFLOW = [
  {
    step: "01",
    title: "Define your privacy goal",
    desc: "What stays private? What gets disclosed? Map witnesses vs ledger fields before writing Compact.",
  },
  {
    step: "02",
    title: "Write the contract",
    desc: "Use the compact skill for syntax, ADTs, and security patterns. Compile with --skip-zk in dev loop.",
  },
  {
    step: "03",
    title: "Wire the SDK",
    desc: "midnight-js providers, wallet facade, private state, and proof server — follow the SDK skill.",
  },
  {
    step: "04",
    title: "Connect the wallet",
    desc: "1AM for browser dApps or headless FluentWallet for tests. Generate DUST before submitting txs.",
  },
  {
    step: "05",
    title: "Test & audit",
    desc: "Vitest + testkit-js for headless flows. Run the security skill checklist before production.",
  },
  {
    step: "06",
    title: "Deploy & iterate",
    desc: "Multinetwork scripts for Preprod/Preview. Watch indexer events and iterate on privacy guarantees.",
  },
];

interface HomeExpansionProps {
  stats: { skills: number; templates: number; knowledge: number };
  collections: Collection[];
}

function CountUp({ value, durationMs = 1200 }: { value: number; durationMs?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame = 0;
    let start = 0;

    const tick = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [value, durationMs]);

  return <>{display.toLocaleString()}</>;
}

export function HomeExpansion({ stats, collections }: HomeExpansionProps) {
  const statItems = [
    { label: "Skills & workflows", value: stats.skills },
    { label: "Runnable templates", value: stats.templates },
    { label: "Knowledge articles", value: stats.knowledge },
    { label: "Total resources", value: stats.skills + stats.templates + stats.knowledge },
  ];

  return (
    <>
      <section className="border-y border-[var(--brand-border)] bg-[var(--brand-wash)] py-6 sm:py-10">
        <Container>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4">
            {statItems.map((item, i) => (
              <ScrollReveal key={item.label} delay={i * 60}>
                <div className="surface p-3 text-center sm:p-4">
                  <p className="text-lg font-bold text-[var(--foreground)] sm:text-2xl">
                    <CountUp value={item.value} />
                  </p>
                  <p className="mt-1 text-[10px] leading-snug text-[var(--muted-foreground)] sm:text-sm">
                    {item.label}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-[var(--background)] py-10 sm:py-20">
        <Container>
          <ScrollReveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-balance px-1 text-xl font-bold text-[var(--foreground)] sm:px-0 sm:text-3xl">
                Built for every Midnight builder
              </h2>
              <p className="mt-3 text-pretty text-sm leading-[1.7] text-[var(--muted-foreground)] sm:text-base">
                Whether you&apos;re writing your first Compact contract, integrating a wallet, or hardening
                a production dApp — MIDSKILLS gives you reusable foundations.
              </p>
            </div>
          </ScrollReveal>

          <div className="mt-8 grid gap-4 sm:mt-10 md:grid-cols-2 lg:grid-cols-3">
            {USE_CASES.map((item, i) => (
              <ScrollReveal key={item.title} delay={i * 70}>
                <article className="surface surface-hover h-full p-5">
                  <span className="chip">{item.title}</span>
                  <p className="mt-3 text-sm leading-[1.7] text-[var(--muted-foreground)]">{item.desc}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-y border-[var(--brand-border)] bg-[var(--brand-wash)] py-10 sm:py-20">
        <Container>
          <ScrollReveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-balance text-xl font-bold text-[var(--foreground)] sm:text-3xl">
                From zero to deployed dApp
              </h2>
              <p className="mt-3 text-sm leading-[1.7] text-[var(--muted-foreground)] sm:text-base">
                A simple path that helps builders move from reading to shipping on Midnight.
              </p>
            </div>
          </ScrollReveal>

          <div className="mt-8 grid gap-4 sm:mt-10 lg:grid-cols-2">
            {JOURNEY.map((item, i) => (
              <ScrollReveal key={item.step} delay={i * 90}>
                <div className="surface surface-hover p-5">
                  <p className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)]">
                    STEP {item.step}
                  </p>
                  <h3 className="mt-2 text-base font-bold text-[var(--foreground)]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-[1.7] text-[var(--muted-foreground)]">{item.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-10 sm:py-16">
        <Container>
          <ScrollReveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">Learning paths</h2>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                Curated skill sequences from privacy basics to production dApps.
              </p>
            </div>
          </ScrollReveal>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {collections.map((c, i) => (
              <ScrollReveal key={c.id} delay={i * 100}>
                <Link href={`/paths#${c.id}`} className="surface surface-hover block p-5">
                  <h3 className="font-semibold text-[var(--foreground)]">{c.name}</h3>
                  <p className="mt-2 text-sm text-[var(--muted-foreground)]">{c.description}</p>
                  <p className="mt-3 text-xs font-medium text-[var(--foreground)]">
                    {c.skillSlugs.length} skills →
                  </p>
                </Link>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal delay={150}>
            <div className="mt-8 text-center">
              <Link href="/paths">
                <Button variant="outline" className="rounded-full">
                  View all paths
                </Button>
              </Link>
            </div>
          </ScrollReveal>
        </Container>
      </section>

      <section className="border-t border-[var(--brand-border)] bg-[var(--background)] py-10 sm:py-20">
        <Container>
          <ScrollReveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-balance text-xl font-bold text-[var(--foreground)] sm:text-3xl">
                How to build on Midnight with MIDSKILLS
              </h2>
              <p className="mt-3 text-sm leading-[1.7] text-[var(--muted-foreground)] sm:text-base">
                A practical workflow from privacy design to mainnet-ready deployment.
              </p>
            </div>
          </ScrollReveal>

          <div className="mt-8 grid gap-4 sm:mt-10 md:grid-cols-2 lg:grid-cols-3">
            {BUILD_WORKFLOW.map((item, index) => (
              <ScrollReveal key={item.step} delay={index * 100}>
                <article className="surface surface-hover h-full p-5">
                  <p className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)]">
                    WORKFLOW {item.step}
                  </p>
                  <h3 className="mt-2 text-base font-bold text-[var(--foreground)]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-[1.7] text-[var(--muted-foreground)]">{item.desc}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
