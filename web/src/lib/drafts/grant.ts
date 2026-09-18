import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The pass a share link hands the browser that opened it.
 *
 * It carries one event id, signed. The signature is what stops a stranger who
 * merely knows an event id (they leak into `/preview/<id>` URLs, the preview
 * bar and the wallet class id) from forging the cookie to walk past the
 * three-viewer cap — the raw, unsigned id used to be accepted as-is, so any
 * `Cookie: dawati_preview_grant=<id>` header opened the preview.
 *
 * Even so, the signature is not the only guard: the preview page keeps the
 * watermark on for anyone who arrived through a grant rather than as the owner,
 * so a paid invitation is never rendered clean to a share viewer regardless of
 * what cookie they present.
 */

export const PREVIEW_GRANT_COOKIE = "dawati_preview_grant";
const PREVIEW_GRANT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Keyed on SESSION_SECRET, which every real deployment sets. An HMAC over the
 * event id: unforgeable without the key, and cheap to check.
 */
function grantSignature(eventId: string): string {
  const key = process.env.SESSION_SECRET ?? "";
  return createHmac("sha256", key).update(eventId).digest("base64url");
}

/** The value the share route stores in the cookie: `<eventId>.<hmac>`. */
export function signedPreviewGrant(eventId: string): string {
  return `${eventId}.${grantSignature(eventId)}`;
}

export function previewGrantCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(Date.now() + PREVIEW_GRANT_TTL_MS),
  };
}

/** Whether this browser holds a VALID, signed grant for this specific event. */
export async function hasPreviewGrant(eventId: string): Promise<boolean> {
  const store = await cookies();
  const value = store.get(PREVIEW_GRANT_COOKIE)?.value;
  if (!value) return false;

  const dot = value.lastIndexOf(".");
  if (dot <= 0) return false;
  if (value.slice(0, dot) !== eventId) return false;

  const supplied = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(grantSignature(eventId));
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
