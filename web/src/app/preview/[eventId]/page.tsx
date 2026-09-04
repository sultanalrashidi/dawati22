import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getSessionUser } from "@/lib/auth/session";
import { InvitationView } from "@/components/guest/invitation-view";
import { InvitationStatus } from "@/generated/prisma/client";
import { readDraftTokenHash } from "@/lib/drafts/session";
import { hasPreviewGrant } from "@/lib/drafts/grant";
import { buildPreviewProps, loadPreviewEvent } from "@/lib/drafts/preview";
import { PreviewBar } from "@/components/drafts/preview-bar";

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
        guest={{ nameAr: dict.draft.previewGuestName, allowedCount: 2 }}
        status={InvitationStatus.SENT}
        // The entry pass is a paid feature; before activation the invitation
        // shows the stand-in code `mode="preview"` already draws, never a real
        // scannable one.
        hasQr={activated && event.hasQr}
        qrDataUrl={null}
      />
      {/* Only the person who owns the draft gets the toolbar — a viewer she
          shared it with should see the invitation, not her controls. */}
      {(isOwner || isBearer) && <PreviewBar dict={dict} eventId={eventId} activated={activated} />}
    </>
  );
}
