"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

const NOTICE_MS = 1400;

const COPY = {
  dark: {
    title: "Midnight mode",
    subtitle: "Privacy-preserving darkness activated",
  },
  light: {
    title: "Daylight mode",
    subtitle: "Bright view for building in the open",
  },
} as const;

export function ThemeModeNotice() {
  const { notice, clearNotice } = useTheme();
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!notice) return;

    setVisible(true);
    const hideTimer = setTimeout(() => setVisible(false), NOTICE_MS - 280);
    const clearTimer = setTimeout(() => clearNotice(), NOTICE_MS);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(clearTimer);
    };
  }, [notice, clearNotice]);

  if (!mounted || !notice) return null;

  const copy = COPY[notice.theme];
  const Icon = notice.theme === "dark" ? Moon : Sun;

  return createPortal(
    <div
      className="theme-notice-overlay pointer-events-none fixed inset-0 z-[100] flex items-center justify-center px-6"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        key={notice.id}
        className={cn(
          "theme-notice-card surface flex flex-col items-center gap-3 px-8 py-7 text-center sm:px-10 sm:py-8",
          visible ? "theme-notice-visible" : "theme-notice-hidden",
        )}
      >
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:var(--brand-border)]",
            notice.theme === "dark" ? "bg-[var(--foreground)] text-[var(--background)]" : "bg-[var(--surface-strong)] text-[var(--foreground)]",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-lg font-bold tracking-wide text-[var(--foreground)] sm:text-xl">{copy.title}</p>
          <p className="mt-1 max-w-xs text-sm text-[var(--muted-foreground)]">{copy.subtitle}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
