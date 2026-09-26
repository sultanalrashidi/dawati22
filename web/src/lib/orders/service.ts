import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { isUntouchedSample } from "@/lib/drafts/sample";
import { logger } from "@/lib/logger";
import {
  chargeableOrderProvider,
  isMockPaymentAllowed,
  isMoyasarConfigured,
  fetchMoyasarPayment,
  PaymentsUnavailableError,
  sarToHalalas,
} from "@/lib/payments/moyasar";
import { EventStatus, OrderKind, OrderStatus, PaymentProvider } from "@/generated/prisma/client";
import { InvitationTier } from "@/generated/prisma/enums";
import { isValidInvitationCount, totalHalalas } from "@/lib/orders/pricing";
import { offerUnitPrice } from "@/lib/orders/offer";
import { codeRefusal, discountHalalas } from "@/lib/discounts/rules";
import {
  DISCOUNT_RESERVATION_MS,
  DiscountError,
  heldUses,
  lockDiscountCode,
  requireUsableCode,
} from "@/lib/discounts/service";
import { getPriceOffer } from "@/lib/settings/service";
import { deliverPaidDesign } from "@/lib/design-requests/service";
import { orderTerms } from "@/lib/orders/terms";
import { PAYABLE_ORDER_STATUSES, isPayableOrderStatus } from "@/lib/orders/status";
import { generateReferenceCode } from "@/lib/events/reference-code";
import { generateSecureToken } from "@/lib/security/tokens";

export class OrderError extends Error {}

/**
 * Everything that must happen the moment an order is paid, whichever path got
 * it there — the mock button, the Moyasar redirect, or the webhook.
 *
 * It lives in one function because there are THREE of those paths. A fulfilment
 * step wired into only the one being exercised today is a step that silently
 * stops happening the day real card payments are switched on, and the customer
 * whose design never arrives is the one who finds out.
 *
 * For an invitations order this is where the draft she designed becomes a real
 * invitation — the single point all three payment paths funnel through, which
 * is exactly why activation belongs here rather than in the redirect handler.
 */
async function fulfilPaidOrder(order: {
  id: string;
  userId: string;
  kind: OrderKind;
  draftEventId: string | null;
}): Promise<void> {
  if (order.kind === OrderKind.CUSTOM_DESIGN) {
    await deliverPaidDesign(order.id);
    return;
  }
  await activateDraftEvent(order);
}

/** The regular price list — two rows, one per tier. What the admin edits. */
export async function listPricingRates() {
  return prisma.pricingRate.findMany({ orderBy: { unitPrice: "desc" } });
}

export interface LiveTierPrice {
  /** SAR per invitation, what an order raised now is charged. */
  unitPrice: number;
  /** The regular rate, only when a running offer beats it — the struck-through figure. */
  listPrice: number | null;
  currency: string;
}

export interface LivePricing {
  /** Null when that tier has no PricingRate row: nothing can be sold at it. */
  withQr: LiveTierPrice | null;
  noQr: LiveTierPrice | null;
  /** The running offer, only while it lowers at least one of the two prices. */
  offer: { nameAr: string; nameEn: string; endsAt: Date } | null;
}

/**
 * What an invitation costs right now: the regular rates with any running offer
 * applied. Every page that quotes a price and the order that charges one read
 * THIS, so an offer can never show on a card and be missing from the invoice,
 * or the other way round.
 */
export async function getLivePricing(now: Date = new Date()): Promise<LivePricing> {
  const [rates, offer] = await Promise.all([listPricingRates(), getPriceOffer()]);

  const priceFor = (tier: InvitationTier): LiveTierPrice | null => {
    const rate = rates.find((r) => r.tier === tier);
    if (!rate) return null;
    const regular = Number(rate.unitPrice);
    const unitPrice = offerUnitPrice(offer, tier, regular, now);
    return { unitPrice, listPrice: unitPrice < regular ? regular : null, currency: rate.currency };
  };

  const withQr = priceFor(InvitationTier.WITH_QR);
  const noQr = priceFor(InvitationTier.NO_QR);
  const discounted = withQr?.listPrice != null || noQr?.listPrice != null;

  return {
    withQr,
    noQr,
    offer:
      discounted && offer
        ? { nameAr: offer.nameAr, nameEn: offer.nameEn, endsAt: new Date(offer.endsAt) }
        : null,
  };
}

