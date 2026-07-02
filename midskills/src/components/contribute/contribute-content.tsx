"use client";

import Link from "next/link";
import {
  BookOpen,
  Code2,
  FileText,
  FolderGit2,
  GitPullRequest,
  Layers,
  Shield,
  Sparkles,
} from "lucide-react";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/shared/page-header";
import { CopyCommand } from "@/components/shared/copy-command";
import { ScrollReveal } from "@/components/landing/scroll-reveal";

const WAYS = [
  {
    icon: Sparkles,
    title: "Add a new skill",
    desc: "Create a folder + SKILL.md with agent triggers, workflow, and troubleshooting.",
  },
  {
    icon: FileText,
    title: "Improve a skill",
    desc: "Fix errors, update SDK versions, add gotchas from real Preprod testing.",
  },
  {
    icon: BookOpen,
    title: "Knowledge references",
    desc: "Add shared docs under references/ — provider wiring, version pins, gotchas.",
  },
  {
    icon: Layers,
    title: "Runnable template",
    desc: "Ship a full project under templates/ and link it with templatePath.",
  },
  {
    icon: Code2,
    title: "Registry & site",
    desc: "Update skills.json and run sync:registry — never hand-edit generated lists.",
  },
  {
    icon: Shield,
    title: "Review & quality",
    desc: "Help review PRs for accuracy, privacy patterns, and agent usability.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Pick an id & folder",
    desc: "Kebab-case folder matching skill id, e.g. example-locker-dapp/SKILL.md",
  },
  {
    n: "02",
    title: "Write SKILL.md",
    desc: "YAML frontmatter with trigger-rich description, workflow, troubleshooting table.",
  },
  {
    n: "03",
    title: "Register in skills.json",
    desc: "Unique id, category, taskHint, routerBullets (agent copy), and short tags (UI pills).",
  },
  {
    n: "04",
    title: "Sync the registry",
    desc: "npm run sync:registry updates router, README, howto, and package.json.",
  },
  {
    n: "05",
    title: "Verify locally",
    desc: "Browse /browse/your-skill on midskills dev server; test copy/download flows.",
  },
  {
    n: "06",
    title: "Open a pull request",
    desc: "Use the PR checklist below. Link related issues for large or overlapping skills.",
  },
];

const RULES = [
  "Midnight-only scope — Compact, wallets, SDK, privacy patterns, or full Midnight dApps.",
  "Accuracy over volume — pin real package versions; document known bugs and workarounds.",
  "Written for agents — triggers, numbered workflow, copy-paste code, troubleshooting.",
  "Single registry — update skills.json + sync; never hand-edit generated router blocks.",
  "No secrets — no .env, mnemonics, or API keys in examples.",
  "MIT license — contributions are licensed under the project MIT License.",
];

const CHECKLIST = [
  "SKILL.md exists with valid YAML frontmatter",
  "skills.json entry with unique id and short tags array",
  "npm run sync:registry run; synced files committed",
  "No secrets or credentials in the diff",
  "Examples use current midnight-js patterns (low-level deploy where needed)",
  "Troubleshooting or gotchas for non-trivial skills",
  "Related skills cross-linked",
];

const CATEGORIES = [
  { cat: "foundation", examples: "why-midnight, compact, testing", note: "Concepts & language" },
  { cat: "wallet", examples: "1am-wallet, react-wallet-connector", note: "Browser/headless wallets" },
  { cat: "sdk", examples: "midnight-js, indexer, multinetwork", note: "TypeScript SDK" },
  { cat: "domain", examples: "nft, token-transfers, security", note: "Product patterns" },
  { cat: "full-template", examples: "hello-world, locker-dapp, leaderboard", note: "Full-stack dApp template skills" },
];

const REGISTRY_EXAMPLE = `{
  "id": "your-skill-name",
  "name": "Your Skill Display Name",
  "path": "your-skill-name/SKILL.md",
  "description": "Short site description (1–2 sentences).",
  "enabled": true,
  "featured": false,
  "category": "foundation",
  "taskHint": "When an agent should pick this skill",
  "tags": ["Compact", "ZK", "Privacy"],
  "routerBullets": [
    "Longer bullet for AI router index.",
    "Second bullet for agent discovery."
  ]
}`;

