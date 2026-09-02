import "server-only";
import { EventType, EventGuestManagementMode } from "@/generated/prisma/client";
import { MAX_COUPLES_PER_EVENT } from "@/lib/events/service";
import {
  COUPLE_FORMAT_KINDS,
  HOST_MODE_KINDS,
  INVITATION_OPENING_KINDS,
  type CoupleInput,
  type InvitationTextFields,
} from "@/lib/themes/builder/content";
import type { ScheduleItem } from "@/lib/events/types";
import type { DesignBrief } from "@/lib/design-requests/service";
import { extractYoutubeVideoId } from "@/lib/youtube";

/**
 * One reader for the one event form. The customer fills it in once at creation
 * and support fills the same fields in again from the admin panel, so parsing
 * lives here rather than in either action — a field the two sides read
 * differently is a field where a corrected name silently fails to take.
 */

const EVENT_TYPES = new Set<string>(Object.values(EventType));

/** A posted string is one of the allowed kinds, narrowed to that union. */
function isOneOf<T extends string>(kinds: readonly T[], value: string): value is T {
  return (kinds as readonly string[]).includes(value);
}

/**
 * The repeatable bride+groom block posts one value per pair under each of these
 * names, so the Nth entry of every array belongs to the Nth couple. Empty
 * trailing pairs (a row the customer added and then left blank) are dropped.
 *
 * The Arabic given names are what the invitation prints, so they are the
 * required ones; the English names are optional and may be "".
 */
export function readCouples(formData: FormData): CoupleInput[] | null {
  const at = (field: string) => formData.getAll(field).map((v) => String(v).trim());
  const brideNamesAr = at("coupleBrideNameAr");
  const brideFamiliesAr = at("coupleBrideFamilyAr");
  const brideNamesEn = at("coupleBrideNameEn");
  const groomNamesAr = at("coupleGroomNameAr");
  const groomFamiliesAr = at("coupleGroomFamilyAr");
  const groomNamesEn = at("coupleGroomNameEn");

  const columns = [brideNamesAr, brideFamiliesAr, brideNamesEn, groomNamesAr, groomFamiliesAr, groomNamesEn];
  const submitted = Math.max(...columns.map((column) => column.length));
  // Reject rather than truncate: silently keeping the first six of eight
  // submitted pairs would drop two real couples from a wedding invitation and
  // still report success.
  if (submitted > MAX_COUPLES_PER_EVENT) return null;

  const couples: CoupleInput[] = [];
  for (let i = 0; i < submitted; i++) {
    const row = columns.map((column) => column[i] ?? "");
    // A row the customer added and left completely blank is just noise — drop
    // it. A row with *something* in it is an attempt at a real couple, so a
    // missing Arabic name is an error the customer must see, not a pair we
    // quietly discard along with the names they did fill in.
    if (row.every((value) => value.length === 0)) continue;

    const brideNameAr = brideNamesAr[i] ?? "";
    const groomNameAr = groomNamesAr[i] ?? "";
    if (brideNameAr.length < 2 || groomNameAr.length < 2) return null;

    couples.push({
      groomNameEn: groomNamesEn[i] ?? "",
      brideNameEn: brideNamesEn[i] ?? "",
      groomNameAr,
      groomFamilyAr: groomFamiliesAr[i] || null,
      brideNameAr,
      brideFamilyAr: brideFamiliesAr[i] || null,
    });
  }
  return couples;
}

/**
 * Everything the shared field block posts, validated and typed. The wording
 * columns (`InvitationTextFields`) are the same shape the renderer and the
 * share texts read, so what the form saves is exactly what prints.
 */
export interface EventFormValues extends InvitationTextFields {
  type: EventType;
  name: string;
  couples: CoupleInput[];
  /** Optional extra text under the composed invitation line; "" when unused. */
  invitationTextAr: string;
  eventDate: Date;
  locationName: string;
  regionName: string;
  mapUrl: string;
  musicYoutubeId: string | null;
  musicAutoplay: boolean;
  /** Empty means "no programme"; the writers turn that into a null column. */
  scheduleItems: ScheduleItem[];
  /** The three standard guest notes, printed before the free notes when on. */
  noteNoPhotos: boolean;
  noteNoChildren: boolean;
  noteShowPass: boolean;
  notesAr: string;
  themeId: string;
  /** Empty for a LEGACY theme, whose colours are separate Theme rows. */
  themeVariantId: string | null;
  guestManagementMode: EventGuestManagementMode;
  rsvpRequired: boolean;
  allowGuestPartySize: boolean;
  /**
   * Present only when the customer ticked "design one for me" in the picker.
   * Null is the normal case and means nothing about the event changes.
   */
  designBrief: DesignBrief | null;
}

