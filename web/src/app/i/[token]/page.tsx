import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getInvitationByLinkToken, markViewed } from "@/lib/invitations/service";
import { renderQrDataUrl } from "@/lib/qr";
import { InvitationStatus } from "@/generated/prisma/client";
import { InvitationView } from "@/components/guest/invitation-view";
import { GuestMessage } from "@/components/guest/guest-message";
import type { ThemeConfig } from "@/lib/themes/types";

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
        invitationTextAr: invitation.event.invitationTextAr,
        eventDate: invitation.event.eventDate.toISOString(),
        locationName: invitation.event.locationName,
        mapUrl: invitation.event.mapUrl,
        musicYoutubeId: invitation.event.musicYoutubeId,
        rsvpRequired: invitation.event.rsvpRequired,
      }}
      guest={{ nameAr: invitation.guest.nameAr, allowedCount: invitation.guest.allowedCount }}
      status={displayStatus}
      qrDataUrl={qrDataUrl}
    />
  );
}
