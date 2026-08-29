import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { couplesFor, getEventForEdit } from "@/lib/events/service";
import { buildThemeOptions, themeOptionKey } from "@/lib/events/theme-options";
import { EventFields, type EventFieldDefaults } from "@/components/events/event-fields";
import { EventTypeGate } from "@/components/events/event-type-gate";
import { EventEditForm } from "@/components/admin/event-edit-form";
import type { ScheduleItem } from "@/lib/events/types";

/**
 * `datetime-local` in the same clock the server reads it back with. Formatting
 * the stored instant through its local components — rather than through
 * toISOString() — is what makes the value round-trip: `new Date("…T20:00")` on
 * the server parses as local time, so the field has to be written in local time
 * too or every save would shift the ceremony by the host's UTC offset.
 */
function toDateTimeLocal(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Back to the one-item-per-line `label|time` shape the textarea edits. */
function toScheduleText(raw: unknown): string {
  if (!Array.isArray(raw)) return "";
  return (raw as ScheduleItem[])
    .filter((item) => item && typeof item.labelAr === "string" && typeof item.time === "string")
    .map((item) => `${item.labelAr}|${item.time}`)
    .join("\n");
}

export default async function AdminEventEditPage({
  params,
}: PageProps<"/[locale]/admin/events/[eventId]">) {
  const { locale, eventId } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  const event = await getEventForEdit(eventId);
  if (!event) notFound();

  // The owner's id, not the admin's: a design granted privately to this
  // customer has to stay pickable on their own event.
  const themeOptions = await buildThemeOptions(locale, event.ownerId, event.themeId);

  // The picker falls back to its FIRST option when it cannot find the key it
  // was given, which would quietly re-theme somebody's invitation the next time
  // support saved an unrelated typo. The exact key can go missing for real: a
  // colour the event points at may since have been deleted from the design.
  // Falling back to another colour OF THE SAME DESIGN keeps the artwork the
  // customer chose; only if the whole design is gone does the picker choose.
  const exactKey = themeOptionKey(event.themeId, event.themeVariantId);
  const preselectedThemeKey =
    themeOptions.find((option) => option.key === exactKey)?.key ??
    themeOptions.find((option) => option.themeId === event.themeId)?.key ??
    exactKey;

  const defaults: EventFieldDefaults = {
    type: event.type,
    name: event.name,
    // couplesFor(), not event.couples: an event created before the EventCouple
    // table existed has no rows, and reading them directly would hand support a
    // blank name field for a wedding that has a groom and bride on the row
    // itself.
    couples: couplesFor(event),
    familiesGreetingAr: event.familiesGreetingAr ?? "",
    invitationTextAr: event.invitationTextAr,
    eventDateLocal: toDateTimeLocal(event.eventDate),
    locationName: event.locationName,
    regionName: event.regionName ?? "",
    mapUrl: event.mapUrl ?? "",
    musicUrl: event.musicYoutubeId ? `https://www.youtube.com/watch?v=${event.musicYoutubeId}` : "",
    musicAutoplay: event.musicAutoplay,
    scheduleText: toScheduleText(event.scheduleItems),
    notesAr: event.notesAr ?? "",
    themeKey: preselectedThemeKey,
    guestManagementMode: event.guestManagementMode,
    rsvpRequired: event.rsvpRequired,
    allowGuestPartySize: event.allowGuestPartySize,
  };

  const a = dict.admin;

  return (
    <div className="max-w-2xl">
      <Link href={`/${locale}/admin/events`} className="text-sm text-fg-muted hover:text-fg">
        ← {a.backToEvents}
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-fg">{a.eventEditTitle}</h1>
      <p className="mt-1 text-sm text-fg-muted">
        {event.name} · {a.owner}: {event.owner.name}
        {event.owner.phone ? ` · ${event.owner.phone}` : ""}
      </p>

      <p className="mt-4 rounded-xl border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-fg-muted">
        {a.eventEditNote}
      </p>

      <EventEditForm eventId={event.id} locale={locale} dict={dict}>
        {/* `enabled={false}`: the "weddings only" gate is a sales rule for the
            customer's create form. Support must be able to open and correct an
            event whatever its type says, not be locked out by it. */}
        <EventTypeGate dict={dict} defaultType={defaults.type} enabled={false}>
          <EventFields dict={dict} themeOptions={themeOptions} defaults={defaults} />
        </EventTypeGate>
      </EventEditForm>
    </div>
  );
}
