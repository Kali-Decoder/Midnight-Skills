"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { TemplateCard } from "@/components/templates/template-card";
import type { TemplateListItem } from "@/lib/template-types";
import { Container } from "@/components/layout/container";

export function TemplatesPageContent() {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then(setTemplates)
      .finally(() => setLoading(false));
  }, []);

  const runnable = templates.filter((t) => t.runnable);
  const skillGuides = templates.filter((t) => !t.runnable);

  return (
    <div className="relative">
      <Container className="py-10 sm:py-16">
        <PageHeader
          title="Full-Fledged Templates"
          description="Runnable dApp repos and complete template skills — copy, compile, and ship privacy-preserving apps on Midnight."
        />

        {!loading && (
          <p className="mt-2 text-xs text-[var(--muted-foreground)] sm:text-sm">
            {templates.length} {templates.length === 1 ? "template" : "templates"} available
            {runnable.length > 0 && skillGuides.length > 0 && (
              <span>
                {" "}
                · {runnable.length} runnable {runnable.length === 1 ? "repo" : "repos"} ·{" "}
                {skillGuides.length} skill {skillGuides.length === 1 ? "guide" : "guides"}
              </span>
            )}
          </p>
        )}

        {loading && (
          <p className="mt-6 text-sm text-[var(--muted-foreground)]">Loading templates…</p>
        )}

        {!loading && runnable.length > 0 && (
          <section className="mt-8 sm:mt-10">
            <h2 className="text-sm font-semibold text-[var(--foreground)] sm:text-base">
              Runnable repos
            </h2>
            <p className="mt-1 text-xs text-[var(--muted-foreground)] sm:text-sm">
              Clone, install dependencies, compile Compact, and run locally with 1AM wallet.
            </p>
            <div className="mt-4 grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
              {runnable.map((template) => (
                <TemplateCard key={template.slug} template={template} />
              ))}
            </div>
          </section>
        )}

        {!loading && skillGuides.length > 0 && (
          <section className={runnable.length > 0 ? "mt-10 sm:mt-12" : "mt-8 sm:mt-10"}>
            <h2 className="text-sm font-semibold text-[var(--foreground)] sm:text-base">
              Template skills
            </h2>
            <p className="mt-1 text-xs text-[var(--muted-foreground)] sm:text-sm">
              End-to-end dApp guides — load the skill into your agent and follow the full build
              workflow.
            </p>
            <div className="mt-4 grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
              {skillGuides.map((template) => (
                <TemplateCard key={template.slug} template={template} />
              ))}
            </div>
          </section>
        )}

        {!loading && templates.length === 0 && (
          <p className="mt-12 text-center text-sm text-[var(--muted-foreground)]">No templates yet.</p>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row">
          <Link
            href="/contribute"
            className="inline-flex h-10 items-center justify-center rounded-full bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-foreground)] transition-all hover:bg-[color-mix(in_oklab,var(--primary),white_15%)] hover:shadow-md"
          >
            Read contributor guide
          </Link>
          <Link
            href="/browse?category=Full-Fledged+Templates"
            className="inline-flex h-10 items-center justify-center rounded-full border border-[color:var(--brand-border)] bg-white/60 px-5 text-sm font-medium text-[var(--foreground)]/80 transition-all hover:bg-white/75"
          >
            Browse all template skills
          </Link>
        </div>

        <div className="h-10" />
      </Container>
    </div>
  );
}
