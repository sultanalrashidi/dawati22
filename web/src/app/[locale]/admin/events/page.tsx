import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { listEventsAdmin } from "@/lib/admin/service";
import { cancelEventAction } from "@/lib/admin/actions";
import { orderSummaryLabel } from "@/lib/orders/terms";
import { EventGuestManagementMode, GuestManagementRequestStatus } from "@/generated/prisma/enums";

export default async function AdminEventsPage({ params }: PageProps<"/[locale]/admin/events">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const events = await listEventsAdmin();

  // "The customer asked the team to send the invitations, and the team hasn't
  // marked it done." The mode on the event is the source of truth for the ask;
  // the request row only remembers completion — absent row = still pending.
  const teamManaged = (event: (typeof events)[number]) =>
    event.guestManagementMode === EventGuestManagementMode.ADMIN;
  const teamDone = (event: (typeof events)[number]) =>
    event.guestManagementRequest?.status === GuestManagementRequestStatus.COMPLETED;
  const awaitingTeam = events.filter((e) => teamManaged(e) && !teamDone(e)).length;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-fg">{dict.admin.events}</h1>
      {awaitingTeam > 0 && (
        <p className="mt-4 rounded-xl border border-accent/40 bg-accent-soft/15 px-4 py-3 text-sm font-medium text-fg">
          {dict.admin.guestMgmtCounter.replace("{count}", String(awaitingTeam))}
        </p>
      )}
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
                    {dict.admin.owner}: {event.owner?.name ?? dict.admin.ownerNone} · {dict.admin.plan}:{" "}
                    {orderSummaryLabel(event.order, locale, dict)}
                  </p>
                  <p className="text-sm text-fg-muted">
                    {dict.admin.guestsCount}: {event.guests.length} · {dict.admin.metricCheckedIn}: {checkedIn}
                  </p>
                  {teamManaged(event) && (
                    <span
                      className={`mt-1.5 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                        teamDone(event)
                          ? "bg-surface-2 text-fg-muted"
                          : "bg-accent text-accent-fg"
                      }`}
                    >
                      {teamDone(event) ? dict.admin.guestMgmtDone : dict.admin.guestMgmtBadge}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-fg-muted">
                    {event.status}
                  </span>
                  <Link
                    href={`/${locale}/admin/events/${event.id}/guests`}
                    className="text-xs text-accent hover:underline"
                  >
                    {dict.admin.guestsLink}
                  </Link>
                  {/* The customer's form is create-only, so this is the only
                      place a wrong name or date gets corrected. */}
                  <Link
                    href={`/${locale}/admin/events/${event.id}`}
                    className="text-xs text-accent hover:underline"
                  >
                    {dict.admin.editEventData}
                  </Link>
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
