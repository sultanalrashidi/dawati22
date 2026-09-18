import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/client";
import { generateSecureToken, sha256Hex } from "@/lib/security/tokens";

const GATE_SESSION_COOKIE = "dawati_gate_session";
const GATE_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours — a single event's door duty
/** How long after the ceremony's start time a door may still be worked. */
const EVENT_TAIL_MS = 18 * 60 * 60 * 1000;
/** A door is always usable for at least this long once granted. */
const MIN_SESSION_MS = 2 * 60 * 60 * 1000;

/** Grants the current browser scan access to one event, no user login involved. */
export async function createGateSession(eventId: string) {
  const token = generateSecureToken();
  const tokenHash = sha256Hex(token);

  // Bound to the wedding, not just to a fixed 12 hours from now: a door minted
  // weeks early (a test) or for a date already past should not stay valid for
  // half a day. Same-night duty is unaffected — the 18h tail keeps a session
  // created that evening at its full length.
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { eventDate: true } });
  const now = Date.now();
  const eventEnd = event ? event.eventDate.getTime() + EVENT_TAIL_MS : now + GATE_SESSION_TTL_MS;
  const expiresAt = new Date(Math.min(now + GATE_SESSION_TTL_MS, Math.max(now + MIN_SESSION_MS, eventEnd)));

  await prisma.gateAccessSession.create({ data: { eventId, tokenHash, expiresAt } });

  const cookieStore = await cookies();
  cookieStore.set(GATE_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyGateSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(GATE_SESSION_COOKIE)?.value;
  if (token) {
    await prisma.gateAccessSession.deleteMany({ where: { tokenHash: sha256Hex(token) } });
  }
  cookieStore.delete(GATE_SESSION_COOKIE);
}

/** Returns the eventId this browser is granted scan access to, or null. */
export async function getGateSessionEventId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(GATE_SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.gateAccessSession.findUnique({ where: { tokenHash: sha256Hex(token) } });
  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.gateAccessSession.delete({ where: { id: session.id } });
    return null;
  }

  return session.eventId;
}
