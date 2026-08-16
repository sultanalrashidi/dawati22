import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requireUserOrRedirect } from "@/lib/auth/guards";
import { getOwnedEvent } from "@/lib/events/service";
import { guestInvitationUrl } from "@/lib/urls";
import { Role } from "@/generated/prisma/client";
import { AddGuestForm } from "@/components/events/add-guest-form";
import { GuestRow } from "@/components/events/guest-row";
import { AddGateStaffForm } from "@/components/events/add-gate-staff-form";
import { revokeGateStaffAction } from "@/lib/gatestaff/actions";

export default async function EventDetailPage({
  params,
}: PageProps<"/[locale]/events/[eventId]">) {
  const { locale, eventId } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const user = await requireUserOrRedirect(locale, [Role.CUSTOMER]);

  const event = await getOwnedEvent(eventId, user.id);
  if (!event) notFound();

  const capacity = event.order.plan.invitationCount;
  const f = dict.events.detail;

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
            />
          ))}
        </div>
        <div className="mt-4">
          <AddGuestForm eventId={event.id} locale={locale} dict={dict} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-fg">{f.gateStaffTitle}</h2>
        <div className="mt-4 flex flex-col gap-2">
          {event.gateStaffAssignments.map((assignment) => {
            const boundRevoke = revokeGateStaffAction.bind(null, assignment.id, event.id, locale);
            return (
              <div
                key={assignment.id}
                className="flex items-center justify-between rounded-xl border border-border bg-surface p-3"
              >
                <p className="text-sm text-fg">{assignment.gateStaff.user.name}</p>
                <form action={boundRevoke}>
                  <button type="submit" className="text-xs text-danger hover:underline">
                    {f.remove}
                  </button>
                </form>
              </div>
            );
          })}
        </div>
        <div className="mt-4">
          <AddGateStaffForm
            eventId={event.id}
            locale={locale}
            dict={dict}
            disabled={event.gateStaffAssignments.length >= 4}
          />
        </div>
      </section>
    </div>
  );
}