/**
 * The only way an order is created.
 *
 * `count` arrives from the browser and is therefore re-validated here; the RATE
 * never crosses the trust boundary at all — it is read from PricingRate (and
 * any running offer) and the total is computed server-side, so a customer
 * cannot post a price. That was
 * already true of the old package flow (only a planId was posted) and it has to
 * stay true now that a quantity is posted too. A discount code is the same: she
 * posts the code, and what it takes off is worked out here.
 */
export async function createPerInvitationOrder(
  userId: string,
  input: { tier: InvitationTier; count: number; draftEventId: string; discountCode?: string | null },
) {
  if (!isValidInvitationCount(input.count)) throw new OrderError("Invalid invitation count");

  // The order exists to activate one specific invitation she has already
  // designed. Verified here rather than trusted from the form: this is what
  // makes "every payment has something to activate" true no matter which
  // route raised the order.
  const draft = await prisma.event.findUnique({
    where: { id: input.draftEventId },
    select: {
      ownerId: true,
      orderId: true,
      groomNameAr: true,
      groomFamilyAr: true,
      brideNameAr: true,
      brideFamilyAr: true,
      locationName: true,
    },
  });
  if (!draft || draft.ownerId !== userId) throw new OrderError("Draft not found");
  if (draft.orderId !== null) throw new OrderError("Draft is already activated");
  // The draft was born holding a whole sample wedding so its preview looked
  // finished. Charging a card for one nobody has edited would print a
  // stranger's family on every guest's pass. Only a WHOLLY untouched draft is
  // refused — a real couple called فهد and نورة has a hall of her own by now.
  // The activate page hides the pay button on the same test. The Event's own
  // columns mirror the primary couple, so no join is needed.
  if (isUntouchedSample([draft], draft.locationName)) {
    throw new OrderError("Draft is still the untouched sample invitation");
  }

  // Today's price, offer included — the same figure the activate page showed.
  const pricing = await getLivePricing();
  const rate = input.tier === InvitationTier.WITH_QR ? pricing.withQr : pricing.noQr;
  if (!rate) throw new OrderError("Pricing not available");

  // The code is checked BEFORE the draft's current order is superseded below:
  // a refused code must leave her order exactly as it was, still payable.
  const code = input.discountCode ? await requireUsableCode(input.discountCode, input.draftEventId) : null;
  const subtotal = totalHalalas(input.count, rate.unitPrice);
  const off = code ? discountHalalas(subtotal, code.kind, Number(code.value)) : 0;
  const amountHalalas = subtotal - off;

  // At most one payable order per draft, ever.
  //
  // Changing the guest count and pressing pay again used to leave the first
  // order sitting there, still payable — and since only ONE order can ever
  // activate the draft, paying the stale one would charge a card and buy
  // literally nothing. Superseding is only half of it; the other half is that
  // CANCELLED can no longer become PAID (see confirmMoyasarPayment). A FAILED
  // order is closed here too, because it is still payable (a declined card can
  // be retried) and would otherwise race the new one.
  const provider = amountHalalas === 0 ? PaymentProvider.FREE : chargeableProvider();

  return prisma.$transaction(async (tx) => {
    // At most one payable order per draft, ever.
    //
    // Changing the guest count and pressing pay again used to leave the first
    // order sitting there, still payable — and since only ONE order can ever
    // activate the draft, paying the stale one would charge a card and buy
    // literally nothing. Superseding is only half of it; the other half is that
    // CANCELLED can no longer become PAID (see confirmMoyasarPayment). A FAILED
    // order is closed here too, because it is still payable (a declined card can
    // be retried) and would otherwise race the new one. Superseding also
    // releases whatever code use the old order was holding.
    await tx.order.updateMany({
      where: { draftEventId: input.draftEventId, status: { in: PAYABLE_ORDER_STATUSES } },
      data: { status: OrderStatus.CANCELLED },
    });

    // The code's use is RESERVED here, under the code's lock and in the same
    // transaction that writes the order: the count above was only a
    // pre-check, and two customers racing for the last use must not both get
    // a discounted checkout.
    const now = new Date();
    if (code) {
      await lockDiscountCode(tx, code.id);
      const refusal = codeRefusal(code, await heldUses(tx, code.id, now), now);
      if (refusal) throw new DiscountError(refusal);
    }

    return tx.order.create({
      data: {
        userId,
        // No plan: fixed packages are retired. The order carries its own terms.
        planId: null,
        draftEventId: input.draftEventId,
        invitationCount: input.count,
        tier: input.tier,
        // A frozen copy of today's rate — the offer price while one runs — so
        // re-pricing, or the offer ending, never re-prices this sale.
        unitPrice: rate.unitPrice.toFixed(2),
        amount: (amountHalalas / 100).toFixed(2),
        discountCodeId: code?.id ?? null,
        discountAmount: code ? (off / 100).toFixed(2) : null,
        discountReservedUntil: code ? new Date(now.getTime() + DISCOUNT_RESERVATION_MS) : null,
        currency: rate.currency,
        // Nothing left to charge means no card at all — see settleFreeOrder.
        provider,
        idempotencyKey: randomUUID(),
      },
    });
  });
}

