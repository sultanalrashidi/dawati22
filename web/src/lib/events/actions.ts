"use server";

import { redirect } from "next/navigation";
import { requireUserOrThrow } from "@/lib/auth/guards";
import { createEvent, EventError } from "@/lib/events/service";
import { readEventForm } from "@/lib/events/form";
import { Role } from "@/generated/prisma/client";
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

  if (!orderId || !fields || !confirmed) {
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
