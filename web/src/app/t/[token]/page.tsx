import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { InvitationStatus } from "@/generated/prisma/client";
import { buildPreviewProps } from "@/lib/drafts/preview";
import { resolveSelfPreview } from "@/lib/preview/self";
import { InvitationView } from "@/components/guest/invitation-view";

/**
 * The test invitation, as her mother receives it.
 *
 * Identical to `/i/[token]` in everything the eye can check — the same
 * component, the same columns, the same envelope, the same music — and
 * deliberately inert in everything it cannot: no `linkToken`, so an RSVP is
 * simulated in the browser and reaches no database; no real QR, so the code on
 * the pass is the stand-in `mode="preview"` already draws; and no Guest row
 * behind any of it, so nothing here occupies one of the invitations she paid
 * for.
 *
 * `testCopy` is what stops that inertness from being a lie: whoever she
 * forwards this to is told, at the two places where the screen would otherwise
 * claim something it cannot deliver — the reply form and the entry pass.
 */
export default async function TestInvitationPage({ params }: PageProps<"/t/[token]">) {
  const { token } = await params;
  const dict = await getDictionary("ar");

  const event = await resolveSelfPreview(token);
  if (!event) notFound();

  const { fontsHref, ...view } = await buildPreviewProps(event);

  return (
    <>
      {fontsHref && <link rel="stylesheet" href={fontsHref} />}
      <InvitationView
        {...view}
        dict={dict}
        mode="preview"
        testCopy
        // A name, not a description: the whole point is that this looks like
        // the invitation a guest gets, and no guest is addressed as "our
        // honoured guest".
        guest={{ nameAr: dict.draft.previewGuestName, allowedCount: 2 }}
        status={InvitationStatus.SENT}
        hasQr={event.hasQr}
        qrDataUrl={null}
      />
    </>
  );
}