/**
 * The one way an order becomes PAID — every settlement path goes through it.
 *
 * Conditional on the order still being payable, so of the redirect, the
 * webhook and a second tab, exactly one transition happens and exactly one
 * caller goes on to fulfil. For a discounted order it runs under the code's
 * lock:
 *
 *  - `enforceCode: true` (no money has moved: a free order, the dev mock) —
 *    the code must still be valid and a use must still be available to THIS
 *    order, or it is refused with DiscountError and stays unpaid.
 *  - `enforceCode: false` (a card has already been charged at the discounted
 *    amount) — the payment is honoured whatever happened; an over-redemption
 *    is logged for the owner rather than turned into a charge for nothing.
 *
 * Returns the paid order, or null when another caller settled it first.
 */
async function markOrderPaid(
  orderId: string,
  providerRef: string,
  options: { enforceCode: boolean },
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order || !isPayableOrderStatus(order.status)) return null;

    if (order.discountCodeId) {
      await lockDiscountCode(tx, order.discountCodeId);
      const code = await tx.discountCode.findUnique({ where: { id: order.discountCodeId } });
      const now = new Date();
      const refusal = code
        ? codeRefusal(code, await heldUses(tx, code.id, now, order.id), now)
        : ("unknown" as const);
      if (refusal) {
        if (options.enforceCode) throw new DiscountError(refusal);
        logger.error("orders.discount.over_redeemed", { orderId, codeId: order.discountCodeId, refusal });
      }
    }

    const claimed = await tx.order.updateMany({
      where: { id: order.id, status: { in: PAYABLE_ORDER_STATUSES } },
      data: { status: OrderStatus.PAID, paidAt: new Date(), providerRef, discountReservedUntil: null },
    });
    if (claimed.count === 0) return null;
    return tx.order.findUniqueOrThrow({ where: { id: order.id } });
  });
}

/**
 * The same invitations, priced again with a code — or without one. Applying or
 * removing a code raises a fresh order rather than editing this one: an
 * order's amount never changes once a card form may have been shown for it, so
 * a payment in flight can only ever match the order it was started for.
 */
export async function repriceOrderWithCode(userId: string, orderId: string, discountCode: string | null) {
  const order = await getOwnedOrder(orderId, userId);
  if (!order) throw new OrderError("Order not found");
  if (!isPayableOrderStatus(order.status)) throw new OrderError("Order is not payable");
  if (order.kind !== OrderKind.INVITATIONS || !order.draftEventId || !order.tier || !order.invitationCount) {
    throw new OrderError("This order takes no discount code");
  }
  return createPerInvitationOrder(userId, {
    tier: order.tier,
    count: order.invitationCount,
    draftEventId: order.draftEventId,
    discountCode,
  });
}

/**
 * Settles an order a discount code made free: no card, so no Moyasar — it
 * becomes PAID here and is delivered like any other paid order.
 *
 * With no money involved the code CAN still be refused at the last moment, so
 * `markOrderPaid` re-checks it under the code's lock: switched off, expired, or
 * its last use taken by someone else, and the order stays PENDING, where her
 * checkout offers to continue without the code.
 */
export async function settleFreeOrder(orderId: string, userId: string) {
  const order = await getOwnedOrder(orderId, userId);
  if (!order) throw new OrderError("Order not found");
  if (order.status === OrderStatus.PAID) return order;
  if (!isPayableOrderStatus(order.status)) throw new OrderError("Order is not payable");
  if (order.provider !== PaymentProvider.FREE || Number(order.amount) !== 0 || !order.discountCodeId) {
    throw new OrderError("Order is not free");
  }

  const paid = await markOrderPaid(order.id, `free_${order.id}`, { enforceCode: true });
  if (!paid) return order; // Settled a moment ago by her other tab.
  await fulfilPaidOrder(paid);
  return paid;
}

