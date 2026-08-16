import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";
import { isMoyasarConfigured, fetchMoyasarPayment, sarToHalalas } from "@/lib/payments/moyasar";
import { OrderStatus, PaymentProvider } from "@/generated/prisma/client";

export class OrderError extends Error {}

export async function createOrder(userId: string, planId: string) {
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan || plan.status !== "ACTIVE") throw new OrderError("Plan not available");

  return prisma.order.create({
    data: {
      userId,
      planId,
      amount: plan.price,
      currency: plan.currency,
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
  if (payment.status !== "paid" || payment.amount !== sarToHalalas(Number(order.amount))) {
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
    if (payment.status === "paid" && payment.amount === sarToHalalas(Number(order.amount))) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PAID, paidAt: new Date(), providerRef: paymentId },
      });
    }
  } else if (type === "payment_failed" && order.status === OrderStatus.PENDING) {
    await prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.FAILED } });
  }
}
