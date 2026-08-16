"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { submitRsvp, getInvitationByLinkToken, InvitationError } from "@/lib/invitations/service";
import { sha256Hex } from "@/lib/security/tokens";
import { renderQrDataUrl } from "@/lib/qr";
import { RsvpStatus } from "@/generated/prisma/client";

export type RsvpActionState = { ok: boolean; error?: string; qrDataUrl?: string };

export async function submitRsvpAction(
  linkToken: string,
  response: "ACCEPTED" | "DECLINED"
): Promise<RsvpActionState> {
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for") ?? "";

  try {
    await submitRsvp(linkToken, response === "ACCEPTED" ? RsvpStatus.ACCEPTED : RsvpStatus.DECLINED, {
      ipHash: ip ? sha256Hex(ip) : undefined,
      userAgent: hdrs.get("user-agent") ?? undefined,
    });
  } catch (err) {
    if (err instanceof InvitationError) return { ok: false, error: err.message };
    throw err;
  }

  revalidatePath(`/i/${linkToken}`);

  if (response === "ACCEPTED") {
    const invitation = await getInvitationByLinkToken(linkToken);
    if (invitation) return { ok: true, qrDataUrl: await renderQrDataUrl(invitation.qrToken) };
  }
  return { ok: true };
}