/**
 * Turns the paid draft into a live invitation. THE moment guests, sharing and
 * the door scanner become possible.
 *
 * A compare-and-set, and deliberately not a plain update: the redirect from
 * Moyasar and the webhook both settle the same payment, often within
 * milliseconds of each other. `orderId: null` in the filter means exactly one
 * of them wins and the loser updates zero rows — no transaction, no lock, and
 * no way to activate a draft twice or activate one that another order already
 * claimed.
 *
 * It never throws. It runs after the card has been charged, and an exception
 * here would surface as a 500 on the callback with the money already taken.
 */
export async function activateDraftEvent(order: {
  id: string;
  userId: string;
  draftEventId: string | null;
  kind: OrderKind;
}) {
  if (order.kind !== OrderKind.INVITATIONS || !order.draftEventId) return;

  const { hasQr } = orderTerms(await prisma.order.findUnique({ where: { id: order.id } }));

  const activated = await prisma.event.updateMany({
    where: { id: order.draftEventId, orderId: null, ownerId: order.userId },
    data: {
      orderId: order.id,
      // Snapshotted from what she actually bought. hasQr's column default is
      // the permissive `true`, kept for legacy rows, so leaving it unset here
      // would hand a NO_QR customer the paid entry pass.
      hasQr,
      referenceCode: await allocateReferenceCode(),
      selfPreviewToken: generateSecureToken(),
      status: EventStatus.PUBLISHED,
    },
  });

  if (activated.count === 0) {
    // Zero rows updated has two very different meanings, and logging both as
    // an error would cry wolf on every single payment: the redirect and the
    // webhook BOTH settle the same payment, so one of them always loses this
    // race and always updates nothing.
    const draft = await prisma.event.findUnique({
      where: { id: order.draftEventId },
      select: { orderId: true },
    });

    if (draft?.orderId === order.id) return; // The benign race: already ours.

    // The real thing: paid, with nothing to deliver — the draft was deleted,
    // or another order claimed it. Loud on purpose, because this is a refund,
    // and a quiet line here is found weeks later by an angry customer.
    logger.error("orders.activate.nothing_claimed", {
      orderId: order.id,
      draftEventId: order.draftEventId,
      userId: order.userId,
      claimedBy: draft?.orderId ?? null,
    });
  }
}

/**
 * A free reference code. Generated OUTSIDE the activation update rather than
 * retried around it: a collision is a 1-in-31^6 event, and retrying a write
 * that has already charged a card is the wrong shape of risk.
 */
async function allocateReferenceCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferenceCode();
    const taken = await prisma.event.findUnique({ where: { referenceCode: code }, select: { id: true } });
    if (!taken) return code;
  }
  // Five collisions in a row is not chance, but the invitation still has to
  // activate — the reference code only opens the door scanner, which the host
  // can be re-issued by support.
  return generateReferenceCode();
}

/** `chargeableOrderProvider`, as the error type this module's callers already handle. */
function chargeableProvider(): PaymentProvider {
  try {
    return chargeableOrderProvider() === "MOYASAR" ? PaymentProvider.MOYASAR : PaymentProvider.MOCK;
  } catch (err) {
    if (err instanceof PaymentsUnavailableError) throw new OrderError("Payments are not configured");
    throw err;
  }
}

export async function getOwnedOrder(orderId: string, userId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { plan: true, discountCode: { select: { code: true } } },
  });
  if (!order || order.userId !== userId) return null;
  return order;
}

/** Dev/no-keys path: simulates a successful payment instantly. */
export async function confirmMockPayment(orderId: string, userId: string) {
  const order = await getOwnedOrder(orderId, userId);
  if (!order) throw new OrderError("Order not found");
  if (order.status === OrderStatus.PAID) return order;
  if (!isPayableOrderStatus(order.status)) throw new OrderError("Order is not payable");
  // The checkout page only OFFERS this button when there are no Moyasar keys,
  // but a server action is a public endpoint: without these two checks anyone
  // who has ever seen a checkout page could mark their own order paid the day
  // real card payments are switched on. Today both are no-ops (every order is
  // MOCK because no keys are set) — which is exactly when it is cheap to add.
  if (isMoyasarConfigured()) throw new OrderError("Order must be paid by card");
  if (order.provider !== PaymentProvider.MOCK) throw new OrderError("Order must be paid by card");
  // Fail closed in any built deployment: a production with missing keys must
  // not become one where the customer marks her own order paid.
  if (!isMockPaymentAllowed()) throw new OrderError("Payments are not configured");

  // Nothing is charged here, so the code is enforced exactly as for a free order.
  const paid = await markOrderPaid(order.id, `mock_${order.id}`, { enforceCode: true });
  if (!paid) return order;
  await fulfilPaidOrder(paid);
  return paid;
}

