import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";
import { isMoyasarConfigured, fetchMoyasarPayment, sarToHalalas } from "@/lib/payments/moyasar";
import { OrderKind, OrderStatus, PaymentProvider } from "@/generated/prisma/client";
import type { InvitationTier } from "@/generated/prisma/enums";
import { isValidInvitationCount, totalSar } from "@/lib/orders/pricing";
import { deliverPaidDesign } from "@/lib/design-requests/service";

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
 * An invitation order needs nothing here: creating the event is what spends it.
 */
async function fulfilPaidOrder(order: { id: string; kind: OrderKind }): Promise<void> {
  if (order.kind !== OrderKind.CUSTOM_DESIGN) return;
  await deliverPaidDesign(order.id);
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
  input: { tier: InvitationTier; count: number },
) {
  if (!isValidInvitationCount(input.count)) throw new OrderError("Invalid invitation count");

  const rate = await prisma.pricingRate.findUnique({ where: { tier: input.tier } });
  if (!rate) throw new OrderError("Pricing not available");

  return prisma.order.create({
    data: {
      userId,
      // No plan: fixed packages are retired. The order carries its own terms.
      planId: null,
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
  if (order.status !== OrderStatus.PENDING) throw new OrderError("Order is not payable");
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
    select: { kind: true, designRequest: { select: { eventId: true } } },
  });
  if (order?.kind === OrderKind.CUSTOM_DESIGN && order.designRequest) {
    return `/${locale}/events/${order.designRequest.eventId}`;
  }
  return `/${locale}/events?purchased=1`;
}

/** Server-side verification after the Moyasar hosted-form redirect — never trust the redirect status alone. */
export async function confirmMoyasarPayment(orderId: string, userId: string, paymentId: string) {
  const order = await getOwnedOrder(orderId, userId);
  if (!order) throw new OrderError("Order not found");
  if (order.status === OrderStatus.PAID) return order;

  const payment = await fetchMoyasarPayment(paymentId);
  if (payment.metadata?.order_id !== order.id) throw new OrderError("Payment does not match order");
  if (
    payment.status !== "paid" ||
    payment.amount !== sarToHalalas(Number(order.amount)) ||
    payment.currency?.toUpperCase() !== order.currency.toUpperCase()
  ) {
    logger.warn("orders.moyasar.verification_failed", { orderId, paymentId, status: payment.status });
    await prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.FAILED } });
    throw new OrderError("Payment could not be verified");
  }

  const paid = await prisma.order.update({
    where: { id: order.id },
    data: { status: OrderStatus.PAID, paidAt: new Date(), providerRef: paymentId },
  });
  await fulfilPaidOrder(paid);
  return paid;
}

/** Webhook path — trusted via the shared secret, not a logged-in session. */
export async function applyMoyasarWebhookEvent(type: string, paymentId: string, orderId: string | undefined) {
  if (!orderId) return;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status === OrderStatus.PAID) return;

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
  } else if (type === "payment_failed" && order.status === OrderStatus.PENDING) {
    await prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.FAILED } });
  }
}
