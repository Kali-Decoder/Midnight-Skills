"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="group flex items-start gap-2 rounded-lg border border-[color:var(--brand-border)] bg-[color:var(--brand-soft)]/50 px-3 py-2">
      <code className="min-w-0 flex-1 break-all font-mono text-xs leading-relaxed text-[var(--muted-foreground)] sm:text-[0.8rem]">
        {command}
      </code>
      <button
        onClick={handleCopy}
        className="mt-0.5 shrink-0 text-[var(--muted-foreground)]/60 transition-colors hover:text-[var(--foreground)]"
        title="Copy to clipboard"
        type="button"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
