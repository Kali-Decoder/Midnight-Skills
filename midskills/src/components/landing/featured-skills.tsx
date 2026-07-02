import Link from "next/link";
import { Container } from "@/components/layout/container";
import { DIFFICULTY_CONFIG } from "@/lib/constants";
import { getSkillProfiles } from "@/lib/skills";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { FolderOpen, ArrowRight } from "lucide-react";

export function FeaturedSkills() {
  const featured = getSkillProfiles()
    .filter((p) => p.meta.featured)
    .slice(0, 6);

  if (featured.length === 0) return null;

  return (
    <section className="border-y border-[var(--brand-border)] bg-[var(--brand-wash)] py-10 sm:py-16">
      <Container>
        <ScrollReveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-xl font-bold text-[var(--foreground)] sm:text-3xl">
              Featured skills
            </h2>
            <p className="mt-3 text-sm leading-[1.7] text-[var(--muted-foreground)] sm:text-base">
              Start here — the most essential skills for building on Midnight Network.
            </p>
          </div>
        </ScrollReveal>

        <div className="mt-8 grid gap-3 sm:mt-10 md:grid-cols-2 lg:grid-cols-3">
          {featured.map((skill, i) => {
            const diff = DIFFICULTY_CONFIG[skill.meta.difficulty] ?? DIFFICULTY_CONFIG.intermediate;
            return (
              <ScrollReveal key={skill.slug} delay={i * 80}>
                <Link
                  href={`/browse/${skill.slug}`}
                  className="surface surface-hover group flex h-full flex-col p-4 sm:p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[color:var(--brand-border)] bg-white/60">
                      <FolderOpen className="h-4 w-4 text-[var(--foreground)]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-[var(--foreground)] group-hover:underline">
                        {skill.meta.name}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                        {skill.meta.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-[color:var(--brand-soft)] px-2 py-0.5 text-[10px] font-medium">
                      {skill.meta.category}
                    </span>
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${diff.bg} ${diff.text}`}>
                      {diff.label}
                    </span>
                  </div>
                  <p className="mt-4 flex items-center gap-1 text-xs font-medium text-[var(--foreground)]">
                    Open skill <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </p>
                </Link>
              </ScrollReveal>
            );
          })}
        </div>

        <ScrollReveal delay={150}>
          <div className="mt-8 text-center">
            <Link
              href="/browse"
              className="inline-flex h-10 items-center rounded-full border border-[color:var(--brand-border)] bg-white/60 px-6 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white/80"
            >
              View all skills
            </Link>
          </div>
        </ScrollReveal>
      </Container>
    </section>
  );
}
