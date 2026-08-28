"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/guards";
import { setUserBlocked, setEventStatus, updatePricingRate } from "@/lib/admin/service";
import { EventError, updateEventDetails } from "@/lib/events/service";
import { readEventForm } from "@/lib/events/form";
import { Role, EventStatus } from "@/generated/prisma/client";
import { parseTier } from "@/lib/orders/pricing";
import { isLocale, defaultLocale } from "@/lib/i18n/locales";

async function requireAdmin() {
  return requireUserOrThrow([Role.ADMIN]);
}

export async function toggleUserBlockedAction(userId: string, locale: string, blocked: boolean) {
  await requireAdmin();
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  await setUserBlocked(userId, blocked);
  revalidatePath(`/${safeLocale}/admin/users`);
}

export async function cancelEventAction(eventId: string, locale: string) {
  await requireAdmin();
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  await setEventStatus(eventId, EventStatus.ARCHIVED);
  revalidatePath(`/${safeLocale}/admin/events`);
}

export type EventEditState = { error?: string; saved?: boolean } | null;

/**
 * Support's edit of a customer's event. This is the only way the details change
 * after creation — the customer's form is create-only, and the create page says
 * so — so it returns its outcome as state rather than redirecting: the admin
 * stays on the filled-in form and can see what did or did not save.
 */
export async function updateEventDetailsAction(
  eventId: string,
  locale: string,
  _prev: EventEditState,
  formData: FormData,
): Promise<EventEditState> {
  await requireAdmin();

  const fields = readEventForm(formData);
  if (!fields) return { error: "invalid" };

  try {
    await updateEventDetails(eventId, fields);
  } catch (err) {
    if (err instanceof EventError) return { error: err.message };
    throw err;
  }

  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  revalidatePath(`/${safeLocale}/admin/events`);
  revalidatePath(`/${safeLocale}/admin/events/${eventId}`);
  // The owner's own dashboard reads the same row.
  revalidatePath(`/${safeLocale}/events/${eventId}`);
  // And the guests'. The whole promise of this screen is that a corrected name
  // reaches invitations already sent, so the guest route is invalidated too —
  // by pattern, because the tokens are not known here and there can be
  // hundreds. The RSVP action revalidates the same route for the same reason.
  revalidatePath("/i/[token]", "page");
  return { saved: true };
}

export type PricingFormState = { error?: string; saved?: boolean } | null;

/**
 * Sets the price of one invitation for one tier. Takes effect on new orders
 * only — an order freezes its own unitPrice and total at purchase, so nothing
 * already sold moves when this changes.
 */
export async function updatePricingRateAction(
  locale: string,
  _prev: PricingFormState,
  formData: FormData,
): Promise<PricingFormState> {
  await requireAdmin();

  const tier = parseTier(formData.get("tier"));
  const unitPrice = Number(formData.get("unitPrice"));
  if (!tier) return { error: "invalid" };

  try {
    await updatePricingRate(tier, unitPrice);
  } catch {
    return { error: "invalid" };
  }

  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  revalidatePath(`/${safeLocale}/admin/plans`);
  // The public price list reads these rows on every render.
  revalidatePath(`/${safeLocale}/plans`);
  return { saved: true };
}
