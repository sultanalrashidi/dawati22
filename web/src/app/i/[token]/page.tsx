import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getInvitationByLinkToken, markViewed } from "@/lib/invitations/service";
import { renderQrDataUrl } from "@/lib/qr";
import { InvitationStatus } from "@/generated/prisma/client";
import { InvitationView } from "@/components/guest/invitation-view";
import { GuestMessage } from "@/components/guest/guest-message";
import type { ThemeConfig } from "@/lib/themes/types";
import type { ScheduleItem } from "@/lib/events/types";

// Powers the WhatsApp/social link-preview card (title + description; the
// image itself comes from the sibling opengraph-image.tsx) — this is what
// lets a shared invitation link show up as a real preview instead of a bare
// URL, without changing how the link itself works.
export async function generateMetadata({ params }: PageProps<"/i/[token]">): Promise<Metadata> {
  const { token } = await params;
  const invitation = await getInvitationByLinkToken(token);
  if (!invitation) return {};

  const dual = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { day: "numeric", month: "long", year: "numeric" }).format(
    invitation.event.eventDate,
  );

  return {
    title: `دعوة خاصة إلى ${invitation.guest.nameAr}`,
    description: `${invitation.event.groomNameEn} و ${invitation.event.brideNameEn} — ${dual} · ${invitation.event.locationName}`,
  };
}

export default async function GuestInvitationPage({ params }: PageProps<"/i/[token]">) {
  const { token } = await params;
  const dict = await getDictionary("ar");

  const invitation = await getInvitationByLinkToken(token);
  if (!invitation || invitation.guest.isBlocked) notFound();

  if (invitation.status === InvitationStatus.BLOCKED) {
    return <GuestMessage title={dict.guest.blockedTitle} body={dict.guest.blockedBody} />;
  }
  if (invitation.status === InvitationStatus.CANCELLED) {
    return <GuestMessage title={dict.guest.cancelledTitle} body={dict.guest.cancelledBody} />;
  }
  if (invitation.status === InvitationStatus.EXPIRED) {
    return <GuestMessage title={dict.guest.expiredTitle} body={dict.guest.expiredBody} />;
  }

  await markViewed(invitation.id, invitation.status);

  // VALID/PARTIALLY_USED/FULLY_USED are entry-state refinements an admin may
  // set post-acceptance (see task 10) — they still display as "accepted" here.
  const displayStatus =
    invitation.status === InvitationStatus.VALID ||
    invitation.status === InvitationStatus.PARTIALLY_USED ||
    invitation.status === InvitationStatus.FULLY_USED
      ? InvitationStatus.ACCEPTED
      : invitation.status;

  const qrDataUrl = displayStatus === InvitationStatus.ACCEPTED ? await renderQrDataUrl(invitation.qrToken) : null;

  return (
    <InvitationView
      dict={dict}
      linkToken={token}
      theme={invitation.event.theme.config as unknown as ThemeConfig}
      themeCategory={invitation.event.theme.category}
      event={{
        name: invitation.event.name,
        groomNameEn: invitation.event.groomNameEn,
        brideNameEn: invitation.event.brideNameEn,
        groomNameAr: invitation.event.groomNameAr,
        groomFamilyAr: invitation.event.groomFamilyAr,
        brideNameAr: invitation.event.brideNameAr,
        brideFamilyAr: invitation.event.brideFamilyAr,
        familiesGreetingAr: invitation.event.familiesGreetingAr,
        invitationTextAr: invitation.event.invitationTextAr,
        eventDate: invitation.event.eventDate.toISOString(),
        locationName: invitation.event.locationName,
        mapUrl: invitation.event.mapUrl,
        musicYoutubeId: invitation.event.musicYoutubeId,
        musicAutoplay: invitation.event.musicAutoplay,
        scheduleItems: invitation.event.scheduleItems as unknown as ScheduleItem[] | null,
        notesAr: invitation.event.notesAr,
        rsvpRequired: invitation.event.rsvpRequired,
      }}
      guest={{ nameAr: invitation.guest.nameAr, allowedCount: invitation.guest.allowedCount }}
      status={displayStatus}
      qrDataUrl={qrDataUrl}
    />
  );
}
