"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { TemplateCard } from "@/components/templates/template-card";
import type { TemplateProfile } from "@/lib/template-types";
import { Container } from "@/components/layout/container";

export function TemplatesPageContent({ templates }: { templates: TemplateProfile[] }) {
  return (
    <div className="relative">
      <Container className="py-10 sm:py-16">
        <PageHeader
          title="Runnable Templates"
          description="Full-stack dApp starters — copy, compile, and run with 1AM wallet on Preprod."
        />

        <p className="mt-2 text-xs text-[var(--muted-foreground)] sm:text-sm">
          {templates.length} {templates.length === 1 ? "template" : "templates"} available
        </p>

        <div className="mt-6 grid items-stretch gap-4 sm:mt-8 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard key={template.slug} template={template} />
          ))}
        </div>

        {templates.length === 0 && (
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
            href="/browse"
            className="inline-flex h-10 items-center justify-center rounded-full border border-[color:var(--brand-border)] bg-white/60 px-5 text-sm font-medium text-[var(--foreground)]/80 transition-all hover:bg-white/75"
          >
            Browse live skills
          </Link>
        </div>

        <div className="h-10" />
      </Container>
    </div>
  );
}
