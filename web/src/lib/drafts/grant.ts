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
const GRANT_VERSION = "v1";
/** A key shorter than this is treated as no key at all. */
const MIN_SECRET_LENGTH = 16;

/**
 * Keyed on SESSION_SECRET. A deployment without one (or with a token-length
 * placeholder) issues and honours NO grants: an HMAC under an empty key is a
 * signature anyone can compute, which is the same as no signature.
 */
function grantKey(): string | null {
  const key = process.env.SESSION_SECRET;
  return key && key.length >= MIN_SECRET_LENGTH ? key : null;
}

/**
 * Signs the event, the expiry and the share link the grant came through.
 *
 * The expiry is inside the signature because a cookie's own `expires` is only
 * advice to the browser — a copied cookie value would otherwise work forever.
 * The share token is inside it so that the grant dies with the link: rotating
 * or clearing `Event.previewShareToken` revokes every grant issued from it,
 * server-side, without a table of grants.
 */
function grantSignature(key: string, eventId: string, expiresAtMs: number, shareToken: string): string {
  return createHmac("sha256", key)
    .update(`preview-grant:${GRANT_VERSION}|${eventId}|${expiresAtMs}|${shareToken}`)
    .digest("base64url");
}

/**
 * The value the share route stores in the cookie:
 * `v1.<eventId>.<expiresAtMs>.<hmac>`, or null when grants cannot be signed.
 */
export function signedPreviewGrant(eventId: string, shareToken: string): string | null {
  const key = grantKey();
  if (!key) return null;
  const expiresAtMs = Date.now() + PREVIEW_GRANT_TTL_MS;
  return `${GRANT_VERSION}.${eventId}.${expiresAtMs}.${grantSignature(key, eventId, expiresAtMs, shareToken)}`;
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

/**
 * Whether this browser holds a VALID, unexpired grant for this specific event,
 * issued through its CURRENT share link. `shareToken` is the event's
 * `previewShareToken` as stored now; an event without one has no live grants.
 */
export async function hasPreviewGrant(eventId: string, shareToken: string | null): Promise<boolean> {
  const key = grantKey();
  if (!key || !shareToken) return false;

  const store = await cookies();
  const value = store.get(PREVIEW_GRANT_COOKIE)?.value;
  if (!value) return false;

  const parts = value.split(".");
  if (parts.length !== 4) return false;
  const [version, grantedEventId, expiresRaw, signature] = parts;
  if (version !== GRANT_VERSION || grantedEventId !== eventId) return false;
  if (!/^\d{1,15}$/.test(expiresRaw)) return false;
  const expiresAtMs = Number(expiresRaw);
  if (expiresAtMs <= Date.now()) return false;

  const supplied = Buffer.from(signature);
  const expected = Buffer.from(grantSignature(key, eventId, expiresAtMs, shareToken));
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
