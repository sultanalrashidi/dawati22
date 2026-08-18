"use server";

import { redirect } from "next/navigation";
import { requireUserOrThrow } from "@/lib/auth/guards";
import { createEvent, EventError } from "@/lib/events/service";
import { Role, EventType, EventGuestManagementMode } from "@/generated/prisma/client";
import { isLocale, defaultLocale } from "@/lib/i18n/locales";
import { extractYoutubeVideoId } from "@/lib/youtube";

const EVENT_TYPES = new Set(Object.values(EventType));

export async function createEventAction(locale: string, formData: FormData) {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;

  const orderId = String(formData.get("orderId") ?? "");
  const type = String(formData.get("type") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const groomNameEn = String(formData.get("groomNameEn") ?? "").trim();
  const brideNameEn = String(formData.get("brideNameEn") ?? "").trim();
  const groomNameAr = String(formData.get("groomNameAr") ?? "").trim();
  const groomFamilyAr = String(formData.get("groomFamilyAr") ?? "").trim();
  const brideNameAr = String(formData.get("brideNameAr") ?? "").trim();
  const brideFamilyAr = String(formData.get("brideFamilyAr") ?? "").trim();
  const familiesGreetingAr = String(formData.get("familiesGreetingAr") ?? "").trim();
  const invitationTextAr = String(formData.get("invitationTextAr") ?? "").trim();
  const eventDateRaw = String(formData.get("eventDate") ?? "");
  const locationName = String(formData.get("locationName") ?? "").trim();
  const mapUrl = String(formData.get("mapUrl") ?? "").trim();
  const musicUrlRaw = String(formData.get("musicUrl") ?? "").trim();
  const scheduleItemsRaw = String(formData.get("scheduleItems") ?? "").trim();
  const notesAr = String(formData.get("notesAr") ?? "").trim();
  const themeId = String(formData.get("themeId") ?? "");
  const guestManagementMode = String(formData.get("guestManagementMode") ?? "SELF");
  const rsvpRequired = formData.get("rsvpRequired") === "on";

  const musicYoutubeId = musicUrlRaw ? extractYoutubeVideoId(musicUrlRaw) : null;
  const scheduleItems = scheduleItemsRaw
    ? scheduleItemsRaw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [labelAr, time] = line.split("|").map((s) => s.trim());
          return { labelAr: labelAr ?? "", time: time ?? "" };
        })
        .filter((item) => item.labelAr && item.time)
    : undefined;

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
    themeId &&
    (!musicUrlRaw || musicYoutubeId);

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
      groomNameAr: groomNameAr || undefined,
      groomFamilyAr: groomFamilyAr || undefined,
      brideNameAr: brideNameAr || undefined,
      brideFamilyAr: brideFamilyAr || undefined,
      familiesGreetingAr: familiesGreetingAr || undefined,
      invitationTextAr,
      eventDate,
      locationName,
      mapUrl,
      musicYoutubeId: musicYoutubeId ?? undefined,
      scheduleItems,
      notesAr: notesAr || undefined,
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
