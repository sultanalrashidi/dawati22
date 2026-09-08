import { NextResponse } from "next/server";
import { resolveWalletInvitation } from "@/lib/wallet/invitation";
import { appleWalletPass } from "@/lib/wallet/apple";

/**
 * "Add to Apple Wallet" — the .pkpass file itself, not a redirect.
 *
 * Nothing is stored at Apple's end: the bundle is built and signed here on
 * every tap, and Safari on an iPhone hands the download straight to Wallet.
 * Building each time is also what keeps a pass honest — move the venue an
 * hour before the doors open and the next tap carries the new one.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await resolveWalletInvitation(token);
  if (!invitation) return new NextResponse("Not found", { status: 404 });

  const pass = appleWalletPass(invitation.event, invitation.guest, invitation.palette);
  // Absent credentials mean the button was never shown; treat a typed URL as
  // a wrong address rather than an error page for a feature she wasn't offered.
  if (!pass) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(pass as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": 'attachment; filename="invitation.pkpass"',
      // A pass carries one guest's code; no shared cache may hold it.
      "Cache-Control": "private, no-store",
    },
  });
}
