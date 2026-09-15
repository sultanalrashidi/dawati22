"use server";

import { redirect } from "next/navigation";
import { requireUserOrThrow } from "@/lib/auth/guards";
import {
  createPerInvitationOrder,
  confirmMockPayment,
  paidOrderDestination,
  repriceOrderWithCode,
  settleFreeOrder,
  OrderError,
} from "@/lib/orders/service";
import { DiscountError } from "@/lib/discounts/service";
import { isValidCodeFormat, normalizeCode } from "@/lib/discounts/rules";
import { isValidInvitationCount, parseTier } from "@/lib/orders/pricing";
import { PaymentProvider, Role } from "@/generated/prisma/client";
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

/**
 * Applies the code she typed at checkout. The invitations are priced again as
 * a fresh order (see repriceOrderWithCode); a refused code leaves her current
 * order untouched and comes back as `?code=<reason>` for the page to explain.
 * A code that leaves nothing to pay activates the invitation on the spot.
 */
export async function applyDiscountCodeAction(orderId: string, locale: string, formData: FormData) {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  const back = `/${safeLocale}/checkout/${orderId}`;
  const typed = String(formData.get("code") ?? "");
  if (!isValidCodeFormat(normalizeCode(typed))) redirect(`${back}?code=unknown`);

  let order: { id: string; provider: PaymentProvider };
  try {
    order = await repriceOrderWithCode(user.id, orderId, typed);
  } catch (err) {
    if (err instanceof DiscountError) redirect(`${back}?code=${err.reason}`);
    if (err instanceof OrderError) redirect(`${back}?error=1`);
    throw err;
  }
  if (order.provider === PaymentProvider.FREE) await settleFreeAndGo(order.id, user.id, safeLocale);
  redirect(`/${safeLocale}/checkout/${order.id}`);
}

/** Takes the code off: the same invitations at today's price, as a fresh order. */
export async function removeDiscountCodeAction(orderId: string, locale: string) {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  let newOrderId: string;
  try {
    newOrderId = (await repriceOrderWithCode(user.id, orderId, null)).id;
  } catch (err) {
    if (err instanceof OrderError) redirect(`/${safeLocale}/checkout/${orderId}?error=1`);
    throw err;
  }
  redirect(`/${safeLocale}/checkout/${newOrderId}`);
}

/** The checkout's own button for a free order that was not settled on the spot. */
export async function settleFreeOrderAction(orderId: string, locale: string) {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  await settleFreeAndGo(orderId, user.id, safeLocale);
}

/**
 * Settles a free order and goes where a paid one goes. A code refused at this
 * last moment — used up by someone else a second earlier — lands back on the
 * order's checkout, which then offers to continue without it.
 */
async function settleFreeAndGo(orderId: string, userId: string, locale: string): Promise<never> {
  try {
    await settleFreeOrder(orderId, userId);
  } catch (err) {
    if (err instanceof DiscountError) redirect(`/${locale}/checkout/${orderId}?code=${err.reason}`);
    if (err instanceof OrderError) redirect(`/${locale}/checkout/${orderId}?error=1`);
    throw err;
  }
  redirect(await paidOrderDestination(orderId, locale));
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
