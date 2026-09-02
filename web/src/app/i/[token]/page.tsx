import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getInvitationByLinkToken, markViewed } from "@/lib/invitations/service";
import { renderQrDataUrl } from "@/lib/qr";
import { InvitationStatus, ThemeEngine } from "@/generated/prisma/client";
import { InvitationView } from "@/components/guest/invitation-view";
import { GuestMessage } from "@/components/guest/guest-message";
import { builderThemeConfig, loadBuilderTheme } from "@/lib/themes/builder/guest";
import { couplesFor } from "@/lib/events/service";
import { noteLines } from "@/lib/themes/builder/content";
import { builderFontStylesheetHref } from "@/lib/themes/builder/fonts-server";
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
  // A joint wedding still gets one preview line: the primary couple, same as
  // the seal monogram and the link-preview image. The English names are
  // optional, so an empty one gives way to the Arabic given name; bride first,
  // as on the invitation itself.
  const [primaryCouple] = couplesFor(invitation.event);
  const bride = primaryCouple.brideNameEn.trim() || primaryCouple.brideNameAr || "";
  const groom = primaryCouple.groomNameEn.trim() || primaryCouple.groomNameAr || "";

  return {
    title: `دعوة خاصة إلى ${invitation.guest.nameAr}`,
    description: `${bride} و ${groom} — ${dual} · ${invitation.event.locationName}`,
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

  // The QR is a paid feature. `hasQr` is a plain column on the event the query
  // already loads, so gating it here costs nothing — and gating it HERE, on the
  // server, is what makes it a real gate: the token is still minted for every
  // guest (so a later upgrade is one boolean, not a backfill), it simply never
  // reaches the browser for an event that did not buy it.
  const qrDataUrl =
    invitation.event.hasQr && displayStatus === InvitationStatus.ACCEPTED
      ? await renderQrDataUrl(invitation.qrToken)
      : null;

  // BUILDER themes keep their whole design in the database; LEGACY ones keep
  // reading the hand-coded `config` exactly as before.
  const builder =
    invitation.event.theme.engine === ThemeEngine.BUILDER
      ? await loadBuilderTheme(invitation.event.theme.id, invitation.event.themeVariantId)
      : null;

  // Families an admin added from the panel aren't bundled by next/font, so the
  // theme's own stylesheet has to come with it or its type renders as fallback.
  const fontsHref = builder ? await builderFontStylesheetHref(builder.layout, builder.typography) : null;

  // What the notes screen prints: the standard lines the host switched on
  // (no photos, no children, show the pass) ahead of her own lines. Composed
  // here so the view — and the builder's notes layer — see one plain list.
  const effectiveNotes = noteLines(invitation.event, invitation.event.notesAr).join("\n") || null;

  return (
    <>
      {fontsHref && <link rel="stylesheet" href={fontsHref} />}
      <InvitationView
        dict={dict}
        linkToken={token}
        theme={
          builder
            ? builderThemeConfig({ palette: builder.palette, typography: builder.typography })
            : (invitation.event.theme.config as unknown as ThemeConfig)
        }
        builder={builder ?? undefined}
        themeCategory={invitation.event.theme.category}
        event={{
          name: invitation.event.name,
          couples: couplesFor(invitation.event),
          groomNameEn: invitation.event.groomNameEn,
          brideNameEn: invitation.event.brideNameEn,
          groomNameAr: invitation.event.groomNameAr,
          groomFamilyAr: invitation.event.groomFamilyAr,
          brideNameAr: invitation.event.brideNameAr,
          brideFamilyAr: invitation.event.brideFamilyAr,
          openingKind: invitation.event.openingKind,
          hostMode: invitation.event.hostMode,
          groomMotherAr: invitation.event.groomMotherAr,
          brideMotherAr: invitation.event.brideMotherAr,
          hostLineAr: invitation.event.hostLineAr,
          coupleFormat: invitation.event.coupleFormat,
          closingAr: invitation.event.closingAr,
          familiesGreetingAr: invitation.event.familiesGreetingAr,
          invitationTextAr: invitation.event.invitationTextAr,
          eventDate: invitation.event.eventDate.toISOString(),
          locationName: invitation.event.locationName,
          regionName: invitation.event.regionName,
          mapUrl: invitation.event.mapUrl,
          musicYoutubeId: invitation.event.musicYoutubeId,
          musicAutoplay: invitation.event.musicAutoplay,
          scheduleItems: invitation.event.scheduleItems as unknown as ScheduleItem[] | null,
          notesAr: effectiveNotes,
          rsvpRequired: invitation.event.rsvpRequired,
          allowGuestPartySize: invitation.event.allowGuestPartySize,
        }}
        guest={{ nameAr: invitation.guest.nameAr, allowedCount: invitation.guest.allowedCount }}
        status={displayStatus}
        hasQr={invitation.event.hasQr}
        qrDataUrl={qrDataUrl}
      />
    </>
  );
}
