import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getEventForEdit } from "@/lib/events/service";
import { buildThemeOptions } from "@/lib/events/theme-options";
import { EventFields } from "@/components/events/event-fields";
import { eventFieldDefaults } from "@/lib/events/field-defaults";
import { EventTypeGate } from "@/components/events/event-type-gate";
import { EventEditForm } from "@/components/admin/event-edit-form";

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
  const defaults = eventFieldDefaults(event, themeOptions);

  const a = dict.admin;

  return (
    <div className="max-w-2xl">
      <Link href={`/${locale}/admin/events`} className="text-sm text-fg-muted hover:text-fg">
        ← {a.backToEvents}
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-fg">{a.eventEditTitle}</h1>
      <p className="mt-1 text-sm text-fg-muted">
        {event.name} · {a.owner}: {event.owner?.name ?? a.ownerNone}
        {event.owner?.phone ? ` · ${event.owner.phone}` : ""}
      </p>

      <p className="mt-4 rounded-xl border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-fg-muted">
        {a.eventEditNote}
      </p>

      <EventEditForm eventId={event.id} locale={locale} dict={dict}>
        {/* `enabled={false}`: the "weddings only" gate is a sales rule for the
            customer's create form. Support must be able to open and correct an
            event whatever its type says, not be locked out by it. */}
        <EventTypeGate dict={dict} defaultType={defaults.type} enabled={false}>
          <EventFields locale={locale} dict={dict} themeOptions={themeOptions} defaults={defaults} />
        </EventTypeGate>
      </EventEditForm>
    </div>
  );
}