export function ContributeContent({ repository }: { repository?: string }) {
  const repo = repository ?? "https://github.com/Kali-Decoder/Midnight-skills";

  return (
    <div className="relative">
      <Container className="safe-bottom py-8 sm:py-16">
        <ScrollReveal>
          <PageHeader
            title="Contribute to MIDSKILLS"
            description="Help grow the Midnight Network knowledge base — skills for AI agents, runnable templates, and shared references."
          />
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Quality SKILL.md files matter most. The marketplace surfaces what you add to{" "}
            <code className="rounded bg-[var(--brand-soft)] px-1.5 py-0.5 text-xs">skills.json</code>.
          </p>
        </ScrollReveal>

        <section className="mt-10 sm:mt-14">
          <ScrollReveal>
            <h2 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">Ways to contribute</h2>
          </ScrollReveal>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {WAYS.map((item, i) => (
              <ScrollReveal key={item.title} delay={i * 60}>
                <article className="surface surface-hover h-full p-5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--brand-border)] bg-white/60">
                    <item.icon className="h-4 w-4 text-[var(--foreground)]" />
                  </div>
                  <h3 className="mt-3 font-semibold text-[var(--foreground)]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">{item.desc}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </section>

        <section className="mt-12 sm:mt-16">
          <ScrollReveal>
            <h2 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">Contribution rules</h2>
          </ScrollReveal>
          <ScrollReveal delay={80}>
            <ul className="surface mt-6 space-y-3 p-5 sm:p-6">
              {RULES.map((rule) => (
                <li key={rule} className="flex gap-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--foreground)]" />
                  {rule}
                </li>
              ))}
            </ul>
          </ScrollReveal>
        </section>

        <section className="mt-12 sm:mt-16">
          <ScrollReveal>
            <h2 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">Step-by-step workflow</h2>
          </ScrollReveal>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((step, i) => (
              <ScrollReveal key={step.n} delay={i * 70}>
                <div className="surface surface-hover h-full p-5">
                  <p className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)]">STEP {step.n}</p>
                  <h3 className="mt-2 font-semibold text-[var(--foreground)]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">{step.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        <section className="mt-12 sm:mt-16">
          <div className="detail-layout">
            <div className="min-w-0">
              <ScrollReveal>
                <h2 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">Registry entry</h2>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                  Add to the <code className="text-xs">skills</code> array in skills.json. Use{" "}
                  <strong className="text-[var(--foreground)]">tags</strong> for short UI pills and{" "}
                  <strong className="text-[var(--foreground)]">routerBullets</strong> for agent router copy.
                </p>
              </ScrollReveal>
              <ScrollReveal delay={100}>
                <div className="mt-4 overflow-hidden rounded-2xl border border-[color:var(--brand-border)] bg-white/60">
                  <div className="border-b border-[color:var(--brand-border)] px-4 py-2.5 text-sm font-medium">
                    skills.json snippet
                  </div>
                  <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-[var(--muted-foreground)]">
                    {REGISTRY_EXAMPLE}
                  </pre>
                </div>
              </ScrollReveal>

              <ScrollReveal delay={150}>
                <div className="mt-6">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Sync command
                  </p>
                  <CopyCommand command="npm run sync:registry" />
                </div>
              </ScrollReveal>
            </div>

            <aside className="detail-sidebar">
              <div className="detail-sidebar-inner">
                <ScrollReveal>
                  <div className="surface p-4">
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">Skills vs templates</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
                      <strong className="text-[var(--foreground)]">Skills</strong> are markdown for AI agents.{" "}
                      <strong className="text-[var(--foreground)]">Templates</strong> are runnable repos linked via{" "}
                      <code className="text-xs">templatePath</code>.
                    </p>
                    <Link href="/templates" className="mt-3 inline-block text-sm font-medium hover:underline">
                      Browse templates →
                    </Link>
                  </div>
                </ScrollReveal>

                <ScrollReveal delay={80}>
                  <div className="surface p-4">
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">PR checklist</h3>
                    <ul className="mt-3 space-y-2">
                      {CHECKLIST.map((item) => (
                        <li key={item} className="flex gap-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                          <span className="text-[var(--foreground)]">□</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </ScrollReveal>

                <a
                  href={`${repo}/issues`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[color-mix(in_oklab,var(--primary),white_15%)]"
                >
                  <FolderGit2 className="h-4 w-4" />
                  Open an issue
                </a>
                <a
                  href={repo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[color:var(--brand-border)] bg-white/60 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white/80"
                >
                  <GitPullRequest className="h-4 w-4" />
                  View on GitHub
                </a>
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-12 sm:mt-16">
          <ScrollReveal>
            <h2 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">Skill categories</h2>
          </ScrollReveal>
          <div className="mt-6 overflow-hidden rounded-2xl border border-[color:var(--brand-border)]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[color:var(--brand-border)] bg-[var(--brand-soft)]">
                <tr>
                  <th className="px-4 py-3 font-semibold text-[var(--foreground)]">Category</th>
                  <th className="hidden px-4 py-3 font-semibold text-[var(--foreground)] sm:table-cell">Examples</th>
                  <th className="px-4 py-3 font-semibold text-[var(--foreground)]">Use for</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((row) => (
                  <tr key={row.cat} className="border-b border-[color:var(--brand-border)] last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-[var(--foreground)]">{row.cat}</td>
                    <td className="hidden px-4 py-3 text-[var(--muted-foreground)] sm:table-cell">{row.examples}</td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <ScrollReveal>
          <div className="surface mt-12 p-6 text-center sm:mt-16 sm:p-8">
            <h2 className="text-lg font-bold text-[var(--foreground)] sm:text-xl">Ready to contribute?</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-[var(--muted-foreground)]">
              Read the full guide on GitHub, explore existing skills, then open a PR with your SKILL.md and registry entry.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={`${repo}/blob/main/CONTRIBUTING.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center rounded-full bg-[var(--primary)] px-6 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[color-mix(in_oklab,var(--primary),white_15%)]"
              >
                Full CONTRIBUTING.md
              </a>
              <Link
                href="/browse"
                className="inline-flex h-11 items-center rounded-full border border-[color:var(--brand-border)] bg-white/60 px-6 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white/80"
              >
                Browse existing skills
              </Link>
            </div>
          </div>
        </ScrollReveal>

        <div className="h-10" />
      </Container>
    </div>
  );
}
