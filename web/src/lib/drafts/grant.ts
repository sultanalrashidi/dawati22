import "server-only";
import { cookies } from "next/headers";

/**
 * The pass a share link hands the browser that opened it.
 *
 * It holds one event id and nothing else — no signature, because it grants
 * nothing that the id alone does not already imply: the share route only ever
 * issues it after checking the secret token and spending a viewer slot, and
 * the worst a forged value can do is show a WATERMARKED preview of an event
 * whose id the forger already had to know. Real invitations are not reachable
 * this way at all; they need a guest link, which does not exist before payment.
 */

export const PREVIEW_GRANT_COOKIE = "dawati_preview_grant";
const PREVIEW_GRANT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function previewGrantCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(Date.now() + PREVIEW_GRANT_TTL_MS),
  };
}

/** Whether this browser was let into this specific event's shared preview. */
export async function hasPreviewGrant(eventId: string): Promise<boolean> {
  const store = await cookies();
  return store.get(PREVIEW_GRANT_COOKIE)?.value === eventId;
}
