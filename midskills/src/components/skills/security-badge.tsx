import { ShieldCheck, Terminal, Shield } from "lucide-react";

export function SecurityBadge({ allowedTools }: { allowedTools: string[] }) {
  if (allowedTools.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--brand-border)] bg-white/55 px-2 py-[2px] text-[10px] font-medium text-[var(--muted-foreground)]">
        <Shield className="h-2.5 w-2.5" />
        Reviewed
      </span>
    );
  }

  const usesBash = allowedTools.some((t) => t.toLowerCase() === "bash");

  if (usesBash) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--brand-border)] bg-[color:var(--brand-soft)] px-2 py-[2px] text-[10px] font-medium text-[var(--foreground)]">
        <Terminal className="h-2.5 w-2.5" />
        Uses CLI
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--brand-border)] bg-white/55 px-2 py-[2px] text-[10px] font-medium text-[var(--foreground)]">
      <ShieldCheck className="h-2.5 w-2.5" />
      Safe
    </span>
  );
}
