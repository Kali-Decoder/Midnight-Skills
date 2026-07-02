"use client";

import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { TemplateProfile } from "@/lib/template-types";
import { DIFFICULTY_CONFIG } from "@/lib/constants";
import { CopyCommand } from "@/components/shared/copy-command";
import { Download, ChevronLeft, FileText } from "lucide-react";
import { toast } from "sonner";
import { downloadMarkdown } from "@/lib/download";
import { Container } from "@/components/layout/container";

export function TemplateDetailContent({ template }: { template: TemplateProfile }) {
  const diffConfig = DIFFICULTY_CONFIG[template.difficulty] || DIFFICULTY_CONFIG.intermediate;

  function handleDownload() {
    toast.info(`Downloading ${template.slug}-README.md...`);
    downloadMarkdown(`${template.slug}-README.md`, template.readme || template.description);
    toast.success("Download started");
  }

  return (
    <div className="relative">
      <Container className="py-8 sm:py-12">
        <Link
          href="/templates"
          className="mb-6 inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] sm:text-sm"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Templates
        </Link>

        <div className="detail-layout">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-[-0.02em] text-[var(--foreground)] sm:text-3xl">
              {template.name}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-[color:var(--brand-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--foreground)]">
                {template.category}
              </span>
              <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${diffConfig.bg} ${diffConfig.text}`}>
                {diffConfig.label}
              </span>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-[var(--muted-foreground)] sm:text-base">
              {template.description}
            </p>

            <p className="mt-4">
              <Link href={`/browse/${template.skillSlug}`} className="text-sm font-medium text-[var(--foreground)] hover:underline">
                View skill docs →
              </Link>
            </p>

            {template.readme && (
              <div className="mt-8 overflow-hidden rounded-2xl border border-[color:var(--brand-border)] bg-white/60 shadow-sm backdrop-blur">
                <div className="flex items-center gap-2 border-b border-[color:var(--brand-border)] bg-white/60 px-4 py-2.5">
                  <FileText className="h-4 w-4 text-[var(--foreground)]" />
                  <span className="text-sm font-medium text-[var(--foreground)]">README.md</span>
                  <span className="ml-auto hidden text-[10px] text-[var(--muted-foreground)] sm:inline">
                    Template Instructions
                  </span>
                </div>
                <div className="p-5 sm:p-6">
                  <div className="prose-content">
                    <Markdown remarkPlugins={[remarkGfm]}>{template.readme}</Markdown>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="detail-sidebar">
            <div className="detail-sidebar-inner">
              <button
                onClick={handleDownload}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] text-sm font-semibold text-[var(--primary-foreground)] transition-all hover:bg-[color-mix(in_oklab,var(--primary),white_15%)] hover:shadow-lg"
              >
                <Download className="h-4 w-4" />
                Download README
              </button>

              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Quick start
                </p>
                <div className="space-y-2">
                  <CopyCommand command={`cd ${template.path}`} />
                  <CopyCommand command="npm install && npm run compact && npm run dev" />
                </div>
              </div>

              <div className="surface p-4">
                <dl className="space-y-3 text-sm">
                  <div className="meta-row">
                    <dt>Category</dt>
                    <dd>{template.category}</dd>
                  </div>
                  <div className="meta-row">
                    <dt>Difficulty</dt>
                    <dd className={diffConfig.text}>{diffConfig.label}</dd>
                  </div>
                  <div className="meta-row">
                    <dt>Skill</dt>
                    <dd>
                      <Link href={`/browse/${template.skillSlug}`} className="hover:underline">
                        {template.skillSlug}
                      </Link>
                    </dd>
                  </div>
                </dl>

                {template.tags.length > 0 && (
                  <div className="mt-4 border-t border-[color:var(--brand-border)] pt-4">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                      Stack
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {template.tags.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-md border border-[color:var(--brand-border)] bg-white/55 px-2 py-[3px] text-[11px] font-medium text-[var(--muted-foreground)]"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="surface p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Files Included
                </p>
                <div className="max-h-48 space-y-2 overflow-auto">
                  {template.files.map((file) => (
                    <div key={file} className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--foreground)]" />
                      <span className="truncate font-mono text-xs">{file}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="h-10" />
      </Container>
    </div>
  );
}
