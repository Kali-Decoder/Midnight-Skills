"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme, mounted } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      onClick={toggleTheme}
      className={cn(
        "theme-toggle relative z-[60] inline-flex h-8 w-[3.25rem] shrink-0 cursor-pointer items-center rounded-full border border-[color:var(--brand-border)] bg-[var(--surface-muted)] p-0.5 transition-colors hover:bg-[var(--surface-strong)]",
        className,
      )}
      aria-label={mounted ? `Switch to ${isDark ? "light" : "dark"} mode` : "Toggle theme"}
      title={mounted ? `Switch to ${isDark ? "light" : "dark"} mode` : "Toggle theme"}
    >
      <Sun
        className={cn(
          "pointer-events-none absolute left-1.5 z-10 h-3.5 w-3.5 transition-colors",
          isDark ? "text-[var(--muted-foreground)]" : "text-[var(--foreground)]",
        )}
        aria-hidden
      />
      <Moon
        className={cn(
          "pointer-events-none absolute right-1.5 z-10 h-3.5 w-3.5 transition-colors",
          isDark ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]",
        )}
        aria-hidden
      />
      <span
        className={cn(
          "theme-toggle-thumb pointer-events-none absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-[var(--background)] shadow-sm ring-1 ring-[color:var(--brand-border)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          isDark && "translate-x-[1.35rem]",
        )}
        aria-hidden
      />
    </button>
  );
}
