import "server-only";
import { EventType, EventGuestManagementMode } from "@/generated/prisma/client";
import { MAX_COUPLES_PER_EVENT } from "@/lib/events/service";
import type { CoupleInput } from "@/lib/themes/builder/content";
import type { ScheduleItem } from "@/lib/events/types";
import { extractYoutubeVideoId } from "@/lib/youtube";

/**
 * One reader for the one event form. The customer fills it in once at creation
 * and support fills the same fields in again from the admin panel, so parsing
 * lives here rather than in either action — a field the two sides read
 * differently is a field where a corrected name silently fails to take.
 */

const EVENT_TYPES = new Set<string>(Object.values(EventType));

/**
 * The repeatable groom+bride block posts one value per pair under each of these
 * names, so the Nth entry of every array belongs to the Nth couple. Empty
 * trailing pairs (a row the customer added and then left blank) are dropped.
 */
export function readCouples(formData: FormData): CoupleInput[] | null {
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

/** Everything the shared field block posts, validated and typed. */
export interface EventFormValues {
  type: EventType;
  name: string;
  couples: CoupleInput[];
  familiesGreetingAr: string;
  invitationTextAr: string;
  eventDate: Date;
  locationName: string;
  regionName: string;
  mapUrl: string;
  musicYoutubeId: string | null;
  musicAutoplay: boolean;
  /** Empty means "no programme"; the writers turn that into a null column. */
  scheduleItems: ScheduleItem[];
  notesAr: string;
  themeId: string;
  /** Empty for a LEGACY theme, whose colours are separate Theme rows. */
  themeVariantId: string | null;
  guestManagementMode: EventGuestManagementMode;
  rsvpRequired: boolean;
  allowGuestPartySize: boolean;
}

/** Returns null when the submission is not usable; the caller decides how to say so. */
export function readEventForm(formData: FormData): EventFormValues | null {
  const text = (field: string) => String(formData.get(field) ?? "").trim();

  const type = text("type");
  const name = text("name");
  const couples = readCouples(formData);
  const invitationTextAr = text("invitationTextAr");
  const locationName = text("locationName");
  const themeId = text("themeId");
  const musicUrlRaw = text("musicUrl");
  const musicYoutubeId = musicUrlRaw ? extractYoutubeVideoId(musicUrlRaw) : null;
  const eventDate = new Date(String(formData.get("eventDate") ?? ""));

  const isValid =
    EVENT_TYPES.has(type) &&
    name.length >= 2 &&
    couples !== null &&
    couples.length >= 1 &&
    invitationTextAr.length >= 5 &&
    !Number.isNaN(eventDate.getTime()) &&
    locationName.length >= 2 &&
    Boolean(themeId) &&
    // A link that is not a YouTube video is a typo, not "no music": dropping it
    // would silently publish the invitation without the song they chose.
    (!musicUrlRaw || Boolean(musicYoutubeId));

  if (!isValid || couples === null) return null;

  const scheduleItems = text("scheduleItems")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [labelAr, time] = line.split("|").map((s) => s.trim());
      return { labelAr: labelAr ?? "", time: time ?? "" };
    })
    .filter((item) => item.labelAr && item.time);

  return {
    type: type as EventType,
    name,
    couples,
    familiesGreetingAr: text("familiesGreetingAr"),
    invitationTextAr,
    eventDate,
    locationName,
    regionName: text("regionName"),
    mapUrl: text("mapUrl"),
    musicYoutubeId,
    musicAutoplay: String(formData.get("musicAutoplay") ?? "manual") === "auto",
    scheduleItems,
    notesAr: text("notesAr"),
    themeId,
    themeVariantId: text("themeVariantId") || null,
    guestManagementMode:
      text("guestManagementMode") === "ADMIN"
        ? EventGuestManagementMode.ADMIN
        : EventGuestManagementMode.SELF,
    rsvpRequired: formData.get("rsvpRequired") === "on",
    allowGuestPartySize: formData.get("allowGuestPartySize") === "on",
  };
}
