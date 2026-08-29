import { THEME_COOKIE, type ThemeMode } from "@/lib/theme/constants";

/**
 * The theme's source of truth is the `data-theme` attribute on <html>, put
 * there before first paint by the no-flash script in [locale]/layout.tsx, and
 * persisted in a cookie so the next server render agrees.
 *
 * Both live outside React, which is why the toggle subscribes to them through
 * `useSyncExternalStore` rather than mirroring them into component state.
 */

export function readTheme(): ThemeMode {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

/** Applies the choice everywhere it is read: the live DOM, and the cookie. */
export function writeTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute("data-theme", mode);
  // A year, path-wide: the choice should outlive the session, and every route
  // reads it.
  document.cookie = `${THEME_COOKIE}=${mode}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/** Notifies React when anything changes `data-theme` — including this tab's own writes. */
export function subscribeToTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
