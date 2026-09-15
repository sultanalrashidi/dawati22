/**
 * A time-boxed price offer — «عرض اليوم الوطني» — that the owner sets in the
 * admin on top of the two regular rates.
 *
 * Pure and Prisma-free for the same reason as pricing.ts: the price on the
 * card she reads and the price in the order the server writes must come out of
 * one function. The offer itself is stored as JSON in AppSetting (see
 * settings/service.ts) — it is a switch with numbers on it, not data, so it
 * costs a row rather than a migration.
 */

import type { InvitationTier } from "@/generated/prisma/enums";

export interface PriceOffer {
  /** Shown to Arabic visitors, e.g. «عرض اليوم الوطني». */
  nameAr: string;
  /** Shown to English visitors; empty falls back to a generic label. */
  nameEn: string;
  /** SAR per invitation while the offer runs. */
  withQr: number;
  noQr: number;
  /** ISO instants. The offer runs from startsAt up to, not including, endsAt. */
  startsAt: string;
  endsAt: string;
  /** The owner's off switch, independent of the dates. */
  enabled: boolean;
}

/** Where an offer stands at a given moment — what the admin status line says. */
export type OfferPhase = "none" | "stopped" | "scheduled" | "live" | "ended";

/** Reads the stored JSON back. Anything malformed reads as no offer at all. */
export function parsePriceOffer(raw: string | null | undefined): PriceOffer | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const o = value as Record<string, unknown>;
  const price = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  const instant = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null);
  const withQr = price(o.withQr);
  const noQr = price(o.noQr);
  const startsAt = instant(o.startsAt);
  const endsAt = instant(o.endsAt);
  if (typeof o.nameAr !== "string" || withQr === null || noQr === null || !startsAt || !endsAt) return null;
  return {
    nameAr: o.nameAr,
    nameEn: typeof o.nameEn === "string" ? o.nameEn : "",
    withQr,
    noQr,
    startsAt,
    endsAt,
    enabled: o.enabled === true,
  };
}

export function offerPhase(offer: PriceOffer | null, now: Date): OfferPhase {
  if (!offer) return "none";
  if (!offer.enabled) return "stopped";
  const t = now.getTime();
  if (t < Date.parse(offer.startsAt)) return "scheduled";
  if (t >= Date.parse(offer.endsAt)) return "ended";
  return "live";
}

/** Why the admin form refused an offer — each one a line the form can print. */
export type OfferInputError = "name" | "price" | "notLower" | "dates" | "ended";

/** Typo guards on an offer price, matching the regular rates' own bounds. */
const MIN_OFFER_PRICE = 0.25;
const MAX_OFFER_PRICE = 100;
const MAX_NAME_LENGTH = 60;

/**
 * Checks what the admin typed and turns it into the offer that gets stored.
 *
 * Each price may equal its regular rate — an offer on one tier only — but may
 * not exceed it, and at least one must be lower, or there is nothing on offer.
 * Saving always switches the offer on: the form's one button is «save and run».
 */
export function buildPriceOffer(
  input: {
    nameAr: string;
    nameEn: string;
    withQr: number;
    noQr: number;
    startsAt: Date | null;
    endsAt: Date | null;
  },
  regular: { withQr: number | null; noQr: number | null },
  now: Date,
): { offer: PriceOffer } | { error: OfferInputError } {
  const nameAr = input.nameAr.trim();
  const nameEn = input.nameEn.trim();
  if (!nameAr || nameAr.length > MAX_NAME_LENGTH || nameEn.length > MAX_NAME_LENGTH) {
    return { error: "name" };
  }

  // Validate the value that will be charged, not the one typed: 1.999 is 2.00.
  const stored = (value: number) => Number(value.toFixed(2));
  const withQr = stored(input.withQr);
  const noQr = stored(input.noQr);
  for (const price of [withQr, noQr]) {
    if (!Number.isFinite(price) || price < MIN_OFFER_PRICE || price > MAX_OFFER_PRICE) {
      return { error: "price" };
    }
  }
  const above = (price: number, base: number | null) => base !== null && price > base;
  const below = (price: number, base: number | null) => base !== null && price < base;
  if (above(withQr, regular.withQr) || above(noQr, regular.noQr)) return { error: "notLower" };
  if (!below(withQr, regular.withQr) && !below(noQr, regular.noQr)) return { error: "notLower" };

  const { startsAt, endsAt } = input;
  if (!startsAt || !endsAt || endsAt <= startsAt) return { error: "dates" };
  if (endsAt <= now) return { error: "ended" };

  return {
    offer: {
      nameAr,
      nameEn,
      withQr,
      noQr,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      enabled: true,
    },
  };
}

/**
 * The price of one invitation of this tier at this moment.
 *
 * An offer can only LOWER a price. A typo that sets it above the regular rate
 * must not raise what customers pay — and a card reading "was 2, now 2.75"
 * would be worse than no offer at all — so the regular rate wins whenever it
 * is already the cheaper of the two.
 */
export function offerUnitPrice(
  offer: PriceOffer | null,
  tier: InvitationTier,
  regular: number,
  now: Date,
): number {
  if (offerPhase(offer, now) !== "live" || !offer) return regular;
  const price = tier === "WITH_QR" ? offer.withQr : offer.noQr;
  return price < regular ? price : regular;
}
