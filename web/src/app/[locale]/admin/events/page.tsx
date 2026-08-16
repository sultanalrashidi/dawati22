import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { listEventsAdmin } from "@/lib/admin/service";
import { cancelEventAction } from "@/lib/admin/actions";

export default async function AdminEventsPage({ params }: PageProps<"/[locale]/admin/events">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const events = await listEventsAdmin();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-fg">{dict.admin.events}</h1>
      <div className="mt-6 flex flex-col gap-2">
        {events.map((event) => {
          const checkedIn = event.guests.reduce((sum, g) => sum + g.checkedInCount, 0);
          const boundCancel = cancelEventAction.bind(null, event.id, locale);
          return (
            <div key={event.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-fg">{event.name}</p>
                  <p className="text-sm text-fg-muted">
                    {dict.admin.owner}: {event.owner.name} · {dict.admin.plan}:{" "}
                    {locale === "ar" ? event.order.plan.nameAr : event.order.plan.name}
                  </p>
                  <p className="text-sm text-fg-muted">
                    {dict.admin.guestsCount}: {event.guests.length} · {dict.admin.metricCheckedIn}: {checkedIn}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-fg-muted">
                    {event.status}
                  </span>
                  {event.status !== "ARCHIVED" && (
                    <form action={boundCancel}>
                      <button type="submit" className="text-xs text-danger hover:underline">
                        {dict.admin.cancel}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
