"use server";

import { redirect } from "next/navigation";
import { requireUserOrThrow } from "@/lib/auth/guards";
import {
  createPerInvitationOrder,
  confirmMockPayment,
  paidOrderDestination,
  OrderError,
} from "@/lib/orders/service";
import { isValidInvitationCount, parseTier } from "@/lib/orders/pricing";
import { Role } from "@/generated/prisma/client";
import { isLocale, defaultLocale } from "@/lib/i18n/locales";

/**
 * Buy N invitations at one of the two tiers. The count and the tier come from
 * the pricing calculator as real form fields, so both are re-validated here —
 * the client picks WHAT to buy, the server decides what it costs.
 */
export async function createPerInvitationOrderAction(locale: string, formData: FormData) {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;

  const tier = parseTier(formData.get("tier"));
  const count = Number(formData.get("count"));
  if (!tier || !isValidInvitationCount(count)) {
    redirect(`/${safeLocale}/plans?error=1`);
  }

  let orderId: string;
  try {
    const order = await createPerInvitationOrder(user.id, { tier, count });
    orderId = order.id;
  } catch (err) {
    if (err instanceof OrderError) redirect(`/${safeLocale}/plans?error=1`);
    throw err;
  }
  redirect(`/${safeLocale}/checkout/${orderId}`);
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
  redirect(await paidOrderDestination(orderId, safeLocale));
}
