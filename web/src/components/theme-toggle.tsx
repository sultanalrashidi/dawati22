"use client";

import { useLayoutEffect } from "react";
import { THEME_COOKIE, type ThemeMode } from "@/lib/theme/constants";

function readCookieTheme(): ThemeMode | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`));
  const value = match ? decodeURIComponent(match[1]) : null;
  return value === "dark" || value === "light" ? value : null;
}

function resolveCurrentTheme(): ThemeMode {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark" || attr === "light") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Both icons render always; CSS (not React state) picks the visible one via
// the [data-theme] attribute, so there's no server/client icon to reconcile.
export function ThemeToggle({ label }: { label: string }) {
  // Re-applies the cookie/OS preference after React's dev Strict Mode
  // remount clears the attribute the inline script set. No-op in production.
  useLayoutEffect(() => {
    const cookieTheme = readCookieTheme();
    if (cookieTheme) document.documentElement.setAttribute("data-theme", cookieTheme);
  }, []);

  function toggle() {
    const next: ThemeMode = resolveCurrentTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-fg-muted transition-colors hover:text-fg hover:bg-surface-2"
      aria-label={label}
      title={label}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="hidden dark:block">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="block dark:hidden">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
      </svg>
    </button>
  );
}
