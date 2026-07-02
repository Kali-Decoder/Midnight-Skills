"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderOpen, ArrowRight } from "lucide-react";
import { DIFFICULTY_CONFIG } from "@/lib/constants";
import type { HeroSkillItem } from "@/lib/hero-skill-types";
import { cn } from "@/lib/utils";

const CYCLE_MS = 2800;

export function HeroSkillsAnimation({ skills }: { skills: HeroSkillItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (skills.length <= 1) return;

    const id = setInterval(() => {
      setActiveIndex((i) => (i + 1) % skills.length);
    }, CYCLE_MS);

    return () => clearInterval(id);
  }, [skills.length]);

  if (skills.length === 0) return null;

  const ordered = skills.map((skill, i) => {
    const offset = (i - activeIndex + skills.length) % skills.length;
    return { skill, offset };
  }).filter(({ offset }) => offset < 3);

  return (
    <div className="hero-skills-wrap mx-auto w-full max-w-[340px] lg:max-w-none">
      <div className="mb-3 flex items-center justify-between px-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
          Featured skills
        </p>
        <span className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)]">
          <span className="hero-skills-live h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Live preview
        </span>
      </div>

      <div className="hero-skills-stack relative mx-auto h-[248px] w-full sm:h-[260px]">
        {ordered.map(({ skill, offset }) => {
          const diff = DIFFICULTY_CONFIG[skill.difficulty] ?? DIFFICULTY_CONFIG.intermediate;
          return (
            <Link
              key={skill.slug}
              href={`/browse/${skill.slug}`}
              className={cn(
                "hero-skill-card surface absolute inset-x-0 block p-4 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] sm:p-5",
                offset === 0 && "hero-skill-active z-30 opacity-100",
                offset === 1 && "hero-skill-behind-1 z-20",
                offset === 2 && "hero-skill-behind-2 z-10",
                mounted && offset === 0 && "hero-skill-enter",
              )}
              style={{
                top: `${offset * 14}px`,
                transform:
                  offset === 0
                    ? "scale(1) translateY(0)"
                    : offset === 1
                      ? "scale(0.96) translateY(0)"
                      : "scale(0.92) translateY(0)",
              }}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[color:var(--brand-border)] bg-white/70">
                  <FolderOpen className="h-4 w-4 text-[var(--foreground)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-[var(--foreground)]">{skill.name}</h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="rounded-md bg-[color:var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-medium">
                      {skill.category}
                    </span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${diff.bg} ${diff.text}`}>
                      {diff.label}
                    </span>
                  </div>
                  <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-[var(--muted-foreground)]">
                    <span className="truncate">{skill.tag}</span>
                    <ArrowRight className="h-3 w-3 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-4 flex justify-center gap-1.5">
        {skills.map((skill, i) => (
          <button
            key={skill.slug}
            type="button"
            aria-label={`Show ${skill.name}`}
            onClick={() => setActiveIndex(i)}
            className={cn(
              "h-1 rounded-full transition-all duration-300",
              i === activeIndex ? "w-5 bg-[var(--foreground)]" : "w-1 bg-[var(--brand-border)] hover:bg-[var(--muted-foreground)]",
            )}
          />
        ))}
      </div>
    </div>
  );
}
