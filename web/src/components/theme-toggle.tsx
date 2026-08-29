"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { ThemeMode } from "@/lib/theme/constants";
import { readTheme, subscribeToTheme, writeTheme } from "@/lib/theme/client";

/**
 * Day / night switch.
 *
 * The cookie was already being read before first paint by the no-flash script
 * in [locale]/layout.tsx — there was simply never a control to write it.
 *
 * The current mode is read straight off <html> rather than mirrored into state:
 * that attribute is set before React hydrates, so a copy in state would render
 * one frame disagreeing with the page behind it.
 */
export function ThemeToggle({ dict }: { dict: Dictionary }) {
  const mode = useSyncExternalStore(subscribeToTheme, readTheme, serverSnapshot);

  const options: Array<{ value: ThemeMode; label: string; icon: ReactNode }> = [
    { value: "light", label: dict.nav.themeLight, icon: <SunIcon /> },
    { value: "dark", label: dict.nav.themeDark, icon: <MoonIcon /> },
  ];

  return (
    <div>
      <p className="text-xs font-bold text-fg-muted">{dict.nav.appearance}</p>
      <div
        role="group"
        aria-label={dict.nav.appearance}
        className="mt-2 flex gap-1 rounded-full border border-border bg-surface-2/60 p-1"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={mode === option.value}
            onClick={() => writeTheme(option.value)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors ${
              mode === option.value ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg"
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The server has no DOM to read; the layout renders light by default. */
function serverSnapshot(): ThemeMode {
  return "light";
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" strokeLinejoin="round" />
    </svg>
  );
}
