import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requireUserOrRedirect } from "@/lib/auth/guards";
import { listOwnedEvents, listOwnedDrafts, listEligibleOrders } from "@/lib/events/service";
import { classifyRsvp } from "@/lib/invitations/service";
import { Role } from "@/generated/prisma/client";
import { riyadhDateFormat } from "@/lib/dates";
import { eventCapacity } from "@/lib/events/capacity";

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

  const [events, drafts, eligibleOrders] = await Promise.all([
    listOwnedEvents(user.id),
    listOwnedDrafts(user.id),
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

      {/* Invitations she designed but never paid for. Kept above the paid ones
          because an unfinished thing is what someone comes back to finish — and
          because these are the only ones she can still lose by forgetting. */}
      {drafts.length > 0 && (
        <section className="mt-8">
          <h2 className="text-base font-bold text-fg">{dict.draft.draftsHeading}</h2>
          <p className="mt-1 text-sm text-fg-muted">{dict.draft.draftsHint}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {drafts.map((draft) => (
              <li
                key={draft.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-surface px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-fg">{draft.name}</span>
                  <span className="block text-xs text-fg-muted">
                    {locale === "ar" ? draft.theme.nameAr : draft.theme.name}
                  </span>
                </span>
                <Link
                  href={`/${locale}/draft/${draft.id}/basics`}
                  className="inline-flex h-9 shrink-0 items-center rounded-full border border-accent px-4 text-sm font-bold text-accent transition-colors hover:bg-accent hover:text-accent-fg"
                >
                  {dict.draft.continueDraft}
                </Link>
              </li>
            ))}
          </ul>
        </section>
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
                {riyadhDateFormat(locale === "ar" ? "ar-SA" : "en-US").format(new Date(event.eventDate))}
              </p>
              <p className="text-sm text-fg-muted">
                {dict.events.guestsCount.replace("{count}", String(event.guests.length))}
              </p>
              {(() => {
                const accepted = event.guests.filter((g) => classifyRsvp(g.invitation?.status) === "accepted").length;
                const declined = event.guests.filter((g) => classifyRsvp(g.invitation?.status) === "declined").length;
                // A declined guest gives her slot back — see guests/service.ts
                // addGuest() for the actual enforcement this mirrors.
                const occupiedSlots = event.guests.length - declined;
                const remaining = Math.max(0, eventCapacity(event) - occupiedSlots);
                return (
                  <p className="text-xs text-fg-muted">
                    {dict.events.detail.statsRemaining} {remaining} · {dict.events.detail.rsvpAccepted} {accepted} · {dict.events.detail.rsvpDeclined} {declined}
                  </p>
                );
              })()}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
