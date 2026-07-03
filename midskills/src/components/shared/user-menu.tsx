"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import type { SessionUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export function UserMenu({ user, className }: { user: SessionUser; className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-[color:var(--brand-border)] bg-[var(--surface-muted)] py-1 pl-1 pr-2.5 text-left transition hover:bg-[var(--surface-strong)]"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full border border-[color:var(--brand-border)]" />
        <span className="max-w-[6rem] truncate text-xs font-medium text-[var(--foreground)] sm:max-w-[8rem]">
          @{user.login}
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 min-w-[10rem] overflow-hidden rounded-xl border border-[color:var(--brand-border)] bg-[var(--background)] shadow-lg">
            <div className="border-b border-[color:var(--brand-border)] px-3 py-2">
              <p className="truncate text-xs font-semibold text-[var(--foreground)]">{user.name ?? user.login}</p>
              <p className="truncate text-[11px] text-[var(--muted-foreground)]">@{user.login}</p>
            </div>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-[var(--muted-foreground)] transition hover:bg-[var(--brand-soft)] hover:text-[var(--foreground)]"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
