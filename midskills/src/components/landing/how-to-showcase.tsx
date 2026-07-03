"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { CopyCommand } from "@/components/shared/copy-command";
import { SkillsCliInstall } from "@/components/shared/skills-cli-install";
import { HeroSkillsAnimation } from "@/components/landing/hero-skills-animation";
import { SKILLS_CLI_INSTALL_COMMAND } from "@/lib/constants";
import type { HeroSkillItem } from "@/lib/hero-skill-types";
import { cn } from "@/lib/utils";
import { Terminal, MessageSquare, Rocket, ChevronRight, Play, Pause } from "lucide-react";

type TerminalLine = { text: string; tone?: "cmd" | "ok" | "dim" | "agent" };

const STEPS = [
  {
    id: "install",
    icon: Terminal,
    title: "Install skills",
    description: "Run one command in your project root. Works with Cursor, Claude Code, Codex, and more.",
    lines: [
      { text: SKILLS_CLI_INSTALL_COMMAND, tone: "cmd" as const },
      { text: "✓ All Midnight skills added to .cursor/skills/", tone: "ok" as const },
      { text: "✓ AGENTS.md routing ready", tone: "ok" as const },
    ],
    showCopy: true,
  },
  {
    id: "prompt",
    icon: MessageSquare,
    title: "Ask your agent",
    description: "Describe what you want to build. The agent picks the right Midnight skill automatically.",
    lines: [
      { text: "You: Build a time-lock vault on Midnight", tone: "agent" as const },
      { text: "→ Loading example-locker-dapp skill…", tone: "dim" as const },
      { text: "→ Using Compact circuits + 1AM wallet", tone: "dim" as const },
      { text: "Agent: I'll scaffold the locker contract and wallet flow.", tone: "ok" as const },
    ],
    showCopy: false,
  },
  {
    id: "ship",
    icon: Rocket,
    title: "Ship your dApp",
    description: "Compile Compact, connect your wallet, and deploy to Preprod — or clone a runnable template.",
    lines: [
      { text: "$ npm run compact", tone: "cmd" as const },
      { text: "✓ Contract compiled (locker.compact)", tone: "ok" as const },
      { text: "$ npm run dev", tone: "cmd" as const },
      { text: "→ Wallet connected · Deploying to Preprod…", tone: "dim" as const },
    ],
    showCopy: false,
  },
];

const STEP_MS = 5200;
const CHAR_MS = 28;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

function TypingLine({
  line,
  active,
  reducedMotion,
  lineIndex,
  activeStep,
}: {
  line: TerminalLine;
  active: boolean;
  reducedMotion: boolean;
  lineIndex: number;
  activeStep: number;
}) {
  const [displayed, setDisplayed] = useState(reducedMotion ? line.text : "");
  const [done, setDone] = useState(reducedMotion);

  useEffect(() => {
    if (!active) {
      setDisplayed("");
      setDone(false);
      return;
    }
    if (reducedMotion) {
      setDisplayed(line.text);
      setDone(true);
      return;
    }

    setDisplayed("");
    setDone(false);
    const startDelay = lineIndex * 420;
    let i = 0;
    let interval: ReturnType<typeof setInterval>;

    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setDisplayed(line.text.slice(0, i));
        if (i >= line.text.length) {
          clearInterval(interval);
          setDone(true);
        }
      }, CHAR_MS);
    }, startDelay);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval!);
    };
  }, [active, line.text, lineIndex, reducedMotion, activeStep]);

  const toneClass =
    line.tone === "cmd"
      ? "text-[var(--foreground)]"
      : line.tone === "ok"
        ? "text-emerald-600"
        : line.tone === "agent"
          ? "text-[var(--foreground)] font-medium"
          : "text-[var(--muted-foreground)]";

  return (
    <div className={cn("font-mono text-[11px] leading-relaxed sm:text-xs", toneClass)}>
      <span>{displayed}</span>
      {active && !done && !reducedMotion && (
        <span className="howto-cursor ml-0.5 inline-block h-[1em] w-[6px] bg-[var(--foreground)] align-middle" />
      )}
    </div>
  );
}

