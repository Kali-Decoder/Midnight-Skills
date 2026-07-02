"use client";

import { useState } from "react";
import Link from "next/link";
import { type SkillProfile } from "@/lib/skill-types";
import { DIFFICULTY_CONFIG } from "@/lib/constants";
import { Download, FolderOpen, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { downloadSkillZip } from "@/lib/download";
import { CopyCommand } from "@/components/shared/copy-command";
import { SkillsCliInstall } from "@/components/shared/skills-cli-install";
import { SecurityBadge } from "@/components/skills/security-badge";

export function SkillCard({ profile }: { profile: SkillProfile }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleDownload() {
    toast.info(`Downloading ${profile.slug}.zip...`);
    await downloadSkillZip(profile.slug, profile.skillMd, profile.readmeMd);
    toast.success("Download started");
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(profile.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const diffConfig = DIFFICULTY_CONFIG[profile.meta.difficulty] || DIFFICULTY_CONFIG.intermediate;

  return (
    <div className="group surface surface-hover flex h-full flex-col">
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <Link href={`/browse/${profile.slug}`} className="flex items-center gap-3 group/link">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[color:var(--brand-border)] bg-white/60 text-[var(--foreground)]">
            <FolderOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-[var(--foreground)] transition-colors group-hover/link:text-[var(--foreground)] sm:text-[0.95rem]">
              {profile.meta.name}
            </h3>
            <p className="text-[11px] text-[var(--muted-foreground)]">{profile.slug}/</p>
          </div>
        </Link>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <span className="rounded-md bg-[color:var(--brand-soft)] px-2 py-[2px] text-[10px] font-medium text-[var(--foreground)]">
            {profile.meta.category}
          </span>
          <span className={`rounded-md px-2 py-[2px] text-[10px] font-medium ${diffConfig.bg} ${diffConfig.text}`}>
            {diffConfig.label}
          </span>
          <SecurityBadge allowedTools={profile.meta.allowedTools} />
          {profile.meta.templatePath && (
            <span className="rounded-md border border-[color:var(--brand-border)] bg-white/55 px-2 py-[2px] text-[10px] font-medium text-[var(--foreground)]">
              Runnable
            </span>
          )}
          {profile.meta.version && (
            <span className="rounded-md border border-[color:var(--brand-border)] bg-white/55 px-2 py-[2px] text-[10px] font-medium text-[var(--muted-foreground)]">
              v{profile.meta.version}
            </span>
          )}
        </div>

        {profile.meta.description && (
          <p className="mt-3 line-clamp-2 text-[0.85rem] leading-[1.7] text-[var(--muted-foreground)]">
            {profile.meta.description}
          </p>
        )}

        <div className="mt-auto pt-3">
          {profile.meta.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {profile.meta.skills.slice(0, 4).map((skill) => (
                <span
                  key={skill}
                  title={skill}
                  className="max-w-[7rem] truncate rounded-md border border-[color:var(--brand-border)] bg-white/55 px-2 py-[3px] text-[10px] font-medium text-[var(--muted-foreground)] sm:max-w-[8rem] sm:text-[11px]"
                >
                  {skill}
                </span>
              ))}
              {profile.meta.skills.length > 4 && (
                <span className="rounded-md border border-[color:var(--brand-border)] bg-white/55 px-2 py-[3px] text-[10px] text-[var(--muted-foreground)] sm:text-[11px]">
                  +{profile.meta.skills.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-t border-[color:var(--brand-border)] px-4 py-2 sm:flex-nowrap sm:px-5">
        <div className="flex flex-1 flex-wrap gap-1">
          <button
            onClick={() => void handleCopy()}
            className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-[var(--muted-foreground)] transition-all hover:bg-[color:var(--brand-soft)] hover:text-[var(--foreground)]"
            title="Copy instructions to clipboard"
            type="button"
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
            onClick={() => void handleDownload()}
            className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-[var(--muted-foreground)] transition-all hover:bg-[color:var(--brand-soft)] hover:text-[var(--foreground)]"
            title="Download skill folder"
            type="button"
          >
            <Download className="h-3 w-3" />
            <span>Download</span>
          </button>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
          type="button"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          <span>{expanded ? "Hide" : "Preview"}</span>
        </button>
      </div>

      {expanded && (
        <div className="border-t border-[color:var(--brand-border)] p-4 sm:p-5">
          <div className="max-h-80 overflow-auto rounded-xl border border-[color:var(--brand-border)] bg-white/55 p-4 backdrop-blur sm:p-5">
            <div className="prose-content">
              <Markdown remarkPlugins={[remarkGfm]}>{profile.body}</Markdown>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            <SkillsCliInstall
              label="Install all skills"
              showHint={false}
            />
            <div>
              <p className="mb-1.5 text-[11px] font-semibold text-[var(--muted-foreground)]">This skill only</p>
              <CopyCommand command={`cp -r ${profile.folderName}/ .cursor/skills/`} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
