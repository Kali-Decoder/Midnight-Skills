import Link from "next/link";
import { Container } from "@/components/layout/container";
import { ScrollReveal } from "@/components/landing/scroll-reveal";

const CARDS = [
  {
    title: "Discover & share",
    desc: "Explore community-curated skills for Compact contracts, wallet integration, ZK patterns, and privacy-preserving dApp architecture on Midnight.",
  },
  {
    title: "Integrate in minutes",
    desc: "Copy SKILL.md into Cursor or Claude, drop folders into .cursor/skills/, or clone runnable templates — no reinventing Midnight boilerplate.",
  },
  {
    title: "Ship with privacy",
    desc: "Start from audited patterns: shielded transfers, selective disclosure, nullifier design, and production-ready SDK wiring.",
  },
];

export function ValueProps() {
  return (
    <section className="safe-bottom bg-[var(--background)] py-10 sm:py-16">
      <Container>
        <ScrollReveal>
          <div className="mx-auto max-w-2xl px-1 text-center sm:px-0">
            <h2 className="text-balance text-xl font-bold text-[var(--foreground)] sm:text-3xl">
              Your developer hub for Midnight Network
            </h2>
            <p className="mt-3 text-pretty text-sm leading-[1.7] text-[var(--muted-foreground)] sm:text-base">
              Browse reusable skills, runnable templates, SDK guides, and knowledge references —
              then plug them into your agent or codebase and ship privacy-first apps faster.
            </p>
          </div>
        </ScrollReveal>

        <div className="mt-8 grid gap-3 sm:mt-12 sm:grid-cols-3 sm:gap-4">
          {CARDS.map((c, i) => (
            <ScrollReveal key={c.title} delay={i * 100}>
              <div className="surface surface-hover h-full p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-[var(--foreground)] sm:text-base">{c.title}</h3>
                <p className="mt-2 text-sm leading-[1.7] text-[var(--muted-foreground)]">{c.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={200}>
          <div className="mt-8 flex w-full flex-col items-stretch gap-3 sm:mt-10 sm:flex-row sm:items-center sm:justify-center">
            <Link
              href="/browse"
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--primary)] px-6 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[color-mix(in_oklab,var(--primary),white_15%)] sm:w-auto"
            >
              Explore skills
            </Link>
            <Link
              href="/contribute"
              className="inline-flex h-11 w-full items-center justify-center rounded-full border border-[color:var(--brand-border)] bg-[var(--secondary)] px-6 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[color-mix(in_oklab,var(--secondary),white_10%)] sm:w-auto"
            >
              Contributor guide
            </Link>
          </div>
        </ScrollReveal>
      </Container>
    </section>
  );
}
