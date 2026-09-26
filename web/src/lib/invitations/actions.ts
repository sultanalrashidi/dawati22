"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { submitRsvp, getViewableInvitationByLinkToken, InvitationError, type RsvpDetails } from "@/lib/invitations/service";
import { sha256Hex } from "@/lib/security/tokens";
import { renderQrDataUrl } from "@/lib/qr";
import { RsvpStatus } from "@/generated/prisma/client";

export type RsvpActionState = { ok: boolean; error?: string; qrDataUrl?: string };

export async function submitRsvpAction(
  linkToken: string,
  response: "ACCEPTED" | "DECLINED",
  details: RsvpDetails = {}
): Promise<RsvpActionState> {
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for") ?? "";

  try {
    await submitRsvp(linkToken, response === "ACCEPTED" ? RsvpStatus.ACCEPTED : RsvpStatus.DECLINED, details, {
      ipHash: ip ? sha256Hex(ip) : undefined,
      userAgent: hdrs.get("user-agent") ?? undefined,
    });
  } catch (err) {
    if (err instanceof InvitationError) return { ok: false, error: err.message };
    throw err;
  }

  revalidatePath(`/i/${linkToken}`);

  if (response === "ACCEPTED") {
    const invitation = await getViewableInvitationByLinkToken(linkToken);
    // Same gate as the page render, and it has to be here too: the client swaps
    // this value straight into the pass without another page load, so returning
    // it for a no-QR event would hand over the paid feature the moment the guest
    // accepts, whatever the server-rendered page decided a second earlier.
    if (invitation?.event.hasQr) {
      return { ok: true, qrDataUrl: await renderQrDataUrl(invitation.qrToken) };
    }
  }
  return { ok: true };
}
