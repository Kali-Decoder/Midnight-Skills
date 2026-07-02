"use client";

import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { type SkillProfile } from "@/lib/skill-types";
import { DIFFICULTY_CONFIG } from "@/lib/constants";
import { CopyCommand } from "@/components/shared/copy-command";
import { SkillsCliInstall } from "@/components/shared/skills-cli-install";
import { Download, ChevronLeft, FileText } from "lucide-react";
import { toast } from "sonner";
import { downloadSkillZip } from "@/lib/download";
import { Container } from "@/components/layout/container";

export function SkillDetailContent({ profile }: { profile: SkillProfile }) {
  const diffConfig = DIFFICULTY_CONFIG[profile.meta.difficulty] || DIFFICULTY_CONFIG.intermediate;

  async function handleDownload() {
    toast.info(`Downloading ${profile.slug}.zip...`);
    await downloadSkillZip(profile.slug, profile.skillMd, profile.readmeMd);
    toast.success("Download started");
  }

  return (
    <div className="relative">
      <Container className="py-8 sm:py-12">
        <Link
          href="/browse"
          className="mb-6 inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] sm:text-sm"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Browse
        </Link>

        <div className="detail-layout">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-[-0.02em] text-[var(--foreground)] sm:text-3xl">
              {profile.meta.name}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-[color:var(--brand-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--foreground)]">
                {profile.meta.category}
              </span>
              <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${diffConfig.bg} ${diffConfig.text}`}>
                {diffConfig.label}
              </span>
              <span className="rounded-md bg-white/60 px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)]">
                v{profile.meta.version}
              </span>
              {profile.meta.templatePath && (
                <Link
                  href={`/templates/${profile.meta.templatePath.split("/").pop()}`}
                  className="rounded-md border border-[color:var(--brand-border)] bg-white/55 px-2.5 py-1 text-xs font-medium text-[var(--foreground)] hover:underline"
                >
                  Runnable template →
                </Link>
              )}
            </div>

            {profile.meta.taskHint && (
              <p className="mt-3 text-xs font-medium text-[var(--muted-foreground)]">
                When to use: {profile.meta.taskHint}
              </p>
            )}

            <p className="mt-4 text-sm leading-relaxed text-[var(--muted-foreground)] sm:text-base">
              {profile.meta.description}
            </p>

            {profile.readmeMd && (
              <div className="mt-8 overflow-hidden rounded-2xl border border-[color:var(--brand-border)] bg-white/60 shadow-sm backdrop-blur">
                <div className="flex items-center gap-2 border-b border-[color:var(--brand-border)] bg-white/60 px-4 py-2.5">
                  <FileText className="h-4 w-4 text-[var(--muted-foreground)]" />
                  <span className="text-sm font-medium text-[var(--foreground)]">README.md</span>
                </div>
                <div className="p-5 sm:p-6">
                  <div className="prose-content">
                    <Markdown remarkPlugins={[remarkGfm]}>{profile.readmeMd}</Markdown>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 overflow-hidden rounded-2xl border border-[color:var(--brand-border)] bg-white/60 shadow-sm backdrop-blur">
              <div className="flex items-center gap-2 border-b border-[color:var(--brand-border)] bg-white/60 px-4 py-2.5">
                <FileText className="h-4 w-4 text-[var(--foreground)]" />
                <span className="text-sm font-medium text-[var(--foreground)]">SKILL.md</span>
                <span className="ml-auto hidden text-[10px] text-[var(--muted-foreground)] sm:inline">
                  Agent Instructions
                </span>
              </div>
              <div className="p-5 sm:p-6">
                <div className="prose-content">
                  <Markdown remarkPlugins={[remarkGfm]}>{profile.body}</Markdown>
                </div>
              </div>
            </div>
          </div>

          <div className="detail-sidebar">
            <div className="detail-sidebar-inner">
              <button
                onClick={() => void handleDownload()}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] text-sm font-semibold text-[var(--primary-foreground)] transition-all hover:bg-[color-mix(in_oklab,var(--primary),white_15%)] hover:shadow-lg"
              >
                <Download className="h-4 w-4" />
                Download Skill
              </button>

              <div>
                <SkillsCliInstall
                  label="Install all skills"
                  hint="Adds every Midnight skill to your agent. Or copy a single folder below."
                  className="mb-4"
                />
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  This skill only
                </p>
                <CopyCommand command={`cp -r ${profile.folderName}/ .cursor/skills/`} />
              </div>

              <div className="surface p-4">
                <dl className="space-y-3 text-sm">
                  {profile.meta.author && (
                    <div className="meta-row">
                      <dt className="text-[var(--muted-foreground)]">Author</dt>
                      <dd>{profile.meta.author}</dd>
                    </div>
                  )}
                  <div className="meta-row">
                    <dt>Category</dt>
                    <dd>{profile.meta.category}</dd>
                  </div>
                  <div className="meta-row">
                    <dt>Difficulty</dt>
                    <dd className={diffConfig.text}>{diffConfig.label}</dd>
                  </div>
                  <div className="meta-row">
                    <dt>Version</dt>
                    <dd>{profile.meta.version}</dd>
                  </div>
                </dl>

                {profile.meta.skills.length > 0 && (
                  <div className="mt-4 border-t border-[color:var(--brand-border)] pt-4">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                      Tags
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.meta.skills.map((skill) => (
                        <span
                          key={skill}
                          title={skill}
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
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                    <FileText className="h-3.5 w-3.5 text-[var(--foreground)]" />
                    SKILL.md
                  </div>
                  {profile.readmeMd && (
                    <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                      <FileText className="h-3.5 w-3.5 text-[var(--foreground)]" />
                      README.md
                    </div>
                  )}
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
