import type { EventFieldDefaults } from "@/components/events/event-fields";
import { couplesFor, type CouplesSource } from "@/lib/events/service";
import { themeOptionKey } from "@/lib/events/theme-options";
import type { ThemeOption } from "@/components/events/theme-picker";
import type { ScheduleItem } from "@/lib/events/types";
import type {
  CoupleFormat,
  EventGuestManagementMode,
  EventType,
  HostMode,
  InvitationOpening,
} from "@/generated/prisma/client";

/**
 * An event row, in the shape the shared field block edits.
 *
 * Extracted because THREE screens now render that block over an existing
 * event: support's admin form, and the customer's own details form before and
 * after payment. Mapping the columns separately in each is how a field ends up
 * saved by one screen and silently ignored by another.
 */

/** Structural, so any query that selected these columns can be passed in. */
export interface EventFieldSource extends CouplesSource {
  type: EventType;
  name: string;
  openingKind: InvitationOpening;
  hostMode: HostMode;
  groomMotherAr: string | null;
  brideMotherAr: string | null;
  hostLineAr: string | null;
  coupleFormat: CoupleFormat;
  invitationTextAr: string;
  eventDate: Date;
  locationName: string;
  regionName: string | null;
  mapUrl: string | null;
  musicYoutubeId: string | null;
  musicAutoplay: boolean;
  scheduleItems: unknown;
  noteNoPhotos: boolean;
  noteNoChildren: boolean;
  noteShowPass: boolean;
  notesAr: string | null;
  closingAr: string | null;
  themeId: string;
  themeVariantId: string | null;
  guestManagementMode: EventGuestManagementMode;
  rsvpRequired: boolean;
  allowGuestPartySize: boolean;
}

export function eventFieldDefaults(
  event: EventFieldSource,
  themeOptions: ThemeOption[],
): EventFieldDefaults {
  // Keep the exact colour she chose. Falling back to the design's default
  // colour only when that precise pair is gone, and to the raw key only when
  // the whole design is — so an archived design never silently moves an
  // invitation onto a different one.
  const exactKey = themeOptionKey(event.themeId, event.themeVariantId);
  const themeKey =
    themeOptions.find((option) => option.key === exactKey)?.key ??
    themeOptions.find((option) => option.themeId === event.themeId)?.key ??
    exactKey;

  return {
    type: event.type,
    name: event.name,
    // couplesFor(), not event.couples: an event created before the EventCouple
    // table existed has no rows, and reading them directly would show a blank
    // name field for a wedding whose names sit on the event row itself.
    couples: couplesFor(event),
    openingKind: event.openingKind,
    hostMode: event.hostMode,
    groomMotherAr: event.groomMotherAr ?? "",
    brideMotherAr: event.brideMotherAr ?? "",
    hostLineAr: event.hostLineAr ?? "",
    coupleFormat: event.coupleFormat,
    invitationTextAr: event.invitationTextAr,
    eventDateLocal: toDateTimeLocal(event.eventDate),
    locationName: event.locationName,
    regionName: event.regionName ?? "",
    mapUrl: event.mapUrl ?? "",
    musicUrl: event.musicYoutubeId ? `https://www.youtube.com/watch?v=${event.musicYoutubeId}` : "",
    musicAutoplay: event.musicAutoplay,
    scheduleText: toScheduleText(event.scheduleItems),
    noteNoPhotos: event.noteNoPhotos,
    noteNoChildren: event.noteNoChildren,
    noteShowPass: event.noteShowPass,
    notesAr: event.notesAr ?? "",
    closingAr: event.closingAr ?? "",
    themeKey,
    guestManagementMode: event.guestManagementMode,
    rsvpRequired: event.rsvpRequired,
    allowGuestPartySize: event.allowGuestPartySize,
  };
}

/**
 * `datetime-local` in the same clock the server reads it back with.
 *
 * Formatting the stored instant through its LOCAL components — rather than
 * through toISOString() — is what makes the value round-trip: `new
 * Date("…T20:00")` on the server parses as local time, so the field has to be
 * written in local time too, or every save would shift the ceremony by the
 * host's UTC offset.
 */
export function toDateTimeLocal(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Back to the one-item-per-line `label|time` shape the textarea edits. */
export function toScheduleText(raw: unknown): string {
  if (!Array.isArray(raw)) return "";
  return (raw as ScheduleItem[])
    .filter((item) => item && typeof item.labelAr === "string" && typeof item.time === "string")
    .map((item) => `${item.labelAr}|${item.time}`)
    .join("\n");
}
