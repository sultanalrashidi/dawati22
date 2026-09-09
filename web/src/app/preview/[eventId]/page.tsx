import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getSessionUser } from "@/lib/auth/session";
import { InvitationView } from "@/components/guest/invitation-view";
import { InvitationStatus, InvitationTier } from "@/generated/prisma/client";
import { readDraftTokenHash } from "@/lib/drafts/session";
import { hasPreviewGrant } from "@/lib/drafts/grant";
import { buildPreviewProps, loadPreviewEvent } from "@/lib/drafts/preview";
import {
  PREVIEW_BAR_INSET,
  PREVIEW_CAPTION_INSET,
  PreviewBar,
} from "@/components/drafts/preview-bar";

/**
 * Her own invitation, for real, before she has paid for it.
 *
 * Rendered by the very same component her guests will see, from the same
 * columns — the only differences are the ones that must be different: a
 * watermark over everything, no guest link (so the RSVP answers locally and
 * records nothing), and a stand-in for the entry code.
 *
 * Lives OUTSIDE `/[locale]` deliberately: that segment's layout wraps every
 * page in the site header, and an invitation is a full-bleed thing that opens
 * like an envelope. It has no business having a navigation bar over it.
 */
export const metadata: Metadata = {
  // A private, unpaid draft has no business in a search index.
  robots: { index: false, follow: false },
};

export default async function DraftPreviewPage({
  params,
}: PageProps<"/preview/[eventId]">) {
  const { eventId } = await params;

  const event = await loadPreviewEvent(eventId);
  if (!event) redirect("/ar/themes");

  const [user, tokenHash, granted] = await Promise.all([
    getSessionUser(),
    readDraftTokenHash(),
    hasPreviewGrant(eventId),
  ]);

  const isOwner = Boolean(user && event.ownerId === user.id);
  const isBearer = event.ownerId === null && tokenHash !== null && event.draftTokenHash === tokenHash;
  // A copied /preview URL is worth nothing on its own: the id is in it, but
  // none of these three is, so it renders nothing and lands on the gallery.
  if (!isOwner && !isBearer && !granted) redirect("/ar/themes");

  const dict = await getDictionary("ar");
  const { fontsHref, ...view } = await buildPreviewProps(event);

  // Paid invitations lose the watermark — "بعد الدفع ماتكون محمية".
  const activated = event.orderId !== null;
  // Only she (signed in, or holding the draft cookie) gets the controls; the
  // person she shared it with gets the caption and the privacy link.
  const controls = isOwner || isBearer;
  // Before payment the pass follows the tier she is heading for: a trial that
  // hid the code was the one place the preview lied about the product. NO_QR
  // is the only choice that drops it; undecided means WITH_QR, which is also
  // what the activation picker opens on. After payment the order's snapshot
  // on the event rules, exactly as on /i/[token].
  const hasQr = activated ? event.hasQr : event.intendedTier !== InvitationTier.NO_QR;

  return (
    <>
      {fontsHref && <link rel="stylesheet" href={fontsHref} />}
      <InvitationView
        {...view}
        dict={dict}
        mode="preview"
        watermark={
          activated ? undefined : { primary: dict.draft.watermarkPrimary, secondary: dict.draft.watermarkSecondary }
        }
        // A real-looking kunya, not a descriptor: the whole point of this
        // screen is that she sees her own invitation exactly as a guest
        // will get it, and no guest is ever addressed as "our honoured guest".
        guest={{ nameAr: dict.draft.previewGuestName, allowedCount: 2 }}
        status={InvitationStatus.SENT}
        // No real code exists before activation: `mode="preview"` draws the
        // stand-in, and `hasQr` decides whether there is a code slot at all.
        hasQr={hasQr}
        qrDataUrl={null}
        // What the bar below covers, so no screen puts the RSVP submit or the
        // cover's open button underneath it.
        bottomInset={controls ? PREVIEW_BAR_INSET : PREVIEW_CAPTION_INSET}
      />
      {/* One bar for everyone the page admits. Hers carries the controls; a
          shared viewer's is the caption and the privacy policy — the share
          route set cookies on them, and this segment has no header or footer
          to make that policy reachable. */}
      <PreviewBar
        dict={dict}
        eventId={eventId}
        activated={activated}
        locked={event.detailsLockedAt !== null}
        controls={controls}
      />
    </>
  );
}
