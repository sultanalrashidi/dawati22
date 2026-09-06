"use server";

import { requireUserOrThrow } from "@/lib/auth/guards";
import { setGatePin, clearGatePin, verifyGatePin, GatePinError, GatePinLockedError } from "@/lib/gatepin/service";
import { createGateSession, destroyGateSession } from "@/lib/gatepin/session";
import { Role } from "@/generated/prisma/client";

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
