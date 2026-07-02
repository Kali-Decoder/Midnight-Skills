"use client";

import { cn } from "@/lib/utils";
import { SUPPORTED_AI_TOOLS } from "@/lib/constants";
import { Container } from "@/components/layout/container";
import { ScrollReveal } from "@/components/landing/scroll-reveal";

function ToolIcon({ name, logo, size = 22 }: { name: string; logo: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo}
      alt={name}
      title={name}
      width={size}
      height={size}
      className="provider-logo shrink-0"
      loading="lazy"
    />
  );
}

function ToolChip({ name, logo }: { name: string; logo: string }) {
  return (
    <span
      className="chip flex shrink-0 items-center gap-2 border border-[color:var(--brand-border)] bg-white/60 px-3 py-1.5 text-[11px] text-[var(--foreground)]"
      title={name}
    >
      <ToolIcon name={name} logo={logo} size={18} />
      <span className="whitespace-nowrap">{name}</span>
    </span>
  );
}

export function SupportedToolsMarquee({ className }: { className?: string }) {
  const items = [...SUPPORTED_AI_TOOLS, ...SUPPORTED_AI_TOOLS];

  return (
    <div className={cn("tool-marquee overflow-hidden", className)}>
      <div className="tool-marquee-track flex w-max items-center gap-2">
        {items.map((tool, i) => (
          <ToolChip key={`${tool.id}-${i}`} name={tool.name} logo={tool.logo} />
        ))}
      </div>
    </div>
  );
}

export function SupportedToolsGrid({
  className,
  iconSize = 28,
}: {
  className?: string;
  iconSize?: number;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-3 gap-3 sm:grid-cols-5 sm:gap-4 lg:grid-cols-9",
        className,
      )}
    >
      {SUPPORTED_AI_TOOLS.map((tool) => (
        <div
          key={tool.id}
          className="group flex flex-col items-center gap-2 rounded-xl border border-[color:var(--brand-border)] bg-white/50 px-2 py-3 transition hover:border-[color-mix(in_oklab,var(--foreground),white_75%)] hover:bg-white/80"
          title={tool.name}
        >
          <ToolIcon name={tool.name} logo={tool.logo} size={iconSize} />
          <span className="text-center text-[10px] font-medium leading-tight text-[var(--muted-foreground)] transition-colors group-hover:text-[var(--foreground)] sm:text-[11px]">
            {tool.name}
          </span>
        </div>
      ))}
    </div>
  );
}

export function SupportedToolsRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-3 sm:gap-4", className)}>
      {SUPPORTED_AI_TOOLS.map((tool) => (
        <div
          key={tool.id}
          className="group flex items-center gap-2 rounded-full border border-[color:var(--brand-border)] bg-white/55 px-3 py-1.5 transition hover:bg-white/85"
          title={tool.name}
        >
          <ToolIcon name={tool.name} logo={tool.logo} size={20} />
          <span className="text-[11px] font-medium text-[var(--muted-foreground)] transition-colors group-hover:text-[var(--foreground)]">
            {tool.name}
          </span>
        </div>
      ))}
    </div>
  );
}

export function SupportedToolsSection() {
  return (
    <section className="border-b border-[var(--brand-border)] bg-[var(--brand-wash)] py-10 sm:py-14">
      <Container>
        <ScrollReveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">
              Works with your AI tools
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)] sm:text-base">
              Install skills once and use them across Cursor, Claude Code, Codex, Gemini, Windsurf,
              GitHub Copilot, and more.
            </p>
          </div>
        </ScrollReveal>
        <ScrollReveal delay={80}>
          <SupportedToolsGrid className="mx-auto mt-8 max-w-4xl sm:mt-10" iconSize={32} />
        </ScrollReveal>
      </Container>
    </section>
  );
}
