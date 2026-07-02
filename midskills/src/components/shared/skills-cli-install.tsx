import { SKILLS_CLI_INSTALL_COMMAND } from "@/lib/constants";
import { CopyCommand } from "@/components/shared/copy-command";
import { cn } from "@/lib/utils";

export function SkillsCliInstall({
  className,
  label = "Install all skills",
  hint = "Works with Cursor, Claude Code, Codex, Gemini, Windsurf, GitHub Copilot, and other skills-compatible tools.",
  showHint = true,
}: {
  className?: string;
  label?: string;
  hint?: string;
  showHint?: boolean;
}) {
  return (
    <div className={cn(className)}>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
        {label}
      </p>
      <CopyCommand command={SKILLS_CLI_INSTALL_COMMAND} />
      {showHint && (
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted-foreground)] sm:text-xs">{hint}</p>
      )}
    </div>
  );
}
