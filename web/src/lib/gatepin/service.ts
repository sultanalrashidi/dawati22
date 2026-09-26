import "server-only";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { generateSecureToken, sha256Hex } from "@/lib/security/tokens";
import { DOOR_ELIGIBLE_EVENT, isDoorEligible } from "@/lib/checkin/eligibility";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const PIN_PATTERN = /^\d{4,8}$/;

export class GatePinError extends Error {}
export class GatePinLockedError extends Error {
  constructor(public retryAfterSeconds: number) {
    super("Too many attempts. Please wait before trying again.");
  }
}

export async function setGatePin(eventId: string, ownerId: string, pin: string): Promise<void> {
  if (!PIN_PATTERN.test(pin)) throw new GatePinError("invalid_format");

  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { ownerId: true } });
  if (!event || event.ownerId !== ownerId) throw new GatePinError("not_found");
  // A PIN opens a door; an event with no door (unpaid, or sold without the QR
  // pass) gets none.
  if (!(await isDoorEligible(eventId))) throw new GatePinError("not_eligible");

  await prisma.$transaction([
    prisma.event.update({
      where: { id: eventId },
      data: { gatePinHash: sha256Hex(pin), gatePinFailedAttempts: 0, gatePinLockedUntil: null },
    }),
    // Revoke every door already granted under the OLD pin — the same thing
    // clearGatePin does. Changing the pin because it leaked, but leaving the
    // sessions it minted alive, would change nothing for whoever already had one.
    prisma.gateAccessSession.deleteMany({ where: { eventId } }),
  ]);
}

export async function clearGatePin(eventId: string, ownerId: string): Promise<void> {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { ownerId: true } });
  if (!event || event.ownerId !== ownerId) throw new GatePinError("not_found");

  await prisma.$transaction([
    prisma.event.update({
      where: { id: eventId },
      data: { gatePinHash: null, gatePinFailedAttempts: 0, gatePinLockedUntil: null },
    }),
    // Revoke any guard sessions already granted under the old PIN.
    prisma.gateAccessSession.deleteMany({ where: { eventId } }),
  ]);
}

function lockedFor(until: Date | null): GatePinLockedError {
  const ms = until ? until.getTime() - Date.now() : LOCKOUT_MS;
  return new GatePinLockedError(Math.max(1, Math.ceil(ms / 1000)));
}

