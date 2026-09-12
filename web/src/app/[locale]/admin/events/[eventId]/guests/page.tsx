import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getEventAdmin } from "@/lib/admin/service";
import {
  toggleGuestMgmtDoneAction,
  markAllInvitationsSharedAdminAction,
} from "@/lib/admin/actions";
import { classifyRsvp } from "@/lib/invitations/service";
import { guestInvitationUrl } from "@/lib/urls";
import { invitationShareText } from "@/lib/events/share-text";
import { normalizeGuestPhone } from "@/lib/security/phone";
import { CopyTextButton } from "@/components/admin/copy-text-button";
import { GuestShareCell } from "@/components/admin/guest-share-cell";
import { EventGuestManagementMode, GuestManagementRequestStatus } from "@/generated/prisma/enums";

/**
 * The team's side of "let Dawati handle my guests": every guest the customer
 * added, with the invitation link and a WhatsApp button per row, so support
 * can send each invitation from the store's own WhatsApp — and mark the event
 * done when the last one is out. Read-only on purpose: the guest list stays
 * the customer's to edit, this page only ships it.
 */
export default async function AdminEventGuestsPage({
  params,
}: PageProps<"/[locale]/admin/events/[eventId]/guests">) {
  const { locale, eventId } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const a = dict.admin;
  const d = dict.events.detail;

  const event = await getEventAdmin(eventId);
  if (!event) notFound();

  const teamManaged = event.guestManagementMode === EventGuestManagementMode.ADMIN;
  const done = event.guestManagementRequest?.status === GuestManagementRequestStatus.COMPLETED;
  const boundToggleDone = toggleGuestMgmtDoneAction.bind(null, event.id, locale, !done);

  // The line above the link in every WhatsApp message: the host's extra text
  // if she wrote one, else the composed invitation sentence. One per event,
  // not per guest.
  const shareText = invitationShareText(event);

  const rows = event.guests.map((guest) => {
    const invitation = guest.invitation;
    const url = invitation ? guestInvitationUrl(invitation.linkToken) : null;
    const waMessage = url ? `${shareText}\n${url}` : null;
    // Send straight to the guest's own number when it reads as one — a Saudi
    // number in any shape, or any country written with its code. Anything
    // else falls back to WhatsApp's share screen rather than risking a guessed
    // international prefix putting the invitation in a stranger's chat.
    const waTarget = normalizeGuestPhone(guest.phone ?? "")?.slice(1) ?? null;
    const waHref = waMessage
      ? `https://wa.me/${waTarget ?? ""}?text=${encodeURIComponent(waMessage)}`
      : null;
    return {
      guest,
      url,
      waHref,
      rsvp: classifyRsvp(invitation?.status),
      // Whether this invitation actually went out — shared from either side,
      // or opened by the guest. What lets the team see where they stopped.
      wasSent: Boolean(invitation?.sentAt),
    };
  });

  const allLinksText = rows
    .filter((r) => r.url)
    .map((r) => `${r.guest.nameAr} — ${r.url}`)
    .join("\n");

  const rsvpLabel = { accepted: d.rsvpAccepted, declined: d.rsvpDeclined, pending: d.rsvpPending };

  return (
    <div className="max-w-3xl">
      <Link href={`/${locale}/admin/events`} className="text-sm text-fg-muted hover:text-fg">
        ← {a.backToEvents}
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-fg">{a.guestsPageTitle}</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {event.name} · {a.owner}: {event.owner?.name ?? a.ownerNone}
            {event.owner?.phone ? ` · ${event.owner.phone}` : ""}
          </p>
        </div>
        {teamManaged && (
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                done ? "bg-surface-2 text-fg-muted" : "bg-accent text-accent-fg"
              }`}
            >
              {done ? a.guestMgmtDone : a.guestMgmtBadge}
            </span>
            <form action={boundToggleDone}>
              <button type="submit" className="text-xs text-accent hover:underline">
                {done ? a.markGuestsPending : a.markGuestsDone}
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <span className="text-sm text-fg-muted">
            {a.guestsCount}: {rows.length}
          </span>
          {allLinksText && (
            <CopyTextButton
              text={allLinksText}
              label={a.copyAllLinks}
              copiedLabel={a.copiedShort}
              // Copying every link IS the send on a team-managed event, and it
              // is the only gesture that ever happens there — so it has to be
              // what records it.
              onCopied={markAllInvitationsSharedAdminAction.bind(
                null,
                eventId,
                rows.filter((r) => r.url).map((r) => r.guest.id),
                locale,
              )}
            />
          )}
        </div>

        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-fg-muted">{a.adminNoGuestsYet}</p>
        ) : (
          rows.map(({ guest, url, waHref, rsvp, wasSent }) => (
            <div
              key={guest.id}
              className="grid grid-cols-1 gap-2 border-b border-border px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1.4fr)_auto_auto_auto] sm:items-center sm:gap-4"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
                  <span className="truncate">{guest.nameAr}</span>
                  {wasSent && (
                    <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] text-success">
                      ✓ {a.sentMark}
                    </span>
                  )}
                </p>
                <p className="text-xs text-fg-muted" dir="ltr">
                  {guest.phone || "—"}
                </p>
              </div>
              <span className="text-xs text-fg-muted">
                {a.guestColSeats}: {guest.allowedCount}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-center text-xs ${
                  rsvp === "accepted"
                    ? "bg-success/10 text-success"
                    : rsvp === "declined"
                      ? "bg-danger/10 text-danger"
                      : "bg-surface-2 text-fg-muted"
                }`}
              >
                {rsvpLabel[rsvp]}
              </span>
              {url && waHref ? (
                <GuestShareCell
                  guestId={guest.id}
                  eventId={event.id}
                  locale={locale}
                  url={url}
                  waHref={waHref}
                  labels={{ whatsapp: a.sendViaWhatsapp, copy: a.copyLink, copied: a.copiedShort }}
                />
              ) : (
                <span className="text-xs text-fg-muted">{a.noInvitationYet}</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
