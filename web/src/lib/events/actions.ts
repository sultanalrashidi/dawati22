"use server";

import { redirect } from "next/navigation";
import { requireUserOrThrow } from "@/lib/auth/guards";
import { createEvent, EventError } from "@/lib/events/service";
import { Role, EventType, EventGuestManagementMode } from "@/generated/prisma/client";
import { isLocale, defaultLocale } from "@/lib/i18n/locales";

const EVENT_TYPES = new Set(Object.values(EventType));

export async function createEventAction(locale: string, formData: FormData) {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;

  const orderId = String(formData.get("orderId") ?? "");
  const type = String(formData.get("type") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const groomNameEn = String(formData.get("groomNameEn") ?? "").trim();
  const brideNameEn = String(formData.get("brideNameEn") ?? "").trim();
  const invitationTextAr = String(formData.get("invitationTextAr") ?? "").trim();
  const eventDateRaw = String(formData.get("eventDate") ?? "");
  const locationName = String(formData.get("locationName") ?? "").trim();
  const mapUrl = String(formData.get("mapUrl") ?? "").trim();
  const themeId = String(formData.get("themeId") ?? "");
  const guestManagementMode = String(formData.get("guestManagementMode") ?? "SELF");
  const rsvpRequired = formData.get("rsvpRequired") === "on";

  const eventDate = new Date(eventDateRaw);
  const isValid =
    orderId &&
    EVENT_TYPES.has(type as EventType) &&
    name.length >= 2 &&
    groomNameEn.length >= 2 &&
    brideNameEn.length >= 2 &&
    invitationTextAr.length >= 5 &&
    !Number.isNaN(eventDate.getTime()) &&
    locationName.length >= 2 &&
    themeId;

  if (!isValid) {
    redirect(`/${safeLocale}/events/new?error=validation&orderId=${orderId}`);
  }

  try {
    const event = await createEvent(user.id, {
      orderId,
      type: type as EventType,
      name,
      groomNameEn,
      brideNameEn,
      invitationTextAr,
      eventDate,
      locationName,
      mapUrl,
      themeId,
      guestManagementMode:
        guestManagementMode === "ADMIN" ? EventGuestManagementMode.ADMIN : EventGuestManagementMode.SELF,
      rsvpRequired,
    });
    redirect(`/${safeLocale}/events/${event.id}`);
  } catch (err) {
    if (err instanceof EventError) {
      redirect(`/${safeLocale}/events/new?error=${encodeURIComponent(err.message)}`);
    }
    throw err;
  }
}
