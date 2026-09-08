import { NextResponse } from "next/server";
import { resolveWalletInvitation } from "@/lib/wallet/invitation";
import { googleWalletSaveUrl } from "@/lib/wallet/google";

/**
 * "Add to Google Wallet" — a redirect, not a link the page can compute.
 *
 * The save URL is a signed JWT that only exists after the pass has been
 * written to Google, so building it during render would put a round trip in
 * front of every invitation page for a button most guests never press. Doing
 * the work here means the page stays a plain link and the cost lands only on
 * the tap.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await resolveWalletInvitation(token);
  if (!invitation) return new NextResponse("Not found", { status: 404 });

  const saveUrl = await googleWalletSaveUrl(invitation.event, invitation.guest);

  // Credentials absent means the issuer account is not live yet. The button is
  // hidden in that case, so arriving here is a stale tab or a typed URL — send
  // her back to the invitation rather than showing an error for a feature she
  // was never offered.
  if (!saveUrl) return NextResponse.redirect(new URL(`/i/${token}`, request.url), 307);

  return NextResponse.redirect(saveUrl, 303);
}
