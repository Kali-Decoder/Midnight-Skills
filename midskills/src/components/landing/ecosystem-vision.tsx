import { Container } from "@/components/layout/container";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import {
  Shield,
  Layers,
  Bot,
  Globe,
  Lock,
  Sparkles,
  GitBranch,
  Blocks,
} from "lucide-react";

const NOW = [
  {
    icon: Shield,
    title: "Privacy by design",
    desc: "Skills teach Compact patterns — witnesses, disclose(), commitments, and zk-SNARK circuits — so agents write contracts that protect user data.",
  },
  {
    icon: Bot,
    title: "AI-native workflows",
    desc: "SKILL.md files load directly into Cursor, Claude Code, and Codex — giving agents up-to-date Midnight knowledge instead of stale training data.",
  },
  {
    icon: Layers,
    title: "Runnable templates",
    desc: "Full-stack dApp starters with Compact contracts, witnesses, 1AM wallet flows, and Next.js frontends you can compile and run today.",
  },
];

const FUTURE = [
  {
    icon: Globe,
    title: "Multinetwork from one codebase",
    desc: "Unified provider patterns for Preprod, Preview, and future mainnet — deploy the same dApp everywhere without rewriting wallet or proof-server wiring.",
  },
  {
    icon: Lock,
    title: "Privacy audit toolkit",
    desc: "Expanding security skills: data-leak checklists, nullifier design reviews, and defensive Compact patterns for production audits.",
  },
  {
    icon: Blocks,
    title: "Indexer & real-time state",
    desc: "GraphQL subscription skills for watching contract events, reading ledger state, and building reactive UIs on private data.",
  },
  {
    icon: Sparkles,
    title: "Shielded NFTs & DeFi",
    desc: "OpenZeppelin token patterns, payment vaults, time-locks, and privacy-preserving leaderboards — a growing library of domain skills.",
  },
  {
    icon: GitBranch,
    title: "Community registry",
    desc: "Contributors publish skills via skills.json — versioned, categorized, and discoverable. The ecosystem grows with every builder who shares.",
  },
];

export function EcosystemVision() {
  return (
    <section className="border-y border-[var(--brand-border)] bg-[var(--brand-wash)] py-10 sm:py-20">
      <Container>
        <ScrollReveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
              Midnight ecosystem
            </p>
            <h2 className="mt-2 text-balance text-xl font-bold text-[var(--foreground)] sm:text-3xl">
              Built for today. Growing for tomorrow.
            </h2>
            <p className="mt-3 text-sm leading-[1.7] text-[var(--muted-foreground)] sm:text-base">
              MIDSKILLS is the knowledge layer for Midnight Network — helping developers and AI agents
              build confidential apps as the ecosystem scales from testnet to production.
            </p>
          </div>
        </ScrollReveal>

        <div className="mt-10">
          <ScrollReveal delay={50}>
            <h3 className="text-center text-sm font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              What you get today
            </h3>
          </ScrollReveal>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {NOW.map((item, i) => (
              <ScrollReveal key={item.title} delay={i * 100}>
                <article className="surface surface-hover h-full p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--brand-border)] bg-white/60">
                    <item.icon className="h-5 w-5 text-[var(--foreground)]" />
                  </div>
                  <h4 className="mt-4 font-semibold text-[var(--foreground)]">{item.title}</h4>
                  <p className="mt-2 text-sm leading-[1.7] text-[var(--muted-foreground)]">{item.desc}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>

        <div className="mt-14">
          <ScrollReveal delay={50}>
            <h3 className="text-center text-sm font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Where we&apos;re headed
            </h3>
          </ScrollReveal>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FUTURE.map((item, i) => (
              <ScrollReveal key={item.title} delay={i * 80}>
                <article className="surface surface-hover relative h-full overflow-hidden p-5">
                  <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-[color:var(--brand-soft)] opacity-60" />
                  <div className="relative">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--brand-border)] bg-white/70">
                      <item.icon className="h-4 w-4 text-[var(--foreground)]" />
                    </div>
                    <h4 className="mt-4 font-semibold text-[var(--foreground)]">{item.title}</h4>
                    <p className="mt-2 text-sm leading-[1.7] text-[var(--muted-foreground)]">{item.desc}</p>
                    <span className="mt-3 inline-block rounded-full border border-dashed border-[color:var(--brand-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)]">
                      Coming soon
                    </span>
                  </div>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
