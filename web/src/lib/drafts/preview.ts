import "server-only";
import { ThemeEngine } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { couplesFor } from "@/lib/events/service";
import { noteLines } from "@/lib/themes/builder/content";
import { builderThemeConfig, loadBuilderTheme } from "@/lib/themes/builder/guest";
import { builderFontStylesheetHref } from "@/lib/themes/builder/fonts-server";
import type { ThemeConfig } from "@/lib/themes/types";
import type { ScheduleItem } from "@/lib/events/types";

/**
 * Turns an event row into exactly what the guest page hands `InvitationView`.
 *
 * The point is that the preview is not a mock-up of the invitation — it IS the
 * invitation, rendered by the same component from the same columns. Anything
 * this file did differently would be a way for the preview to lie about what
 * her guests will see, which is the one thing it exists not to do.
 *
 * The difference from `/i/[token]` is only what is deliberately withheld: no
 * `linkToken` (so RSVP short-circuits and nothing is recorded), no real QR,
 * and no guest — a draft has none, so the invitation greets her with the
 * neutral form.
 */
export const PREVIEW_EVENT_INCLUDE = {
  theme: true,
  couples: { orderBy: { sortOrder: "asc" } },
} as const;

export type PreviewEvent = NonNullable<Awaited<ReturnType<typeof loadPreviewEvent>>>;

export async function loadPreviewEvent(eventId: string) {
  return prisma.event.findUnique({ where: { id: eventId }, include: PREVIEW_EVENT_INCLUDE });
}

/**
 * The props `InvitationView` needs, plus the theme's own stylesheet href for a
 * builder design (its fonts are not bundled, so without this its type falls
 * back and the preview stops looking like the real thing).
 */
export async function buildPreviewProps(event: PreviewEvent) {
  const builder =
    event.theme.engine === ThemeEngine.BUILDER
      ? await loadBuilderTheme(event.theme.id, event.themeVariantId)
      : null;

  const fontsHref = builder ? await builderFontStylesheetHref(builder.layout, builder.typography) : null;

  return {
    fontsHref,
    builder: builder ?? undefined,
    themeCategory: event.theme.category,
    theme: builder
      ? builderThemeConfig({ palette: builder.palette, typography: builder.typography })
      : (event.theme.config as unknown as ThemeConfig),
    event: {
      name: event.name,
      couples: couplesFor(event),
      groomNameEn: event.groomNameEn,
      brideNameEn: event.brideNameEn,
      groomNameAr: event.groomNameAr,
      groomFamilyAr: event.groomFamilyAr,
      brideNameAr: event.brideNameAr,
      brideFamilyAr: event.brideFamilyAr,
      openingKind: event.openingKind,
      hostMode: event.hostMode,
      groomMotherAr: event.groomMotherAr,
      brideMotherAr: event.brideMotherAr,
      hostLineAr: event.hostLineAr,
      coupleFormat: event.coupleFormat,
      closingAr: event.closingAr,
      familiesGreetingAr: event.familiesGreetingAr,
      invitationTextAr: event.invitationTextAr,
      eventDate: event.eventDate.toISOString(),
      locationName: event.locationName,
      regionName: event.regionName,
      mapUrl: event.mapUrl,
      musicYoutubeId: event.musicYoutubeId,
      musicAutoplay: event.musicAutoplay,
      scheduleItems: event.scheduleItems as unknown as ScheduleItem[] | null,
      notesAr: noteLines(event, event.notesAr).join("\n") || null,
      rsvpRequired: event.rsvpRequired,
      allowGuestPartySize: event.allowGuestPartySize,
    },
  };
}
