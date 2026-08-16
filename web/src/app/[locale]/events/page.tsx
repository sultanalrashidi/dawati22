import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requireUserOrRedirect } from "@/lib/auth/guards";
import { listOwnedEvents, listEligibleOrders } from "@/lib/events/service";
import { Role } from "@/generated/prisma/client";

const STATUS_LABEL_KEY = {
  DRAFT: "statusDraft",
  PUBLISHED: "statusPublished",
  ARCHIVED: "statusArchived",
} as const;

export default async function EventsPage({ params }: PageProps<"/[locale]/events">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const user = await requireUserOrRedirect(locale, [Role.CUSTOMER]);

  const [events, eligibleOrders] = await Promise.all([
    listOwnedEvents(user.id),
    listEligibleOrders(user.id),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-fg">{dict.events.title}</h1>
        {eligibleOrders.length > 0 && (
          <Link
            href={`/${locale}/events/new?orderId=${eligibleOrders[0].id}`}
            className="h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong inline-flex"
          >
            {dict.events.createEvent}
          </Link>
        )}
      </div>

      {eligibleOrders.length > 0 && (
        <p className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-sm text-fg">{dict.events.readyBanner}</p>
      )}

      {events.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-4 text-center">
          <p className="text-fg-muted">
            {eligibleOrders.length > 0 ? dict.events.empty : dict.events.emptyNoPlan}
          </p>
          {eligibleOrders.length === 0 && (
            <Link
              href={`/${locale}/plans`}
              className="h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-fg transition-colors hover:bg-surface-2 inline-flex"
            >
              {dict.events.browsePlans}
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/${locale}/events/${event.id}`}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-fg">{event.name}</h3>
                <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-fg-muted">
                  {dict.events[STATUS_LABEL_KEY[event.status]]}
                </span>
              </div>
              <p className="text-sm text-fg-muted">
                {new Date(event.eventDate).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}
              </p>
              <p className="text-sm text-fg-muted">
                {dict.events.guestsCount.replace("{count}", String(event.guests.length))}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