export function HowToShowcase({ className, skills }: { className?: string; skills: HeroSkillItem[] }) {
  const reducedMotion = usePrefersReducedMotion();
  const [activeStep, setActiveStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);

  const step = STEPS[activeStep];
  const StepIcon = step.icon;

  const next = useCallback(() => {
    setActiveStep((i) => (i + 1) % STEPS.length);
  }, []);

  useEffect(() => {
    if (reducedMotion || !autoPlay) return;
    const id = setInterval(next, STEP_MS);
    return () => clearInterval(id);
  }, [next, reducedMotion, autoPlay, activeStep]);

  return (
    <section className={cn("border-b border-[var(--brand-border)] bg-[var(--background)] py-10 sm:py-16", className)}>
      <Container>
   

        <ScrollReveal delay={80}>
          <div className="mx-auto mt-8 grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
            {/* Step list */}
            <div className="flex flex-col gap-2 sm:gap-3">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const isActive = i === activeStep;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveStep(i)}
                    className={cn(
                      "howto-step surface flex w-full items-start gap-3 p-4 text-left transition-all sm:p-5",
                      isActive && "howto-step-active ring-2 ring-[var(--foreground)]/10",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors",
                        isActive
                          ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--primary-foreground)]"
                          : "border-[color:var(--brand-border)] bg-[var(--surface-muted)] text-[var(--muted-foreground)]",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                          Step {i + 1}
                        </span>
                        {isActive && autoPlay && !reducedMotion && (
                          <span
                            className="howto-progress h-1 flex-1 overflow-hidden rounded-full bg-[color:var(--brand-soft)]"
                            style={{ "--howto-step-ms": `${STEP_MS}ms` } as React.CSSProperties}
                          >
                            <span className="howto-progress-bar block h-full rounded-full bg-[var(--foreground)]" />
                          </span>
                        )}
                      </div>
                      <h3 className="mt-0.5 text-sm font-semibold text-[var(--foreground)]">{s.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">{s.description}</p>
                    </div>
                  </button>
                );
              })}

              <Link
                href="/get-started"
                className="mt-1 inline-flex items-center justify-center gap-1 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              >
                Full setup guide
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Terminal */}
            <div className="howto-terminal surface overflow-hidden">
              <div className="flex items-center gap-2 border-b border-[color:var(--brand-border)] bg-[var(--surface-soft)] px-4 py-2.5">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                </div>
                <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
                  <StepIcon className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                  <span className="truncate text-[11px] font-medium text-[var(--muted-foreground)]">
                    {step.title}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 p-4 sm:min-h-[200px] sm:p-5">
                {step.lines.map((line, i) => (
                  <TypingLine
                    key={`${activeStep}-${i}`}
                    line={line}
                    active
                    reducedMotion={reducedMotion}
                    lineIndex={i}
                    activeStep={activeStep}
                  />
                ))}
              </div>

              {step.showCopy && (
                <div className="border-t border-[color:var(--brand-border)] bg-[color:var(--brand-soft)]/30 p-4 sm:p-5">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Try it now
                  </p>
                  <CopyCommand command={SKILLS_CLI_INSTALL_COMMAND} />
                </div>
              )}
            </div>
          </div>
        </ScrollReveal>

        {/* Step dots + auto-play */}
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
          <div className="flex gap-2">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Go to step ${i + 1}: ${s.title}`}
                onClick={() => setActiveStep(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === activeStep ? "w-6 bg-[var(--foreground)]" : "w-1.5 bg-[var(--brand-border)] hover:bg-[var(--muted-foreground)]",
                )}
              />
            ))}
          </div>
          {!reducedMotion && (
            <button
              type="button"
              onClick={() => setAutoPlay((on) => !on)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--brand-border)] bg-white/60 px-3 py-1.5 text-[11px] font-medium text-[var(--muted-foreground)] transition hover:bg-white/80 hover:text-[var(--foreground)]"
              aria-pressed={autoPlay}
            >
              {autoPlay ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              {autoPlay ? "Pause demo" : "Auto-play demo"}
            </button>
          )}
        </div>
      </Container>
    </section>
  );
}
