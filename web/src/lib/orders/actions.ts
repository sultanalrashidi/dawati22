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
 * Activate one invitation she has already designed: N invitations at one of the
 * two tiers. Count and tier come from the form and are re-validated here — the
 * client picks WHAT to buy, the server decides what it costs — and the draft is
 * re-checked in createPerInvitationOrder, so an order can never exist without
 * an invitation for it to activate.
 */
export async function createPerInvitationOrderAction(locale: string, formData: FormData) {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;

  const eventId = String(formData.get("eventId") ?? "");
  const tier = parseTier(formData.get("tier"));
  const count = Number(formData.get("count"));
  const back = eventId ? `/${safeLocale}/draft/${eventId}/activate` : `/${safeLocale}/plans`;
  if (!eventId || !tier || !isValidInvitationCount(count)) {
    redirect(`${back}?error=1`);
  }

  let orderId: string;
  try {
    const order = await createPerInvitationOrder(user.id, { tier, count, draftEventId: eventId });
    orderId = order.id;
  } catch (err) {
    if (err instanceof OrderError) redirect(`${back}?error=1`);
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
