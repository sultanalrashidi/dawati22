/**
 * A readable companion to the HttpOnly session cookie, carrying nothing but
 * the signed-in account's role.
 *
 * It exists so the public pages can be served from the CDN as static files:
 * reading the real session means `cookies()` on the server, and one call in
 * the shared layout made EVERY page render on demand — a cold function and a
 * database round trip in front of the home page. The header is
 * the only thing on those pages that depends on who is looking, and all it
 * needs is the role, which this cookie gives the browser directly.
 *
 * It grants nothing. Every protected page and action still checks the real
 * session, so a forged value can at most show a link that then asks the
 * visitor to sign in. A stale one (the session expired first) heals itself on
 * the login page — see `ClearSessionHint`.
 */
import { SESSION_HINT_COOKIE } from "@/lib/auth/cookie-names";

export { SESSION_HINT_COOKIE };

export type SessionHintRole = "CUSTOMER" | "ADMIN" | "GATE_STAFF";

function isHintRole(value: string | null): value is SessionHintRole {
  return value === "CUSTOMER" || value === "ADMIN" || value === "GATE_STAFF";
}

/** Browser only. Returns null on the server and whenever nobody is signed in. */
export function readSessionHint(): SessionHintRole | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${SESSION_HINT_COOKIE}=([^;]*)`));
  const value = match ? decodeURIComponent(match[1]) : null;
  return isHintRole(value) ? value : null;
}

/**
 * Mirrors the hint onto `<html data-auth>`, which the header's `signed-in:` and
 * `customer:` variants key off. The layout's inline script does the same once
 * before first paint; this keeps it true after a sign-in or sign-out that
 * happens without a full page load.
 */
export function syncSessionHintAttribute(role: SessionHintRole | null) {
  if (typeof document === "undefined") return;
  if (role) document.documentElement.setAttribute("data-auth", role);
  else document.documentElement.removeAttribute("data-auth");
}

const CHANGE_EVENT = "dawati:session-hint";

/**
 * `useSyncExternalStore` subscription. A cookie has no change event of its
 * own; navigation re-renders the header and re-reads it anyway, so the one
 * change that needs announcing is the one made here, in the browser, which
 * can land without any navigation (signing out from the page you are on).
 */
export function subscribeSessionHint(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

/** Browser only: forget a hint whose session is gone (or is being ended). */
export function clearSessionHint() {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_HINT_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  syncSessionHintAttribute(null);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
