"use server";

import { redirect } from "next/navigation";
import { requireUserOrThrow } from "@/lib/auth/guards";
import { createOrder, confirmMockPayment, OrderError } from "@/lib/orders/service";
import { Role } from "@/generated/prisma/client";
import { isLocale, defaultLocale } from "@/lib/i18n/locales";

export async function createOrderAction(planId: string, locale: string) {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  const order = await createOrder(user.id, planId);
  redirect(`/${safeLocale}/checkout/${order.id}`);
}

export async function confirmMockPaymentAction(orderId: string, locale: string) {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  try {
    await confirmMockPayment(orderId, user.id);
  } catch (err) {
    if (err instanceof OrderError) redirect(`/${safeLocale}/checkout/${orderId}?error=1`);
    throw err;
  }
  redirect(`/${safeLocale}/events?purchased=1`);
}
