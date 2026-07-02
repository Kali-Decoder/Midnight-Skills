"use client";

import Link from "next/link";
import { useState } from "react";
import { Container } from "@/components/layout/container";
import { ScrollReveal } from "@/components/landing/scroll-reveal";

const FAQS = [
  {
    q: "What is Midnight Network?",
    a: "Midnight is a data-protection blockchain that combines public ledger state with private witness data and zero-knowledge proofs. Developers write Compact smart contracts; the network handles zk-SNARK proof generation.",
  },
  {
    q: "Who are MIDSKILLS for?",
    a: "AI agent users (Cursor, Claude Code, Codex), solo developers prototyping dApps, and teams shipping privacy-preserving apps on Midnight Preprod and beyond.",
  },
  {
    q: "How do I install a skill?",
    a: "Run npx skills add Kali-Decoder/Midnight-skills to install every skill at once in Cursor, Claude Code, or other skills-compatible tools. You can also download a ZIP from any skill page, or copy a single folder (cp -r compact/ .cursor/skills/).",
  },
  {
    q: "What's the difference between skills and templates?",
    a: "Skills are agent instructions (SKILL.md) that teach patterns and APIs. Templates are full runnable repos — Next.js + Compact contracts you clone, compile, and run locally.",
  },
  {
    q: "Do I need blockchain experience?",
    a: "Beginner paths start with why-midnight and hello-world. Skills are tiered beginner → intermediate → advanced. Start with one skill matching your immediate goal.",
  },
  {
    q: "Can I contribute my own skills?",
    a: "Yes. Add a folder with SKILL.md, register it in skills.json, and open a PR. See /contribute for the contributor workflow and registry sync.",
  },
  {
    q: "How does privacy work in Compact?",
    a: "Private data lives in witnesses (off-chain). Only what you disclose() appears on the public ledger. Skills cover commitment schemes, nullifiers, and selective disclosure patterns.",
  },
  {
    q: "Which wallet should I use?",
    a: "1AM browser extension is recommended for dust-free flows on Preprod. Skills cover 1AM integration, Lace, and headless wallet patterns for testing.",
  },
  {
    q: "Are templates production-ready?",
    a: "Templates are solid starting points with working circuits and wallet flows. Review security skills, run tests, and adapt for your production requirements before mainnet.",
  },
  {
    q: "Will skills stay up to date?",
    a: "The registry syncs versions across Compact compiler, midnight-js SDK, and wallet packages. Knowledge base articles cover version pins and common gotchas.",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="safe-bottom bg-[var(--background)] py-10 sm:py-20">
      <Container>
        <div className="mx-auto max-w-3xl">
          <ScrollReveal>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
                Frequently asked questions
              </h2>
              <p className="mt-3 text-sm leading-[1.7] text-[var(--muted-foreground)] sm:text-base">
                Everything you need to know about building with MIDSKILLS on Midnight Network.
              </p>
            </div>
          </ScrollReveal>

          <div className="mt-8 space-y-3 sm:mt-10">
            {FAQS.map((item, i) => {
              const isOpen = openIndex === i;
              return (
                <ScrollReveal key={item.q} delay={i * 40}>
                  <div
                    className={`faq-item surface overflow-hidden transition-shadow duration-300 ${isOpen ? "faq-item-open shadow-md" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenIndex(isOpen ? null : i)}
                      className="flex w-full cursor-pointer items-start justify-between gap-3 p-4 text-left sm:p-5"
                      aria-expanded={isOpen}
                    >
                      <h3 className="min-w-0 flex-1 text-sm font-semibold leading-snug text-[var(--foreground)] sm:text-base">
                        {item.q}
                      </h3>
                      <span
                        className={`faq-icon mt-0.5 shrink-0 text-lg leading-none text-[var(--muted-foreground)] transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`}
                      >
                        +
                      </span>
                    </button>
                    <div
                      className="faq-panel grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                      style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                    >
                      <div className="overflow-hidden">
                        <p className="faq-answer px-4 pb-4 text-sm leading-[1.75] text-[var(--muted-foreground)] sm:px-5 sm:pb-5">
                          {item.a}
                        </p>
                      </div>
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>

          <ScrollReveal delay={200}>
            <div className="surface mt-8 p-5 text-center sm:mt-10 sm:p-6">
              <h3 className="text-lg font-bold text-[var(--foreground)] sm:text-2xl">
                Ready to build on Midnight?
              </h3>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-[1.75] text-[var(--muted-foreground)] sm:text-base">
                Pick a skill, load it into your agent, or clone a template and ship your first privacy-preserving dApp.
              </p>
              <div className="mt-5 flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
                <Link
                  href="/browse"
                  className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--primary)] px-6 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[color-mix(in_oklab,var(--primary),white_15%)] sm:w-auto"
                >
                  Browse all skills
                </Link>
                <Link
                  href="/templates"
                  className="inline-flex h-11 w-full items-center justify-center rounded-full border border-[color:var(--brand-border)] bg-[var(--secondary)] px-6 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[color-mix(in_oklab,var(--secondary),white_10%)] sm:w-auto"
                >
                  View templates
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </Container>
    </section>
  );
}
