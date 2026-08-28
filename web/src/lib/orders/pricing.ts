/**
 * Per-invitation pricing rules, shared by the calculator the customer drags and
 * the server action that charges them.
 *
 * Deliberately free of `server-only` and of any Prisma import: the whole point
 * is that the number on the screen and the number in the order come out of the
 * SAME function. Two implementations of "count x rate" is exactly how a page
 * ends up advertising 600 and charging 700.
 *
 * The rates themselves are NOT here — they live in the PricingRate table and are
 * read server-side, so a customer can never post a price.
 */

import type { InvitationTier } from "@/generated/prisma/enums";

/** Product rules, not prices: the shape of the slider. */
export const MIN_INVITATIONS = 25;
export const MAX_INVITATIONS = 800;
export const INVITATION_STEP = 25;
export const DEFAULT_INVITATIONS = 100;

/** The quick-pick chips under the slider. */
export const INVITATION_PRESETS = [50, 100, 200, 300, 500, 800] as const;

export function isValidInvitationCount(count: number): boolean {
  return (
    Number.isInteger(count) &&
    count >= MIN_INVITATIONS &&
    count <= MAX_INVITATIONS &&
    count % INVITATION_STEP === 0
  );
}

/** Snaps a free-typed or tampered number onto the nearest legal stop. */
export function clampInvitationCount(count: number): number {
  if (!Number.isFinite(count)) return DEFAULT_INVITATIONS;
  const stepped = Math.round(count / INVITATION_STEP) * INVITATION_STEP;
  return Math.min(MAX_INVITATIONS, Math.max(MIN_INVITATIONS, stepped));
}

/**
 * Money in halalas, always. A rate of 2.50 x 300 invitations in floats is
 * 749.9999999999999; in integers it is 75000 halalas and then exactly 750.00.
 */
export function halalas(amountSar: number): number {
  return Math.round(amountSar * 100);
}

export function totalHalalas(count: number, unitPriceSar: number): number {
  return halalas(unitPriceSar) * count;
}

/** The value written to Order.amount — a Decimal(10,2), so a fixed string. */
export function totalSar(count: number, unitPriceSar: number): string {
  return (totalHalalas(count, unitPriceSar) / 100).toFixed(2);
}

/** Which tier a posted form value means. Anything unrecognised is not a sale. */
export function parseTier(raw: unknown): InvitationTier | null {
  return raw === "WITH_QR" || raw === "NO_QR" ? raw : null;
}
