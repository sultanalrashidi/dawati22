"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/guards";
import {
  createEvent,
  updateOwnedEventDetails,
  EventError,
  EventLockedError,
} from "@/lib/events/service";
import { readEventForm } from "@/lib/events/form";
import { EventType, Role } from "@/generated/prisma/client";
import { isLocale, defaultLocale } from "@/lib/i18n/locales";

export async function createEventAction(locale: string, formData: FormData) {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;

  const orderId = String(formData.get("orderId") ?? "");
  const fields = readEventForm(formData);
  // The accuracy tick is the customer's own record that they checked the names
  // before the one form that writes them. The checkbox is `required`, so this
  // only ever fires for a submission that went around the browser.
  const confirmed = formData.get("confirmAccuracy") === "on";

  // Weddings are the only occasion the product actually delivers — the form
  // below the type select asks for a groom and a bride and offers wedding
  // artwork. The UI replaces that form with "coming soon" for anything else,
  // but a <select> is only a value the browser posts, so the rule is enforced
  // here as well or it is not a rule.
  const supported = !fields || fields.type === EventType.WEDDING;

  if (!orderId || !fields || !confirmed || !supported) {
    redirect(`/${safeLocale}/events/new?error=validation&orderId=${orderId}`);
  }

  try {
    const event = await createEvent(user.id, { orderId, ...fields });
    redirect(`/${safeLocale}/events/${event.id}`);
  } catch (err) {
    if (err instanceof EventError) {
      redirect(`/${safeLocale}/events/new?error=${encodeURIComponent(err.message)}`);
    }
    throw err;
  }
}

export type EventSelfEditState = { error?: "invalid" | "locked" | "unsupported" } | null;

/**
 * The customer editing her own paid invitation, before any of it has gone out.
 *
 * Reports in place rather than redirecting with `?error=`, for the reason the
 * admin form gives: this is fifteen fields, and a save refused by the lock
 * must leave her looking at what she typed. `redirect()` on success still
 * works from inside a `useActionState` action.
 */
export async function saveOwnedEventDetailsAction(
  eventId: string,
  locale: string,
  _prev: EventSelfEditState,
  formData: FormData,
): Promise<EventSelfEditState> {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;

  const fields = readEventForm(formData);
  if (!fields) return { error: "invalid" };
  // The page pins this with a hidden input, and a hidden input is only a value
  // the browser posts — the same reason createEventAction re-checks it.
  if (fields.type !== EventType.WEDDING) return { error: "unsupported" };

  try {
    await updateOwnedEventDetails(eventId, user.id, fields);
  } catch (err) {
    if (err instanceof EventLockedError) return { error: "locked" };
    if (err instanceof EventError) return { error: "invalid" };
    throw err;
  }

  revalidatePath(`/${safeLocale}/events/${eventId}`);
  revalidatePath(`/${safeLocale}/events/${eventId}/details`);
  // The guest pages print these columns. Harmless while nothing has been sent,
  // and correct the moment support reopens a locked event.
  revalidatePath("/i/[token]", "page");
  redirect(`/preview/${eventId}`);
}
