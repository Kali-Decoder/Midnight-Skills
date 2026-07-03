import Link from "next/link";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/shared/page-header";
import { getCollections } from "@/lib/collections";
import { loadRegistry } from "@/lib/registry";
import { DIFFICULTY_CONFIG } from "@/lib/constants";

export default function PathsPage() {
  const collections = getCollections();
  const registry = loadRegistry();
  const levels = registry.skillLevels ?? [];
  const skillName = (id: string) => registry.skills.find((s) => s.id === id)?.name ?? id;

  return (
    <Container className="page-section safe-bottom">
      <PageHeader
        title="Learning Paths"
        description="Curated sequences and skill levels — from privacy basics to production dApps."
      />

      <section className="mt-10 sm:mt-12">
        <h2 className="section-heading">Curated journeys</h2>
        <p className="section-lead max-w-2xl">Follow bundled skill sequences for common Midnight builder goals.</p>
        <div className="mt-6 grid gap-4 sm:gap-6 lg:grid-cols-2">
          {collections.map((c) => (
            <article key={c.id} id={c.id} className="surface scroll-mt-20 p-5 sm:p-6">
              <h3 className="text-base font-semibold sm:text-lg">{c.name}</h3>
              <ol className="mt-4 space-y-3">
                {c.skills.map((step, i) => (
                  <li key={step.skillId} className="flex gap-3 text-sm">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-xs font-bold text-[var(--foreground)]">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <Link href={`/browse/${step.skillId}`} className="font-medium text-[var(--foreground)] hover:underline">
                        {skillName(step.skillId)}
                      </Link>
                      <p className="text-[var(--muted-foreground)]">{step.summary}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 sm:mt-16">
        <h2 className="section-heading">Skill levels</h2>
        <p className="section-lead max-w-2xl">Progress from privacy basics to advanced production patterns.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {levels.map((level) => {
            const diff = DIFFICULTY_CONFIG[level.id] ?? DIFFICULTY_CONFIG.intermediate;
            return (
              <div key={level.id} className="surface p-5 sm:p-6">
                <span className={`chip px-2 py-0.5 ${diff.bg} ${diff.text}`}>{level.title}</span>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">{level.subtitle}</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {level.skills.map((s) => (
                    <li key={s.skillId}>
                      <Link href={`/browse/${s.skillId}`} className="hover:text-[var(--foreground)] hover:underline">
                        {skillName(s.skillId)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </Container>
  );
}
