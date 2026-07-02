"use client";

import { useState } from "react";
import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { type KnowledgeArticle } from "@/lib/knowledge-types";
import { CopyCommand } from "@/components/shared/copy-command";
import { ChevronLeft, Download, Link2, Check, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { downloadMarkdown } from "@/lib/download";
import { Container } from "@/components/layout/container";

export function KbDetailContent({ article }: { article: KnowledgeArticle }) {
  const [urlCopied, setUrlCopied] = useState(false);

  const rawUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/knowledge/${article.slug}/raw`
      : `/knowledge/${article.slug}/raw`;

  async function handleCopyUrl() {
    await navigator.clipboard.writeText(rawUrl);
    setUrlCopied(true);
    toast.success("Agent URL copied to clipboard");
    setTimeout(() => setUrlCopied(false), 2000);
  }

  function handleDownload() {
    toast.info(`Downloading ${article.slug}.md...`);
    downloadMarkdown(`${article.slug}.md`, article.kbMd);
    toast.success("Download started");
  }

  return (
    <div className="relative">
      <Container className="py-8 sm:py-12">
        <Link
          href="/knowledge"
          className="mb-6 inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] sm:text-sm"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Knowledge Base
        </Link>

        <div className="detail-layout">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2.5">
              <span className="rounded-md bg-[color:var(--brand-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--foreground)]">
                {article.meta.category}
              </span>
              <span className="rounded-md bg-white/60 px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)]">
                v{article.meta.version}
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-[-0.02em] text-[var(--foreground)] sm:text-3xl">
              {article.title}
            </h1>

            <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)] sm:text-base">
              {article.description}
            </p>

            <div className="mt-8 overflow-hidden rounded-2xl border border-[color:var(--brand-border)] bg-white/60 shadow-sm backdrop-blur">
              <div className="flex items-center gap-2 border-b border-[color:var(--brand-border)] bg-white/60 px-4 py-2.5">
                <BookOpen className="h-4 w-4 text-[var(--foreground)]" />
                <span className="text-sm font-medium text-[var(--foreground)]">{article.slug}.md</span>
              </div>
              <div className="p-5 sm:p-6">
                <div className="prose-content">
                  <Markdown remarkPlugins={[remarkGfm]}>{article.body}</Markdown>
                </div>
              </div>
            </div>
          </div>

          <div className="detail-sidebar">
            <div className="detail-sidebar-inner">
              <div className="surface p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground)]/70">
                  Agent Fetch URL
                </p>
                <p className="mb-3 text-xs text-[var(--muted-foreground)]">
                  Point your AI agent to this URL to give it this knowledge instantly.
                </p>
                <button
                  onClick={() => void handleCopyUrl()}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-all hover:bg-[color-mix(in_oklab,var(--primary),white_15%)] hover:shadow-md"
                  type="button"
                >
                  {urlCopied ? (
                    <>
                      <Check className="h-4 w-4" /> Copied
                    </>
                  ) : (
                    <>
                      <Link2 className="h-4 w-4" /> Copy Agent URL
                    </>
                  )}
                </button>
              </div>

              <button
                onClick={handleDownload}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[color:var(--brand-border)] bg-white/60 text-sm font-semibold text-[var(--foreground)]/80 transition-all hover:bg-white/75 hover:text-[var(--foreground)]"
                type="button"
              >
                <Download className="h-4 w-4" />
                Download {article.slug}.md
              </button>

              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Add to project
                </p>
                <CopyCommand command={`curl -o ${article.slug}.md ${rawUrl}`} />
              </div>

              <div className="surface p-4">
                <dl className="space-y-3 text-sm">
                  {article.meta.author && (
                    <div className="meta-row">
                      <dt>Author</dt>
                      <dd>{article.meta.author}</dd>
                    </div>
                  )}
                  <div className="meta-row">
                    <dt>Category</dt>
                    <dd>{article.meta.category}</dd>
                  </div>
                  <div className="meta-row">
                    <dt>Version</dt>
                    <dd>{article.meta.version}</dd>
                  </div>
                </dl>

                {article.meta.tags.length > 0 && (
                  <div className="mt-4 border-t border-[color:var(--brand-border)] pt-4">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                      Tags
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {article.meta.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-white/60 px-2 py-[3px] text-[11px] font-medium text-[var(--muted-foreground)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="surface p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  File
                </p>
                <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                  <BookOpen className="h-3.5 w-3.5 text-[var(--foreground)]" />
                  {article.path}
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
