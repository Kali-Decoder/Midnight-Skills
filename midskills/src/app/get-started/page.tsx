import Link from "next/link";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/shared/page-header";
import { CopyCommand } from "@/components/shared/copy-command";
import { SkillsCliInstall } from "@/components/shared/skills-cli-install";
import { SupportedToolsGrid } from "@/components/shared/supported-tools-showcase";
import { SKILLS_CLI_INSTALL_COMMAND } from "@/lib/constants";

const STEPS = [
  {
    title: "Install all skills (recommended)",
    body: "Add the full MIDSKILLS package to your agent in one command. Works with Cursor, Claude Code, Copilot, and other skills-compatible tools.",
    command: SKILLS_CLI_INSTALL_COMMAND,
  },
  {
    title: "Clone the repo",
    body: "Get the full midnight-skills repository with all skill folders and templates.",
    command: "git clone https://github.com/Kali-Decoder/Midnight-skills.git",
  },
  {
    title: "Install a single skill for Cursor",
    body: "Copy one skill folder into your project's .cursor/skills directory.",
    command: "cp -r midnight-skills/compact .cursor/skills/",
  },
  {
    title: "Install for Claude Code",
    body: "Symlink or copy into .claude/skills — the agent reads SKILL.md frontmatter for routing.",
    command: "cp -r midnight-skills/example-locker-dapp .claude/skills/",
  },
  {
    title: "Point your agent",
    body: "Add AGENTS.md or CLAUDE.md from the repo root so the agent picks the right skill per task.",
    command: "cp midnight-skills/AGENTS.md ./AGENTS.md",
  },
];

export default function GetStartedPage() {
  return (
    <Container className="safe-bottom py-8 sm:py-12">
      <PageHeader
        title="Get Started"
        description="Install Midnight skills in your AI coding environment and start building privacy-preserving dApps."
      />

      <div className="surface mt-8 p-5 sm:p-6">
        <SkillsCliInstall
          label="Quick install"
          hint="Run from your project root. This is the fastest way to use all skills with your agent."
        />
      </div>

      <div className="tools-showcase-dark mt-8 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] p-5 sm:p-6">
        <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-widest text-white/45">
          Compatible tools
        </p>
        <SupportedToolsGrid iconSize={30} />
      </div>

      <div className="mt-10 space-y-8">
        {STEPS.map((step, i) => (
          <div key={step.title} className="surface p-6">
            <p className="text-xs font-semibold text-[var(--foreground)]">Step {i + 1}</p>
            <h2 className="mt-1 text-lg font-semibold">{step.title}</h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">{step.body}</p>
            <div className="mt-4">
              <CopyCommand command={step.command} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <Link href="/browse" className="text-sm font-medium text-[var(--foreground)] hover:underline">
          Browse all skills →
        </Link>
      </div>
    </Container>
  );
}
