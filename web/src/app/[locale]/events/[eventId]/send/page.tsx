import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requireUserOrRedirect } from "@/lib/auth/guards";
import { Role } from "@/generated/prisma/client";
import { getEventSendQueue } from "@/lib/events/service";
import { guestInvitationUrl } from "@/lib/urls";
import { invitationShareText } from "@/lib/events/share-text";
import { normalizeGuestPhone } from "@/lib/security/phone";
import { SendQueue, type QueueGuest } from "@/components/events/send-queue";

/**
 * Handing out the invitations, one guest at a time.
 *
 * NOT a bulk sender. This product has no outbound messaging channel and this
 * screen does not introduce one: every message is the host tapping WhatsApp
 * herself, from her own number, exactly as the guest table has always worked.
 * What changes is that she stops hunting — the screen holds her place, counts
 * what is left, and puts one name in front of her at a time.
 */
export default async function SendQueuePage({ params }: PageProps<"/[locale]/events/[eventId]/send">) {
  const { locale, eventId } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  const user = await requireUserOrRedirect(locale, [Role.CUSTOMER]);
  const queue = await getEventSendQueue(eventId, user.id);
  if (!queue) notFound();
  // Nobody to send to yet — the dashboard is where guests are added, and an
  // empty queue with no way forward reads as a fault.
  if (queue.total === 0) redirect(`/${locale}/events/${eventId}`);

  const shareText = invitationShareText(queue.event);

  const guests: QueueGuest[] = queue.pending
    .filter((guest) => guest.invitation !== null)
    .map((guest) => {
      const url = guestInvitationUrl(guest.invitation!.linkToken);
      // Straight into HER chat when we have a number, so the host does not
      // pick from a contact list two hundred times. `wa.me/<number>` wants
      // digits with no plus, which is what E.164 gives once stripped.
      const to = guest.phone ? normalizeGuestPhone(guest.phone) : null;
      const text = encodeURIComponent(`${shareText}\n${url}`);
      return {
        id: guest.id,
        nameAr: guest.nameAr,
        phone: guest.phone,
        allowedCount: guest.allowedCount,
        invitationUrl: url,
        waHref: to ? `https://wa.me/${to.replace(/\D/g, "")}?text=${text}` : `https://wa.me/?text=${text}`,
      };
    });

  return (
    <SendQueue
      eventId={eventId}
      locale={locale}
      dict={dict}
      guests={guests}
      total={queue.total}
    />
  );
}
