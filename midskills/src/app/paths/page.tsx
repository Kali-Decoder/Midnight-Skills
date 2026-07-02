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
    <Container className="safe-bottom py-8 sm:py-12">
      <PageHeader
        title="Learning Paths"
        description="Curated sequences and skill levels — from privacy basics to production dApps."
      />

      <section className="mt-10">
        <h2 className="text-xl font-bold">Curated journeys</h2>
        <div className="mt-6 grid gap-6">
          {collections.map((c) => (
            <article key={c.id} id={c.id} className="surface scroll-mt-20 p-6">
              <h3 className="text-lg font-semibold">{c.name}</h3>
              <ol className="mt-4 space-y-3">
                {c.skills.map((step, i) => (
                  <li key={step.skillId} className="flex gap-3 text-sm">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-xs font-bold text-[var(--foreground)]">
                      {i + 1}
                    </span>
                    <div>
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

      <section className="mt-14">
        <h2 className="text-xl font-bold">Skill levels</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {levels.map((level) => {
            const diff = DIFFICULTY_CONFIG[level.id] ?? DIFFICULTY_CONFIG.intermediate;
            return (
              <div key={level.id} className="surface p-5">
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
