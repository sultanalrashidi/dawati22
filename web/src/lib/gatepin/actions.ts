"use server";

import { requireUserOrThrow } from "@/lib/auth/guards";
import { performCheckIn, type CheckInOutcome } from "@/lib/checkin/service";
import { setGatePin, clearGatePin, verifyGatePin, GatePinError, GatePinLockedError } from "@/lib/gatepin/service";
import { createGateSession, destroyGateSession, getGateSessionEventId } from "@/lib/gatepin/session";
import { CheckInResult, Role } from "@/generated/prisma/client";

export async function setGatePinAction(
  eventId: string,
  pin: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  try {
    await setGatePin(eventId, user.id, pin);
    return { ok: true };
  } catch (err) {
    if (err instanceof GatePinError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function clearGatePinAction(eventId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  try {
    await clearGatePin(eventId, user.id);
    return { ok: true };
  } catch (err) {
    if (err instanceof GatePinError) return { ok: false, error: err.message };
    throw err;
  }
}

export type VerifyGatePinResult = { ok: true } | { ok: false; error: string; retryAfterSeconds?: number };

export async function verifyGatePinAction(referenceCode: string, pin: string): Promise<VerifyGatePinResult> {
  try {
    const eventId = await verifyGatePin(referenceCode, pin);
    await createGateSession(eventId);
    return { ok: true };
  } catch (err) {
    if (err instanceof GatePinLockedError) {
      return { ok: false, error: "locked", retryAfterSeconds: err.retryAfterSeconds };
    }
    if (err instanceof GatePinError) return { ok: false, error: "invalid" };
    throw err;
  }
}

export async function exitGateAccessAction(): Promise<void> {
  await destroyGateSession();
}

/** Scan action for the no-login /gate-access scanner — authorizes via the signed gate session, not a user account. */
export async function scanQrPinAction(eventId: string, qrToken: string): Promise<CheckInOutcome> {
  const sessionEventId = await getGateSessionEventId();
  if (!sessionEventId || sessionEventId !== eventId) {
    return { result: CheckInResult.DENIED_INVALID };
  }
  return performCheckIn(qrToken.trim(), eventId, null);
}
