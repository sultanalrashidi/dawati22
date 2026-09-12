import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { isUntouchedSample } from "@/lib/drafts/sample";
import { logger } from "@/lib/logger";
import { isMoyasarConfigured, fetchMoyasarPayment, sarToHalalas } from "@/lib/payments/moyasar";
import { EventStatus, OrderKind, OrderStatus, PaymentProvider } from "@/generated/prisma/client";
import type { InvitationTier } from "@/generated/prisma/enums";
import { isValidInvitationCount, totalSar } from "@/lib/orders/pricing";
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

/** The live price list — two rows, one per tier. */
export async function listPricingRates() {
  return prisma.pricingRate.findMany({ orderBy: { unitPrice: "desc" } });
}

/**
 * The only way an order is created.
 *
 * `count` arrives from the browser and is therefore re-validated here; the RATE
 * never crosses the trust boundary at all — it is read from PricingRate and the
 * total is computed server-side, so a customer cannot post a price. That was
 * already true of the old package flow (only a planId was posted) and it has to
 * stay true now that a quantity is posted too.
 */
export async function createPerInvitationOrder(
  userId: string,
  input: { tier: InvitationTier; count: number; draftEventId: string },
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

  const rate = await prisma.pricingRate.findUnique({ where: { tier: input.tier } });
  if (!rate) throw new OrderError("Pricing not available");

  // At most one payable order per draft, ever.
  //
  // Changing the guest count and pressing pay again used to leave the first
  // order sitting there, still payable — and since only ONE order can ever
  // activate the draft, paying the stale one would charge a card and buy
  // literally nothing. Superseding is only half of it; the other half is that
  // CANCELLED can no longer become PAID (see confirmMoyasarPayment). A FAILED
  // order is closed here too, because it is still payable (a declined card can
  // be retried) and would otherwise race the new one.
  await prisma.order.updateMany({
    where: { draftEventId: input.draftEventId, status: { in: PAYABLE_ORDER_STATUSES } },
    data: { status: OrderStatus.CANCELLED },
  });

  return prisma.order.create({
    data: {
      userId,
      // No plan: fixed packages are retired. The order carries its own terms.
      planId: null,
      draftEventId: input.draftEventId,
      invitationCount: input.count,
      tier: input.tier,
      // A frozen copy of today's rate, so re-pricing never re-prices this sale.
      unitPrice: rate.unitPrice,
      amount: totalSar(input.count, Number(rate.unitPrice)),
      currency: rate.currency,
      provider: isMoyasarConfigured() ? PaymentProvider.MOYASAR : PaymentProvider.MOCK,
      idempotencyKey: randomUUID(),
    },
  });
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

export async function getOwnedOrder(orderId: string, userId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { plan: true } });
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

  const paid = await prisma.order.update({
    where: { id: order.id },
    data: { status: OrderStatus.PAID, paidAt: new Date(), providerRef: `mock_${order.id}` },
  });
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

  const paid = await prisma.order.update({
    where: { id: order.id },
    data: { status: OrderStatus.PAID, paidAt: new Date(), providerRef: paymentId },
  });
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
      const paid = await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PAID, paidAt: new Date(), providerRef: paymentId },
      });
      await fulfilPaidOrder(paid);
    }
  } else if (type === "payment_failed") {
    await markAttemptFailed(order.id);
  }
}
