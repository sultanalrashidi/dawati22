import "server-only";
import { getViewableInvitationByLinkToken } from "@/lib/invitations/service";
import { loadBuilderTheme } from "@/lib/themes/builder/guest";
import { InvitationStatus, ThemeEngine } from "@/generated/prisma/client";
import type { ThemeConfig } from "@/lib/themes/types";
import type { WalletEvent, WalletGuest, WalletPalette } from "@/lib/wallet/google";

/**
 * The one gate both wallet routes pass through.
 *
 * Two routes issuing the same pass under two slightly different conditions is
 * a bug waiting to happen — the kind where a withdrawn invitation still opens
 * a door on one platform and not the other. There is one door here, and both
 * walk through it.
 */

/**
 * The states in which a guest is holding a real ticket. The same four the
 * invitation page collapses into "accepted": an admin may refine an acceptance
 * into VALID/PARTIALLY_USED/FULLY_USED, and none of those should cost her the
 * pass she already saved.
 */
const ADMITTED: InvitationStatus[] = [
  InvitationStatus.ACCEPTED,
  InvitationStatus.VALID,
  InvitationStatus.PARTIALLY_USED,
  InvitationStatus.FULLY_USED,
];

export type WalletInvitation = {
  event: WalletEvent;
  guest: WalletGuest;
  palette: WalletPalette | null;
};

/**
 * Resolves a link token into everything a pass needs, or null when this guest
 * should not be issued one at all — no such invitation, an event sold without
 * the QR product, or a guest who has not accepted.
 */
export async function resolveWalletInvitation(linkToken: string): Promise<WalletInvitation | null> {
  const invitation = await getViewableInvitationByLinkToken(linkToken);
  if (!invitation) return null;
  if (!invitation.event.hasQr || !ADMITTED.includes(invitation.status)) return null;

  // A BUILDER theme keeps its palette in the database under the variant the
  // host chose; a LEGACY one keeps it in the hand-written config. Same six
  // roles either way, so neither engine needs a special case downstream.
  const palette: WalletPalette | null =
    invitation.event.theme.engine === ThemeEngine.BUILDER
      ? ((await loadBuilderTheme(invitation.event.theme.id, invitation.event.themeVariantId))?.palette ?? null)
      : ((invitation.event.theme.config as unknown as ThemeConfig | null)?.palette ?? null);

  return {
    event: {
      id: invitation.event.id,
      name: invitation.event.name,
      eventDate: invitation.event.eventDate,
      locationName: invitation.event.locationName,
      regionName: invitation.event.regionName,
      mapUrl: invitation.event.mapUrl,
      palette,
    },
    guest: {
      id: invitation.id,
      nameAr: invitation.guest.nameAr,
      allowedCount: invitation.guest.allowedCount,
      qrToken: invitation.qrToken,
    },
    palette,
  };
}
