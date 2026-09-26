"use server";

import { requireUserOrThrow } from "@/lib/auth/guards";
import { revalidatePath } from "next/cache";
import {
  setGatePin,
  clearGatePin,
  verifyGatePin,
  enableGateLink,
  rotateGateLink,
  disableGateLink,
  GatePinError,
  GatePinLockedError,
} from "@/lib/gatepin/service";
import { isLocale, defaultLocale } from "@/lib/i18n/locales";
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

/** The owner's door-link controls. Each re-renders her event page. */
async function ownerGateLink(
  eventId: string,
  locale: string,
  apply: (eventId: string, ownerId: string) => Promise<void>,
): Promise<void> {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  try {
    await apply(eventId, user.id);
  } catch (err) {
    if (!(err instanceof GatePinError)) throw err;
  }
  revalidatePath(`/${isLocale(locale) ? locale : defaultLocale}/events/${eventId}`);
}

export async function enableGateLinkAction(eventId: string, locale: string): Promise<void> {
  await ownerGateLink(eventId, locale, enableGateLink);
}

export async function rotateGateLinkAction(eventId: string, locale: string): Promise<void> {
  await ownerGateLink(eventId, locale, rotateGateLink);
}

export async function disableGateLinkAction(eventId: string, locale: string): Promise<void> {
  await ownerGateLink(eventId, locale, disableGateLink);
}
