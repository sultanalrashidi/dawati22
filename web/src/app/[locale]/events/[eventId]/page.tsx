import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requireUserOrRedirect } from "@/lib/auth/guards";
import { getOwnedEvent } from "@/lib/events/service";
import { orderTerms } from "@/lib/orders/terms";
import { classifyRsvp } from "@/lib/invitations/service";
import { guestInvitationUrl } from "@/lib/urls";
import { Role } from "@/generated/prisma/client";
import { AddGuestForm } from "@/components/events/add-guest-form";
import { GuestRow } from "@/components/events/guest-row";
import { GatePinForm } from "@/components/events/gate-pin-form";

export default async function EventDetailPage({
  params,
}: PageProps<"/[locale]/events/[eventId]">) {
  const { locale, eventId } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const user = await requireUserOrRedirect(locale, [Role.CUSTOMER]);

  const event = await getOwnedEvent(eventId, user.id);
  if (!event) notFound();

  const capacity = orderTerms(event.order).invitationCount;
  const f = dict.events.detail;

  const rsvpByGuestId = new Map(event.guests.map((g) => [g.id, classifyRsvp(g.invitation?.status)]));
  const accepted = event.guests.filter((g) => rsvpByGuestId.get(g.id) === "accepted").length;
  const declined = event.guests.filter((g) => rsvpByGuestId.get(g.id) === "declined").length;
  const pending = event.guests.length - accepted - declined;
  const remaining = Math.max(0, capacity - event.guests.length);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-fg">{event.name}</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {new Date(event.eventDate).toLocaleString(locale === "ar" ? "ar-SA" : "en-US")} ·{" "}
            {event.locationName}
          </p>
          <p className="mt-1 text-sm text-fg-muted">
            {locale === "ar" ? event.theme.nameAr : event.theme.name}
          </p>
        </div>
        <p className="text-sm text-fg-muted">
          {event.guests.length} / {capacity}
        </p>
      </div>

      {/* There is no customer edit screen for these details — the create form
          warns about that up front, and this is where they come looking. */}
      <p className="mt-4 rounded-xl border border-border bg-surface-2/60 px-4 py-3 text-xs leading-relaxed text-fg-muted">
        {f.dataLockedNotice}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4 text-center">
          <p className="text-2xl font-semibold text-fg">{remaining}</p>
          <p className="mt-1 text-xs text-fg-muted">{f.statsRemaining}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 text-center">
          <p className="text-2xl font-semibold text-success">{accepted}</p>
          <p className="mt-1 text-xs text-fg-muted">{f.rsvpAccepted}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 text-center">
          <p className="text-2xl font-semibold text-danger">{declined}</p>
          <p className="mt-1 text-xs text-fg-muted">{f.rsvpDeclined}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 text-center">
          <p className="text-2xl font-semibold text-fg">{pending}</p>
          <p className="mt-1 text-xs text-fg-muted">{f.rsvpPending}</p>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-fg">{f.guests}</h2>
        <div className="mt-4 flex flex-col gap-3">
          {event.guests.map((guest) => (
            <GuestRow
              key={guest.id}
              eventId={event.id}
              locale={locale}
              dict={dict}
              guest={{
                id: guest.id,
                nameAr: guest.nameAr,
                allowedCount: guest.allowedCount,
                checkedInCount: guest.checkedInCount,
                isBlocked: guest.isBlocked,
              }}
              invitationUrl={guest.invitation ? guestInvitationUrl(guest.invitation.linkToken) : ""}
              waMessage={
                guest.invitation
                  ? `${event.invitationTextAr}\n${guestInvitationUrl(guest.invitation.linkToken)}`
                  : ""
              }
              rsvp={rsvpByGuestId.get(guest.id)}
            />
          ))}
        </div>
        <div className="mt-4">
          <AddGuestForm eventId={event.id} locale={locale} dict={dict} />
        </div>
      </section>

      {/* The whole door section is the QR product: the reference code and the
          guard PIN exist only to open a scanner. On an event sold without a
          scannable pass they would be setup for a flow that refuses every
          scan, so the section is not offered at all. */}
      {event.hasQr && (
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-fg">{f.gateAccessTitle}</h2>
        <p className="mt-1 text-sm text-fg-muted">{f.gateAccessHint}</p>
        <div className="mt-4 flex flex-col gap-3">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-fg-muted">{f.referenceCodeLabel}</p>
            <p dir="ltr" className="mt-1 text-center text-2xl font-semibold tracking-[0.3em] text-fg">
              {event.referenceCode}
            </p>
          </div>
          <GatePinForm eventId={event.id} dict={dict} hasPinSet={Boolean(event.gatePinHash)} />
        </div>
      </section>
      )}
    </div>
  );
}