type HostValues = Pick<InvitationTextFields, "hostMode" | "groomMotherAr" | "brideMotherAr" | "hostLineAr">;

/**
 * The host (الداعي) block, or null when it is not usable.
 *
 * Both modes' inputs are posted — the form keeps the inactive block mounted so
 * nothing typed is lost when switching — but only the chosen mode's fields are
 * validated and kept. The other mode's columns are nulled rather than stored,
 * so the row never carries a host line that does not print.
 */
function readHost(formData: FormData): HostValues | null {
  const text = (field: string) => String(formData.get(field) ?? "").trim();
  const hostMode = text("hostMode");
  if (!isOneOf(HOST_MODE_KINDS, hostMode)) return null;

  if (hostMode === "TEMPLATE") {
    const groomMotherAr = text("groomMotherAr");
    const brideMotherAr = text("brideMotherAr");
    if (groomMotherAr.length < 2 || brideMotherAr.length < 2) return null;
    return { hostMode, groomMotherAr, brideMotherAr, hostLineAr: null };
  }

  const hostLineAr = text("hostLineAr");
  if (hostLineAr.length < 5) return null;
  return { hostMode, groomMotherAr: null, brideMotherAr: null, hostLineAr };
}

/**
 * The brief, or null.
 *
 * Only read when the box is ticked: a customer who opened the panel, typed
 * something and then changed their mind must not be billed 150 riyals for a
 * design they decided against.
 */
function readDesignBrief(formData: FormData): DesignBrief | null {
  if (formData.get("requestCustomDesign") !== "on") return null;
  return {
    colorTags: formData.getAll("designColorTags").map((v) => String(v)),
    styleCategory: String(formData.get("designStyle") ?? "") || null,
    inspirationThemeId: String(formData.get("designInspirationThemeId") ?? "") || null,
    notes: String(formData.get("designNotes") ?? ""),
  };
}

/** Returns null when the submission is not usable; the caller decides how to say so. */
export function readEventForm(formData: FormData): EventFormValues | null {
  const text = (field: string) => String(formData.get(field) ?? "").trim();
  const checked = (field: string) => formData.get(field) === "on";

  const type = text("type");
  const name = text("name");
  const openingKind = text("openingKind");
  const host = readHost(formData);
  const couples = readCouples(formData);
  const coupleFormat = text("coupleFormat");
  const locationName = text("locationName");
  const themeId = text("themeId");
  const musicUrlRaw = text("musicUrl");
  const musicYoutubeId = musicUrlRaw ? extractYoutubeVideoId(musicUrlRaw) : null;
  const eventDate = new Date(String(formData.get("eventDate") ?? ""));

  const isValid =
    EVENT_TYPES.has(type) &&
    name.length >= 2 &&
    isOneOf(INVITATION_OPENING_KINDS, openingKind) &&
    host !== null &&
    couples !== null &&
    couples.length >= 1 &&
    isOneOf(COUPLE_FORMAT_KINDS, coupleFormat) &&
    !Number.isNaN(eventDate.getTime()) &&
    locationName.length >= 2 &&
    Boolean(themeId) &&
    // A link that is not a YouTube video is a typo, not "no music": dropping it
    // would silently publish the invitation without the song they chose.
    (!musicUrlRaw || Boolean(musicYoutubeId));

  if (
    !isValid ||
    host === null ||
    couples === null ||
    !isOneOf(INVITATION_OPENING_KINDS, openingKind) ||
    !isOneOf(COUPLE_FORMAT_KINDS, coupleFormat)
  ) {
    return null;
  }

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
    openingKind,
    ...host,
    couples,
    coupleFormat,
    invitationTextAr: text("invitationTextAr"),
    eventDate,
    locationName,
    regionName: text("regionName"),
    mapUrl: text("mapUrl"),
    musicYoutubeId,
    musicAutoplay: String(formData.get("musicAutoplay") ?? "manual") === "auto",
    scheduleItems,
    noteNoPhotos: checked("noteNoPhotos"),
    noteNoChildren: checked("noteNoChildren"),
    noteShowPass: checked("noteShowPass"),
    notesAr: text("notesAr"),
    // Empty means "the default preset" — the renderer falls back to it, so the
    // row does not store a copy that would go stale if the preset changed.
    closingAr: text("closingAr") || null,
    themeId,
    themeVariantId: text("themeVariantId") || null,
    guestManagementMode:
      text("guestManagementMode") === "ADMIN"
        ? EventGuestManagementMode.ADMIN
        : EventGuestManagementMode.SELF,
    rsvpRequired: checked("rsvpRequired"),
    allowGuestPartySize: checked("allowGuestPartySize"),
    designBrief: readDesignBrief(formData),
  };
}
