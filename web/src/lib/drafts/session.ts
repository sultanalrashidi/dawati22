import "server-only";
import { cookies, headers } from "next/headers";
import { generateSecureToken, sha256Hex } from "@/lib/security/tokens";

/**
 * The handle that lets someone who has not signed in come back to the
 * invitation they are designing.
 *
 * Modelled on the gate-access cookie (lib/gatepin/session.ts): the raw token
 * lives only in an httpOnly cookie, and only its sha256 is stored, so the
 * database never holds anything that could be replayed if it leaked. The
 * important consequence is that a draft URL carries NO secret at all — the
 * cookie is the key — which is what makes a copied /draft link open nothing.
 */

const DRAFT_COOKIE = "dawati_draft";

/**
 * Long enough to design an invitation across a few evenings, short enough that
 * a shared or public browser does not keep offering a stranger's wedding
 * months later. A signed-in customer never depends on this: once she has an
 * account the draft is hers by ownerId and the cookie stops mattering.
 */
const DRAFT_COOKIE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** The raw token this browser is carrying, if any. */
export async function readDraftToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(DRAFT_COOKIE)?.value ?? null;
}

/** sha256 of this browser's token — what the Event row is looked up by. */
export async function readDraftTokenHash(): Promise<string | null> {
  const token = await readDraftToken();
  return token ? sha256Hex(token) : null;
}

/**
 * Mints a fresh token, sets the cookie, and hands back the hash to store on
 * the new draft. Always a NEW token: reusing one would let a second draft
 * inherit the first one's key.
 */
export async function issueDraftToken(): Promise<string> {
  const token = generateSecureToken();
  const store = await cookies();
  store.set(DRAFT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(Date.now() + DRAFT_COOKIE_TTL_MS),
  });
  return sha256Hex(token);
}

/**
 * Drops the cookie. Called when the draft it pointed at is claimed by a signed
 * -in customer or deleted — a token that no longer opens anything should not
 * keep riding along on every request.
 */
export async function clearDraftToken(): Promise<void> {
  const store = await cookies();
  store.delete(DRAFT_COOKIE);
}

/**
 * A stable, non-reversible key for the caller's network address, for rate
 * limiting only.
 *
 * `x-real-ip` is set by the platform. The first entry of `x-forwarded-for` is
 * attacker-controlled — anyone can send that header — so the LAST entry is
 * used as the fallback, since proxies append and only the nearest hop is
 * trustworthy. Falling back to a constant is deliberate: an unknown address
 * shares one bucket rather than getting an unlimited one each.
 */
export async function clientAddressHash(): Promise<string> {
  const hdrs = await headers();
  const realIp = hdrs.get("x-real-ip")?.trim();
  const forwarded = hdrs.get("x-forwarded-for");
  const lastHop = forwarded?.split(",").map((p) => p.trim()).filter(Boolean).pop();
  return sha256Hex(realIp || lastHop || "unknown");
}
