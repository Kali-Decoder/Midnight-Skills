export const CATEGORIES = [
  "All",
  "Foundation",
  "Wallet",
  "SDK",
  "Domain",
  "Full-Fledged Templates",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<string, string> = {
  foundation: "Foundation",
  wallet: "Wallet",
  sdk: "SDK",
  domain: "Domain",
  template: "Templates",
  "full-template": "Full-Fledged Templates",
  meta: "Meta",
};

export const DIFFICULTY_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type Difficulty = (typeof DIFFICULTY_LEVELS)[number];

export const DIFFICULTY_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  beginner: { label: "Beginner", bg: "bg-emerald-50", text: "text-emerald-600" },
  intermediate: { label: "Intermediate", bg: "bg-[color:var(--brand-soft)]", text: "text-[var(--foreground)]" },
  advanced: { label: "Advanced", bg: "bg-red-50", text: "text-red-600" },
};

export const SUPPORTED_TOOLS = [
  "Cursor",
  "Claude Code",
  "Codex",
  "Gemini",
  "Windsurf",
  "GitHub Copilot",
  "Kiro",
  "OpenCode",
  "1AM Wallet",
] as const;

export type SupportedToolName = (typeof SUPPORTED_TOOLS)[number];

export interface SupportedAiTool {
  id: string;
  name: SupportedToolName;
  logo: string;
}

/** AI tools & agents compatible with MIDSKILLS — logo paths are under /public/logos */
export const SUPPORTED_AI_TOOLS: SupportedAiTool[] = [
  { id: "cursor", name: "Cursor", logo: "/logos/cursor.png" },
  { id: "claude", name: "Claude Code", logo: "/logos/claude.png" },
  { id: "codex", name: "Codex", logo: "/logos/openai.png" },
  { id: "gemini", name: "Gemini", logo: "/logos/gemini.png" },
  { id: "windsurf", name: "Windsurf", logo: "/logos/windsurf.svg" },
  { id: "copilot", name: "GitHub Copilot", logo: "/logos/github.png" },
  { id: "kiro", name: "Kiro", logo: "/logos/kiro.png" },
  { id: "opencode", name: "OpenCode", logo: "/logos/opencode.png" },
  { id: "1am-wallet", name: "1AM Wallet", logo: "/logos/1am-wallet.svg" },
];

/** One-command install for the full skills package (Cursor, Claude Code, etc.) */
export const SKILLS_CLI_INSTALL_COMMAND = "npx skills add Kali-Decoder/Midnight-skills";