/** Locks the event's door unless it already is. Conditional, so parallel losers cannot extend it. */
async function lockDoor(eventId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "Event"
       SET "gatePinFailedAttempts" = 0,
           "gatePinLockedUntil" = NOW() + ${LOCKOUT_MS} * INTERVAL '1 millisecond',
           "updatedAt" = NOW()
     WHERE "id" = ${eventId}
       AND ("gatePinLockedUntil" IS NULL OR "gatePinLockedUntil" <= NOW())
  `;
}

/**
 * Public, unauthenticated: reference code + PIN in, eventId out. Rate-limited per event.
 *
 * Every comparison is ADMITTED first: one conditional UPDATE takes an attempt
 * from the event's budget only while the door is unlocked and attempts remain,
 * and returns the PIN hash as it stands at that moment. A burst of parallel
 * guesses therefore reaches the comparison at most MAX_ATTEMPTS times — a
 * stale "unlocked" read can no longer let all of them through. Right answers
 * are counted too; a success resets the counter only if no parallel failure
 * locked the door meanwhile.
 */
export async function verifyGatePin(referenceCode: string, pin: string): Promise<string> {
  const event = await prisma.event.findFirst({
    where: { referenceCode: referenceCode.trim().toUpperCase(), ...DOOR_ELIGIBLE_EVENT },
    select: { id: true, gatePinHash: true },
  });
  if (!event || !event.gatePinHash) throw new GatePinError("Invalid reference code or PIN");

  const [claimed] = await prisma.$queryRaw<{ attempts: number; gatePinHash: string | null }[]>`
    UPDATE "Event"
       SET "gatePinFailedAttempts" = "gatePinFailedAttempts" + 1, "updatedAt" = NOW()
     WHERE "id" = ${event.id}
       AND "gatePinHash" IS NOT NULL
       AND ("gatePinLockedUntil" IS NULL OR "gatePinLockedUntil" <= NOW())
       AND "gatePinFailedAttempts" < ${MAX_ATTEMPTS}
    RETURNING "gatePinFailedAttempts" AS "attempts", "gatePinHash"
  `;
  if (!claimed) {
    const current = await prisma.event.findUnique({
      where: { id: event.id },
      select: { gatePinHash: true, gatePinLockedUntil: true },
    });
    if (!current?.gatePinHash) throw new GatePinError("Invalid reference code or PIN");
    if (current.gatePinLockedUntil && current.gatePinLockedUntil > new Date()) {
      throw lockedFor(current.gatePinLockedUntil);
    }
    // Budget spent by claims still in flight: record the lock now so the door
    // cannot sit exhausted and unlocked.
    await lockDoor(event.id);
    throw lockedFor(null);
  }

  // Compared against the hash returned by the claim, not the earlier read: a
  // PIN changed in between is judged by its new value.
  const supplied = Buffer.from(sha256Hex(pin));
  const expected = Buffer.from(claimed.gatePinHash ?? "");
  const matches = supplied.length === expected.length && timingSafeEqual(supplied, expected);

  if (!matches) {
    if (claimed.attempts >= MAX_ATTEMPTS) {
      await lockDoor(event.id);
      throw new GatePinLockedError(Math.ceil(LOCKOUT_MS / 1000));
    }
    throw new GatePinError("Invalid reference code or PIN");
  }

  const reset = await prisma.$executeRaw`
    UPDATE "Event"
       SET "gatePinFailedAttempts" = 0, "updatedAt" = NOW()
     WHERE "id" = ${event.id}
       AND "gatePinHash" = ${claimed.gatePinHash}
       AND ("gatePinLockedUntil" IS NULL OR "gatePinLockedUntil" <= NOW())
  `;
  if (reset === 0) {
    const current = await prisma.event.findUnique({ where: { id: event.id }, select: { gatePinLockedUntil: true } });
    if (current?.gatePinLockedUntil && current.gatePinLockedUntil > new Date()) throw lockedFor(current.gatePinLockedUntil);
    // The PIN was changed or cleared while this guess was in flight.
    throw new GatePinError("Invalid reference code or PIN");
  }

  return event.id;
}

// ---------------------------------------------------------------------------
// The door team's link — the PIN-free way in
// ---------------------------------------------------------------------------

async function assertOwnDoor(eventId: string, ownerId: string): Promise<void> {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { ownerId: true } });
  if (!event || event.ownerId !== ownerId) throw new GatePinError("not_found");
  if (!(await isDoorEligible(eventId))) throw new GatePinError("not_eligible");
}

/**
 * Turns the door link on, or hands back the one already on. Guarded on the
 * column still being empty so two taps cannot mint two links.
 */
export async function enableGateLink(eventId: string, ownerId: string): Promise<void> {
  await assertOwnDoor(eventId, ownerId);
  await prisma.event.updateMany({
    where: { id: eventId, gateLinkToken: null },
    data: { gateLinkToken: generateSecureToken() },
  });
}

/**
 * A new link, and every door opened so far is closed. For a link that went
 * further than the door team. Door sessions are per event, not per way in, so
 * anyone who entered with the PIN signs in again too.
 */
export async function rotateGateLink(eventId: string, ownerId: string): Promise<void> {
  await assertOwnDoor(eventId, ownerId);
  await prisma.$transaction([
    prisma.event.update({ where: { id: eventId }, data: { gateLinkToken: generateSecureToken() } }),
    prisma.gateAccessSession.deleteMany({ where: { eventId } }),
  ]);
}

/** Link off, open doors closed. Allowed even when the event is no longer door-eligible. */
export async function disableGateLink(eventId: string, ownerId: string): Promise<void> {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { ownerId: true } });
  if (!event || event.ownerId !== ownerId) throw new GatePinError("not_found");
  await prisma.$transaction([
    prisma.event.update({ where: { id: eventId }, data: { gateLinkToken: null } }),
    prisma.gateAccessSession.deleteMany({ where: { eventId } }),
  ]);
}

/** The event a door link opens, or null — unknown, switched off, or no longer a door event. */
export async function resolveGateLink(token: string): Promise<string | null> {
  if (!token) return null;
  const event = await prisma.event.findFirst({
    where: { gateLinkToken: token, ...DOOR_ELIGIBLE_EVENT },
    select: { id: true },
  });
  return event?.id ?? null;
}
