import { NextResponse } from "next/server";
import { getInvitationByLinkToken } from "@/lib/invitations/service";
import { googleWalletSaveUrl } from "@/lib/wallet/google";
import { InvitationStatus, ThemeEngine } from "@/generated/prisma/client";
import { loadBuilderTheme } from "@/lib/themes/builder/guest";
import type { ThemeConfig } from "@/lib/themes/types";
import type { WalletPalette } from "@/lib/wallet/google";

/**
 * The states in which a guest is holding a real ticket. They are the same
 * four the invitation page collapses into "accepted" — an admin may refine an
 * acceptance into VALID/PARTIALLY_USED/FULLY_USED, and none of those should
 * cost her the pass she already saved.
 */
const ADMITTED: InvitationStatus[] = [
  InvitationStatus.ACCEPTED,
  InvitationStatus.VALID,
  InvitationStatus.PARTIALLY_USED,
  InvitationStatus.FULLY_USED,
];

/**
 * "Add to Google Wallet" — a redirect, not a link the page can compute.
 *
 * The save URL is a signed JWT that only exists after the pass has been
 * written to Google, so building it during render would put a round trip in
 * front of every invitation page for a button most guests never press. Doing
 * the work here means the page stays a plain link and the cost lands only on
 * the tap. It also keeps the whole gate server-side: nothing about the pass,
 * the issuer, or the guest's code is decided in the browser.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await getInvitationByLinkToken(token);
  if (!invitation) return new NextResponse("Not found", { status: 404 });

  // Same gate as the on-screen QR: the pass is the paid WITH_QR product, and
  // it only means anything once she has actually accepted.
  if (!invitation.event.hasQr || !ADMITTED.includes(invitation.status)) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Where the pass gets its colour. A BUILDER theme keeps its palette in the
  // database under the variant the host chose; a LEGACY one keeps it in the
  // hand-written config. Same six roles either way, so one branch resolves
  // both and neither engine gets a special case downstream.
  const palette: WalletPalette | null =
    invitation.event.theme.engine === ThemeEngine.BUILDER
      ? ((await loadBuilderTheme(invitation.event.theme.id, invitation.event.themeVariantId))?.palette ?? null)
      : ((invitation.event.theme.config as unknown as ThemeConfig | null)?.palette ?? null);

  const saveUrl = await googleWalletSaveUrl(
    {
      id: invitation.event.id,
      name: invitation.event.name,
      eventDate: invitation.event.eventDate,
      locationName: invitation.event.locationName,
      regionName: invitation.event.regionName,
      mapUrl: invitation.event.mapUrl,
      palette,
    },
    {
      id: invitation.id,
      nameAr: invitation.guest.nameAr,
      allowedCount: invitation.guest.allowedCount,
      qrToken: invitation.qrToken,
    },
  );

  // Credentials absent means the issuer account is not live yet. The button is
  // hidden in that case, so arriving here is a stale tab or a typed URL — send
  // her back to the invitation rather than showing an error for a feature she
  // was never offered.
  if (!saveUrl) return NextResponse.redirect(new URL(`/i/${token}`, request.url), 307);

  return NextResponse.redirect(saveUrl, 303);
}
