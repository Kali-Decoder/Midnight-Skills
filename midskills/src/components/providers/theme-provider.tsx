"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "midskills-theme";

export type ThemeNotice = {
  theme: Theme;
  id: number;
};

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  mounted: boolean;
  notice: ThemeNotice | null;
  clearNotice: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "dark" || stored === "light" ? stored : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);
  const [notice, setNotice] = useState<ThemeNotice | null>(null);
  const skipNoticeRef = useRef(true);
  const themeRef = useRef(theme);

  themeRef.current = theme;

  useEffect(() => {
    const initial = readStoredTheme();
    setThemeState(initial);
    applyTheme(initial);
    setMounted(true);
    skipNoticeRef.current = false;
  }, []);

  const clearNotice = useCallback(() => setNotice(null), []);

  const showNotice = useCallback((next: Theme) => {
    if (skipNoticeRef.current) return;
    setNotice({ theme: next, id: Date.now() });
  }, []);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
      showNotice(next);
    },
    [showNotice],
  );

  const toggleTheme = useCallback(() => {
    const next: Theme = themeRef.current === "dark" ? "light" : "dark";
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    showNotice(next);
  }, [showNotice]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, mounted, notice, clearNotice }),
    [theme, setTheme, toggleTheme, mounted, notice, clearNotice],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
