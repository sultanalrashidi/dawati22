import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";
import { isMoyasarConfigured, fetchMoyasarPayment, sarToHalalas } from "@/lib/payments/moyasar";
import { OrderStatus, PaymentProvider } from "@/generated/prisma/client";
import type { InvitationTier } from "@/generated/prisma/enums";
import { isValidInvitationCount, totalSar } from "@/lib/orders/pricing";

export class OrderError extends Error {}

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

  return prisma.order.update({
    where: { id: order.id },
    data: { status: OrderStatus.PAID, paidAt: new Date(), providerRef: `mock_${order.id}` },
  });
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

  return prisma.order.update({
    where: { id: order.id },
    data: { status: OrderStatus.PAID, paidAt: new Date(), providerRef: paymentId },
  });
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
      await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PAID, paidAt: new Date(), providerRef: paymentId },
      });
    }
  } else if (type === "payment_failed" && order.status === OrderStatus.PENDING) {
    await prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.FAILED } });
  }
}
