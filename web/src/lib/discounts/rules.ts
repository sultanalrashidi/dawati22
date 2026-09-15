/**
 * Discount-code rules: the shape of a code, whether one may be used right
 * now, and how much it takes off.
 *
 * Pure and Prisma-free, like orders/pricing.ts, so the tests exercise exactly
 * what the order action runs. Codes themselves live in the DiscountCode table
 * and are only ever read server-side — a customer posts the code, never an
 * amount.
 */

import { halalas } from "@/lib/orders/pricing";

export type DiscountKindValue = "PERCENT" | "FIXED";

/** Why a code was refused — each one a line the checkout can print. */
export type DiscountRefusal = "unknown" | "inactive" | "notStarted" | "expired" | "usedUp";

const REFUSALS: readonly string[] = ["unknown", "inactive", "notStarted", "expired", "usedUp"];

/** For `?code=` on the checkout URL, which anyone can type. */
export function isDiscountRefusal(value: unknown): value is DiscountRefusal {
  return typeof value === "string" && REFUSALS.includes(value);
}

const CODE_PATTERN = /^[A-Z0-9-]{3,20}$/;

/**
 * What a customer typed, folded to how codes are stored: spaces dropped,
 * Arabic-Indic digits read as Latin ones, letters upper-cased. «watani ٩٦»
 * finds WATANI96.
 */
export function normalizeCode(raw: string): string {
  return raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\s+/g, "")
    .toUpperCase();
}

export function isValidCodeFormat(code: string): boolean {
  return CODE_PATTERN.test(code);
}

/**
 * Whether a stored code may be applied at this moment. `paidUses` is the
 * number of PAID orders already carrying it — a checkout that was abandoned
 * or declined has spent nothing.
 */
export function codeRefusal(
  code: { active: boolean; startsAt: Date | null; endsAt: Date | null; maxUses: number | null },
  paidUses: number,
  now: Date,
): DiscountRefusal | null {
  if (!code.active) return "inactive";
  if (code.startsAt && now < code.startsAt) return "notStarted";
  if (code.endsAt && now >= code.endsAt) return "expired";
  if (code.maxUses !== null && paidUses >= code.maxUses) return "usedUp";
  return null;
}

/** Moyasar takes nothing below one riyal. */
export const MIN_CHARGE_HALALAS = 100;

/**
 * Halalas a code takes off a subtotal — never more than the subtotal itself.
 *
 * A remainder under one riyal cannot be charged by card, so it is waived and
 * the order becomes free rather than being refused: a 99% code on a small
 * order is the owner's generosity, not a customer's dead end.
 */
export function discountHalalas(subtotalHalalas: number, kind: DiscountKindValue, value: number): number {
  const raw = kind === "PERCENT" ? Math.round((subtotalHalalas * value) / 100) : halalas(value);
  const off = Math.min(subtotalHalalas, Math.max(0, raw));
  return subtotalHalalas - off < MIN_CHARGE_HALALAS ? subtotalHalalas : off;
}

/** Why the admin form refused a code. */
export type CodeInputError = "code" | "value" | "maxUses" | "dates" | "ended";

const MAX_FIXED_SAR = 10_000;
const MAX_USES = 100_000;

export interface DiscountCodeInput {
  code: string;
  kind: DiscountKindValue;
  value: number;
  maxUses: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
}

/**
 * Checks what the admin typed. Either end of the window may be left empty; a
 * code with neither runs until it is switched off or used up.
 */
export function buildDiscountCode(
  input: { code: string; kind: string; value: number; maxUses: number | null; startsAt: Date | null; endsAt: Date | null },
  now: Date,
): { code: DiscountCodeInput } | { error: CodeInputError } {
  const code = normalizeCode(input.code);
  if (!isValidCodeFormat(code)) return { error: "code" };

  if (input.kind !== "PERCENT" && input.kind !== "FIXED") return { error: "value" };
  const value = Number(input.value.toFixed(2));
  const ceiling = input.kind === "PERCENT" ? 100 : MAX_FIXED_SAR;
  if (!Number.isFinite(value) || value < 1 || value > ceiling) return { error: "value" };

  const { maxUses } = input;
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > MAX_USES)) {
    return { error: "maxUses" };
  }

  const { startsAt, endsAt } = input;
  if (startsAt && endsAt && endsAt <= startsAt) return { error: "dates" };
  if (endsAt && endsAt <= now) return { error: "ended" };

  return { code: { code, kind: input.kind, value, maxUses, startsAt, endsAt } };
}