/**
 * Where a customer belongs once an order is paid.
 *
 * An invitation order sends them to their events list to create the event it
 * bought. A design fee has nothing to create — the design has just landed on an
 * event they already have — so it sends them to that event, which is the only
 * screen that shows the result.
 */
export async function paidOrderDestination(orderId: string, locale: string): Promise<string> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { kind: true, draftEventId: true, designRequest: { select: { eventId: true } } },
  });
  if (order?.kind === OrderKind.CUSTOM_DESIGN && order.designRequest) {
    return `/${locale}/events/${order.designRequest.eventId}`;
  }
  // Her own invitation's "it worked" screen, naming what she bought.
  //
  // This replaces a redirect to `/events?purchased=1` whose parameter nothing
  // ever read — so the biggest moment in the journey used to land on a list
  // that looked exactly like any other visit.
  if (order?.draftEventId) {
    return `/${locale}/events/${order.draftEventId}/activated?order=${orderId}`;
  }
  return `/${locale}/events`;
}

/** Server-side verification after the Moyasar hosted-form redirect — never trust the redirect status alone. */
export async function confirmMoyasarPayment(orderId: string, userId: string, paymentId: string) {
  const order = await getOwnedOrder(orderId, userId);
  if (!order) throw new OrderError("Order not found");
  if (order.status === OrderStatus.PAID) return order;
  // Only a payable order — PENDING or FAILED — may become PAID.
  //
  // This used to check nothing but "is it already paid", so an order that had
  // been superseded (she changed the guest count) could still be settled later
  // by a stray redirect, a back button, or a webhook arriving after a 3DS
  // timeout. Since exactly one order can activate a draft, that charged a card
  // for something that could never be delivered. FAILED is NOT in that group:
  // a declined card is retried against the same order — see status.ts.
  if (!isPayableOrderStatus(order.status)) throw new OrderError("Order is not payable");

  const payment = await fetchMoyasarPayment(paymentId);
  if (payment.metadata?.order_id !== order.id) throw new OrderError("Payment does not match order");
  if (
    payment.status !== "paid" ||
    payment.amount !== sarToHalalas(Number(order.amount)) ||
    payment.currency?.toUpperCase() !== order.currency.toUpperCase()
  ) {
    logger.warn("orders.moyasar.verification_failed", { orderId, paymentId, status: payment.status });
    await markAttemptFailed(order.id);
    throw new OrderError("Payment could not be verified");
  }

  const paid = await markOrderPaid(order.id, paymentId, { enforceCode: false });
  // Null: the webhook (or another tab) settled it first and fulfilled it.
  if (!paid) return order;
  await fulfilPaidOrder(paid);
  return paid;
}

/**
 * A declined attempt: PENDING becomes FAILED, and nothing else changes.
 *
 * Conditional, never a plain update. With retries allowed, one order can
 * carry several payments, and the verdict on a declined one can land after
 * another payment has already settled the order — an unconditional write here
 * would turn a paid order back into a failed one. FAILED stays FAILED, which
 * is still payable.
 */
async function markAttemptFailed(orderId: string): Promise<void> {
  await prisma.order.updateMany({
    where: { id: orderId, status: OrderStatus.PENDING },
    data: { status: OrderStatus.FAILED },
  });
}

/** Webhook path — trusted via the shared secret, not a logged-in session. */
export async function applyMoyasarWebhookEvent(type: string, paymentId: string, orderId: string | undefined) {
  if (!orderId) return;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status === OrderStatus.PAID) return;
  // Same rule as the redirect path: a CANCELLED or REFUNDED order is closed,
  // and the webhook must not be the way around that.
  if (!isPayableOrderStatus(order.status)) {
    // A PAID payment against a closed order is a card charged for nothing — a
    // refund someone has to make — so it is an error, not a warning.
    const log = type === "payment_paid" ? logger.error : logger.warn;
    log("orders.webhook.not_payable", { orderId, paymentId, status: order.status, type });
    return;
  }

  if (type === "payment_paid") {
    const payment = await fetchMoyasarPayment(paymentId);
    if (
      payment.status === "paid" &&
      payment.amount === sarToHalalas(Number(order.amount)) &&
      payment.currency?.toUpperCase() === order.currency.toUpperCase()
    ) {
      const paid = await markOrderPaid(order.id, paymentId, { enforceCode: false });
      if (paid) await fulfilPaidOrder(paid);
    }
  } else if (type === "payment_failed") {
    await markAttemptFailed(order.id);
  }
}
