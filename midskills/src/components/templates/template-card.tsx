"use client";

import { useState } from "react";
import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Copy,
  Check,
  Download,
  ChevronDown,
  ChevronUp,
  FileCode2,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import type { TemplateProfile } from "@/lib/template-types";
import { DIFFICULTY_CONFIG } from "@/lib/constants";
import { downloadMarkdown } from "@/lib/download";
import { CopyCommand } from "@/components/shared/copy-command";

const VISIBLE_FILES = 3;
const VISIBLE_STACK = 4;

export function TemplateCard({ template }: { template: TemplateProfile }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const diffConfig = DIFFICULTY_CONFIG[template.difficulty] || DIFFICULTY_CONFIG.intermediate;
  const visibleFiles = template.files.slice(0, VISIBLE_FILES);
  const hiddenFileCount = template.files.length - visibleFiles.length;
  const visibleStack = template.tags.slice(0, VISIBLE_STACK);
  const hiddenStackCount = template.tags.length - visibleStack.length;

  function handleDownload() {
    toast.info(`Downloading ${template.slug}-README.md...`);
    downloadMarkdown(`${template.slug}-README.md`, template.readme || template.description);
    toast.success("Download started");
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(template.readme || template.description);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <article className="group surface surface-hover flex h-full flex-col overflow-hidden">
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <Link href={`/templates/${template.slug}`} className="flex items-start gap-3 group/link">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:var(--brand-border)] bg-white/60 text-[var(--foreground)]">
            <Layers className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold leading-snug text-[var(--foreground)] transition-colors sm:text-[0.95rem]">
              {template.name}
            </h3>
            <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--muted-foreground)]">
              {template.slug}/
            </p>
          </div>
          <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted-foreground)]/40 transition-colors group-hover/link:text-[var(--foreground)]/70" />
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="rounded-md bg-[color:var(--brand-soft)] px-2 py-[2px] text-[10px] font-medium text-[var(--foreground)]">
            {template.category}
          </span>
          <span className={`rounded-md px-2 py-[2px] text-[10px] font-medium ${diffConfig.bg} ${diffConfig.text}`}>
            {diffConfig.label}
          </span>
          <span className="rounded-md border border-[color:var(--brand-border)] bg-white/55 px-2 py-[2px] text-[10px] font-medium text-[var(--muted-foreground)]">
            {template.files.length} {template.files.length === 1 ? "file" : "files"}
          </span>
        </div>

        {template.description && (
          <p className="mt-3 line-clamp-3 text-[0.85rem] leading-[1.7] text-[var(--muted-foreground)]">
            {template.description}
          </p>
        )}

        {template.tags.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Stack</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {visibleStack.map((skill) => (
                <span
                  key={skill}
                  className="rounded-md border border-[color:var(--brand-border)] bg-white/55 px-2 py-[3px] text-[10px] font-medium text-[var(--muted-foreground)] sm:text-[11px]"
                >
                  {skill}
                </span>
              ))}
              {hiddenStackCount > 0 && (
                <span className="rounded-md border border-[color:var(--brand-border)] bg-white/55 px-2 py-[3px] text-[10px] text-[var(--muted-foreground)] sm:text-[11px]">
                  +{hiddenStackCount}
                </span>
              )}
            </div>
          </div>
        )}

        {template.files.length > 0 && (
          <div className="mt-auto pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Key files
            </p>
            <ul className="mt-1.5 space-y-1">
              {visibleFiles.map((file) => (
                <li key={file} className="flex min-w-0 items-center gap-2 text-[11px] text-[var(--muted-foreground)]">
                  <FileCode2 className="h-3 w-3 shrink-0 text-[var(--foreground)]" />
                  <span className="truncate font-mono">{file}</span>
                </li>
              ))}
              {hiddenFileCount > 0 && (
                <li className="pl-5 text-[10px] text-[var(--muted-foreground)]">
                  +{hiddenFileCount} more in template
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1 border-t border-[color:var(--brand-border)] px-4 py-2 sm:flex-nowrap sm:px-5">
        <div className="flex flex-1 flex-wrap gap-1">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-[var(--muted-foreground)] transition-all hover:bg-[color:var(--brand-soft)] hover:text-[var(--foreground)]"
            title="Copy template readme"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                <span className="text-emerald-600">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-[var(--muted-foreground)] transition-all hover:bg-[color:var(--brand-soft)] hover:text-[var(--foreground)]"
            title="Download template readme"
          >
            <Download className="h-3 w-3" />
            <span>Download</span>
          </button>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          <span>{expanded ? "Hide" : "Preview"}</span>
        </button>
      </div>

      {expanded && template.readme && (
        <div className="border-t border-[color:var(--brand-border)] p-4 sm:p-5">
          <div className="max-h-80 overflow-auto rounded-xl border border-[color:var(--brand-border)] bg-white/55 p-4 backdrop-blur sm:p-5">
            <div className="prose-content">
              <Markdown remarkPlugins={[remarkGfm]}>{template.readme.slice(0, 3000)}</Markdown>
            </div>
          </div>
          <div className="mt-3">
            <p className="mb-1.5 text-[11px] font-semibold text-[var(--muted-foreground)]">Quick start</p>
            <CopyCommand command={`cd ${template.path} && npm install && npm run compact && npm run dev`} />
          </div>
          <Link
            href={`/templates/${template.slug}`}
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--foreground)] transition-colors hover:text-[var(--foreground)]/80"
          >
            View full template
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </article>
  );
}
