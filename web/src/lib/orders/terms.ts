import type { Prisma } from "@/generated/prisma/client";
import { InvitationTier, OrderKind } from "@/generated/prisma/enums";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";

/**
 * What an order actually bought, whichever pricing era it comes from.
 *
 * Orders placed under per-invitation pricing carry their own count and tier.
 * Orders from the fixed-package era carry a `planId` instead, and their count
 * was backfilled onto the order by the per_invitation_pricing migration — so
 * `plan` is only ever consulted for the package's NAME, never for the count.
 *
 * Every read of an order's terms goes through here. That matters more than it
 * looks: capacity used to be read live through `order.plan.invitationCount`,
 * which meant editing a plan in the admin silently resized every already-paid
 * event pointing at it.
 */

/** Structural, so any query shape carrying these fields can be passed in. */
export interface OrderTermsSource {
  /** Optional so older query shapes that never selected it still type-check. */
  kind?: OrderKind;
  invitationCount: number | null;
  tier: InvitationTier | null;
  amount: Prisma.Decimal;
  currency: string;
  /**
   * Only present when the query included it. Used for the package's name, and
   * as the capacity of last resort — see orderTerms().
   */
  plan?: { name: string; nameAr: string; invitationCount?: number } | null;
}

export interface OrderTerms {
  /** The event's guest capacity. */
  invitationCount: number;
  tier: InvitationTier;
  /** Whether these invitations carry a scannable entry pass. */
  hasQr: boolean;
  /** What was charged, in SAR. Never recomputed from a rate — see below. */
  total: number;
  currency: string;
  /** The legacy package name, or null for a per-invitation order. */
  packageName: { ar: string; en: string } | null;
}

export function orderTerms(order: OrderTermsSource | null | undefined): OrderTerms {
  // An unpaid draft has no order at all, and this branch MUST come before the
  // legacy fallbacks below. Those exist to be generous to old rows — `tier ??
  // WITH_QR` hands out the paid entry pass — and being generous to a draft
  // would mean an invitation nobody paid for reporting hasQr true. Zero
  // capacity and NO_QR is the only honest reading of "no order": it fails
  // closed everywhere capacity or the QR feature is checked.
  if (!order) {
    return {
      invitationCount: 0,
      tier: InvitationTier.NO_QR,
      hasQr: false,
      total: 0,
      currency: "SAR",
      packageName: null,
    };
  }

  // Three sources, in order of how much they can be trusted:
  //
  //  1. The order's own snapshot — what the customer paid for.
  //  2. The plan it was sold from. Needed for real: production migrates BEFORE
  //     it deploys, so for the few minutes in between the old build keeps
  //     writing plan-only orders that the migration's backfill has already run
  //     past. Those rows have no snapshot and never will, and their plan is the
  //     only honest answer for them.
  //  3. Zero. Never a real capacity — it fails CLOSED, which surfaces as "you
  //     cannot add guests" rather than the alternative: `guests >= undefined`
  //     is false in JS, so leaving it undefined would silently disable the
  //     capacity check on every event in the product.
  const invitationCount = order.invitationCount ?? order.plan?.invitationCount ?? 0;
  // Everything sold before the tier existed included a QR.
  const tier = order.tier ?? InvitationTier.WITH_QR;

  return {
    invitationCount,
    tier,
    hasQr: tier !== InvitationTier.NO_QR,
    // Always the stored total, never count x unitPrice: the old packages were
    // priced as bundles (299 SAR for 50 invitations, not 50 x anything), so
    // recomputing would silently re-price every historical order.
    total: Number(order.amount),
    currency: order.currency,
    packageName: order.plan ? { ar: order.plan.nameAr, en: order.plan.name } : null,
  };
}

/**
 * One line describing an order, for the checkout summary, the admin lists and
 * the "which package are you using?" picker. Legacy orders keep their package
 * name — that is the only place it still appears, and dropping it would make
 * two old orders for the same count indistinguishable.
 */
export function orderSummaryLabel(
  order: OrderTermsSource | null | undefined,
  locale: Locale,
  dict: Dictionary,
): string {
  // An unpaid draft. Falling through would print "٠ دعوة · بدون باركود", which
  // reads like a real order for nothing rather than like a draft.
  if (!order) return dict.plans.unpaidDraft;
  // A design fee buys no invitations at all, so every number below would read
  // as zero — "٠ دعوة · بدون باركود" on a 150 riyal checkout.
  if (order.kind === OrderKind.CUSTOM_DESIGN) return dict.designRequest.checkoutLabel;

  const terms = orderTerms(order);
  const p = dict.plans;
  // Arabic digits next to an Arabic-formatted amount: mixing "525 دعوة" with
  // "١٬٠٥٠ ر.س" on the same summary line reads like two different orders.
  const count = p.invitations.replace(
    "{count}",
    terms.invitationCount.toLocaleString(locale === "ar" ? "ar-SA" : "en-US"),
  );

  if (terms.packageName) {
    return `${locale === "ar" ? terms.packageName.ar : terms.packageName.en} — ${count}`;
  }
  return `${count} · ${terms.hasQr ? p.tierQrShort : p.tierNoQrShort}`;
}
