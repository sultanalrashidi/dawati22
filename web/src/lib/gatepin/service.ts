import "server-only";
import { prisma } from "@/lib/db/client";
import { sha256Hex } from "@/lib/security/tokens";

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

  await prisma.event.update({
    where: { id: eventId },
    data: { gatePinHash: sha256Hex(pin), gatePinFailedAttempts: 0, gatePinLockedUntil: null },
  });
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

/** Public, unauthenticated: reference code + PIN in, eventId out. Rate-limited per event. */
export async function verifyGatePin(referenceCode: string, pin: string): Promise<string> {
  const event = await prisma.event.findUnique({
    where: { referenceCode: referenceCode.trim().toUpperCase() },
    select: { id: true, gatePinHash: true, gatePinFailedAttempts: true, gatePinLockedUntil: true },
  });
  if (!event || !event.gatePinHash) throw new GatePinError("Invalid reference code or PIN");

  if (event.gatePinLockedUntil && event.gatePinLockedUntil > new Date()) {
    const retryAfterSeconds = Math.max(1, Math.ceil((event.gatePinLockedUntil.getTime() - Date.now()) / 1000));
    throw new GatePinLockedError(retryAfterSeconds);
  }

  if (sha256Hex(pin) !== event.gatePinHash) {
    const attempts = event.gatePinFailedAttempts + 1;
    const lockedOut = attempts >= MAX_ATTEMPTS;
    await prisma.event.update({
      where: { id: event.id },
      data: lockedOut
        ? { gatePinFailedAttempts: 0, gatePinLockedUntil: new Date(Date.now() + LOCKOUT_MS) }
        : { gatePinFailedAttempts: attempts },
    });
    if (lockedOut) throw new GatePinLockedError(Math.ceil(LOCKOUT_MS / 1000));
    throw new GatePinError("Invalid reference code or PIN");
  }

  await prisma.event.update({
    where: { id: event.id },
    data: { gatePinFailedAttempts: 0, gatePinLockedUntil: null },
  });

  return event.id;
}
