import { cn } from "@/lib/utils";
import { DIFFICULTY_CONFIG } from "@/lib/constants";

export function isNavLinkActive(pathname: string, href: string): boolean {
  if (href === "/browse") return pathname === "/browse" || pathname.startsWith("/browse/");
  if (href === "/templates") return pathname === "/templates" || pathname.startsWith("/templates/");
  if (href === "/contribute") return pathname === "/contribute" || pathname === "/guide";
  if (href === "/knowledge") return pathname === "/knowledge" || pathname.startsWith("/knowledge/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Navbar links — solid fill when active */
export function navTabClass(active: boolean) {
  return cn(
    "rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200",
    active
      ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
      : "text-[var(--muted-foreground)] hover:bg-[var(--brand-soft)] hover:text-[var(--foreground)]",
  );
}

/** Primary filter row (categories) — solid black pill */
export function categoryPillClass(active: boolean) {
  return cn(
    "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all duration-200 sm:text-xs",
    active
      ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-md ring-2 ring-[var(--primary)]/15"
      : "border border-[var(--brand-border)] bg-white/60 text-[var(--muted-foreground)] hover:border-[color-mix(in_oklab,var(--foreground),white_75%)] hover:bg-[var(--brand-soft)] hover:text-[var(--foreground)]",
  );
}

/** Difficulty filter — colored pills per level */
export function difficultyPillClass(level: string, active: boolean) {
  const config = DIFFICULTY_CONFIG[level] ?? DIFFICULTY_CONFIG.intermediate;
  return cn(
    "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all duration-200 sm:text-xs",
    active
      ? cn(config.bg, config.text, "shadow-sm ring-2 ring-current/20")
      : cn(
          "border bg-white/60 opacity-80 hover:opacity-100",
          config.text,
          level === "beginner" && "border-emerald-200 hover:bg-emerald-50",
          level === "intermediate" && "border-[var(--brand-border)] hover:bg-[var(--brand-soft)]",
          level === "advanced" && "border-red-200 hover:bg-red-50",
        ),
  );
}

/** "All levels" difficulty reset pill */
export function difficultyAllPillClass(active: boolean) {
  return cn(
    "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all duration-200 sm:text-xs",
    active
      ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-md ring-2 ring-[var(--primary)]/15"
      : "border border-[var(--brand-border)] bg-white/60 text-[var(--muted-foreground)] hover:bg-[var(--brand-soft)] hover:text-[var(--foreground)]",
  );
}

/** Secondary filter row (tags) — compact inverted pill when active */
export function tagPillClass(active: boolean) {
  return cn(
    "shrink-0 max-w-[9rem] truncate rounded-full px-2 py-0.5 text-[10px] font-medium transition-all duration-200 sm:max-w-[10rem] sm:px-2.5 sm:py-1 sm:text-[11px]",
    active
      ? "border-2 border-[var(--foreground)] bg-[var(--foreground)] font-semibold text-[var(--primary-foreground)] shadow-sm"
      : "border border-[var(--brand-border)] bg-white/50 text-[var(--muted-foreground)] hover:border-[color-mix(in_oklab,var(--foreground),white_75%)] hover:bg-[var(--brand-soft)] hover:text-[var(--foreground)]",
  );
}
