"use server";

import { redirect } from "next/navigation";
import { requireUserOrThrow } from "@/lib/auth/guards";
import { createEvent, EventError, MAX_COUPLES_PER_EVENT } from "@/lib/events/service";
import type { CoupleInput } from "@/lib/themes/builder/content";
import { Role, EventType, EventGuestManagementMode } from "@/generated/prisma/client";
import { isLocale, defaultLocale } from "@/lib/i18n/locales";
import { extractYoutubeVideoId } from "@/lib/youtube";

const EVENT_TYPES = new Set(Object.values(EventType));

/**
 * The repeatable groom+bride block posts one value per pair under each of these
 * names, so the Nth entry of every array belongs to the Nth couple. Empty
 * trailing pairs (a row the customer added and then left blank) are dropped.
 */
function readCouples(formData: FormData): CoupleInput[] | null {
  const at = (field: string) => formData.getAll(field).map((v) => String(v).trim());
  const groomNamesEn = at("coupleGroomNameEn");
  const brideNamesEn = at("coupleBrideNameEn");
  const groomNamesAr = at("coupleGroomNameAr");
  const groomFamiliesAr = at("coupleGroomFamilyAr");
  const brideNamesAr = at("coupleBrideNameAr");
  const brideFamiliesAr = at("coupleBrideFamilyAr");

  const submitted = Math.max(groomNamesEn.length, brideNamesEn.length);
  // Reject rather than truncate: silently keeping the first six of eight
  // submitted pairs would drop two real couples from a wedding invitation and
  // still report success.
  if (submitted > MAX_COUPLES_PER_EVENT) return null;

  const couples: CoupleInput[] = [];
  for (let i = 0; i < submitted; i++) {
    const row = [
      groomNamesEn[i] ?? "",
      brideNamesEn[i] ?? "",
      groomNamesAr[i] ?? "",
      groomFamiliesAr[i] ?? "",
      brideNamesAr[i] ?? "",
      brideFamiliesAr[i] ?? "",
    ];
    // A row the customer added and left completely blank is just noise — drop
    // it. A row with *something* in it is an attempt at a real couple, so a
    // missing English name is an error the customer must see, not a pair we
    // quietly discard along with the Arabic names they did fill in.
    if (row.every((value) => value.length === 0)) continue;

    const groomNameEn = groomNamesEn[i] ?? "";
    const brideNameEn = brideNamesEn[i] ?? "";
    if (groomNameEn.length < 2 || brideNameEn.length < 2) return null;

    couples.push({
      groomNameEn,
      brideNameEn,
      groomNameAr: groomNamesAr[i] || null,
      groomFamilyAr: groomFamiliesAr[i] || null,
      brideNameAr: brideNamesAr[i] || null,
      brideFamilyAr: brideFamiliesAr[i] || null,
    });
  }
  return couples;
}

export async function createEventAction(locale: string, formData: FormData) {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;

  const orderId = String(formData.get("orderId") ?? "");
  const type = String(formData.get("type") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const couples = readCouples(formData);
  const familiesGreetingAr = String(formData.get("familiesGreetingAr") ?? "").trim();
  const invitationTextAr = String(formData.get("invitationTextAr") ?? "").trim();
  const eventDateRaw = String(formData.get("eventDate") ?? "");
  const locationName = String(formData.get("locationName") ?? "").trim();
  const regionName = String(formData.get("regionName") ?? "").trim();
  const mapUrl = String(formData.get("mapUrl") ?? "").trim();
  const musicUrlRaw = String(formData.get("musicUrl") ?? "").trim();
  const musicAutoplay = String(formData.get("musicAutoplay") ?? "manual") === "auto";
  const scheduleItemsRaw = String(formData.get("scheduleItems") ?? "").trim();
  const notesAr = String(formData.get("notesAr") ?? "").trim();
  const themeId = String(formData.get("themeId") ?? "");
  // Empty for a LEGACY theme, whose colours are separate Theme rows.
  const themeVariantId = String(formData.get("themeVariantId") ?? "").trim() || null;
  const guestManagementMode = String(formData.get("guestManagementMode") ?? "SELF");
  const rsvpRequired = formData.get("rsvpRequired") === "on";
  const allowGuestPartySize = formData.get("allowGuestPartySize") === "on";

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
    couples !== null &&
    couples.length >= 1 &&
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
      couples,
      familiesGreetingAr: familiesGreetingAr || undefined,
      invitationTextAr,
      eventDate,
      locationName,
      regionName: regionName || undefined,
      mapUrl,
      musicYoutubeId: musicYoutubeId ?? undefined,
      musicAutoplay,
      scheduleItems,
      notesAr: notesAr || undefined,
      themeId,
      themeVariantId,
      guestManagementMode:
        guestManagementMode === "ADMIN" ? EventGuestManagementMode.ADMIN : EventGuestManagementMode.SELF,
      rsvpRequired,
      allowGuestPartySize,
    });
    redirect(`/${safeLocale}/events/${event.id}`);
  } catch (err) {
    if (err instanceof EventError) {
      redirect(`/${safeLocale}/events/new?error=${encodeURIComponent(err.message)}`);
    }
    throw err;
  }
}
