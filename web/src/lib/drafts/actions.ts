"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { InvitationTier } from "@/generated/prisma/client";
import { isValidInvitationCount } from "@/lib/orders/pricing";
import { readEventForm } from "@/lib/events/form";
import { EventError, updateEventDetails } from "@/lib/events/service";
import {
  DraftRateLimitError,
  claimDraft,
  deleteDraft,
  resolveDraftAccess,
  startDraft,
} from "@/lib/drafts/service";
import { refreshDraftToken } from "@/lib/drafts/session";
import { isLocale, type Locale } from "@/lib/i18n/locales";

/** Only the two real tiers, and only when the count is one we actually sell. */
function readIntent(formData: FormData) {
  const tier = String(formData.get("intendedTier") ?? "");
  const count = Number(formData.get("intendedCount") ?? "");
  return {
    intendedTier: tier === InvitationTier.WITH_QR || tier === InvitationTier.NO_QR ? tier : null,
    intendedCount: isValidInvitationCount(count) ? count : null,
  };
}

/**
 * The gallery's "start with this design" button. No account, no payment — this
 * is the first step of the journey and the first row it writes. It lands on the
 * one edit page, already filled in with the sample invitation.
 */
export async function startDraftAction(formData: FormData): Promise<void> {
  // Everything comes off the form so the gallery's client components can post
  // to this directly, without binding arguments per card.
  const posted = String(formData.get("locale") ?? "");
  const locale: Locale = isLocale(posted) ? posted : "ar";
  const themeId = String(formData.get("themeId") ?? "");
  const themeVariantId = String(formData.get("themeVariantId") ?? "") || null;

  let draftId: string;
  try {
    draftId = await startDraft({ themeId, themeVariantId, ...readIntent(formData) });
  } catch (err) {
    if (err instanceof DraftRateLimitError) redirect(`/${locale}/themes?error=rate`);
    if (err instanceof EventError) redirect(`/${locale}/themes?error=theme`);
    throw err;
  }

  redirect(`/${locale}/draft/${draftId}/details`);
}

/**
 * The one draft edit page — names, date, venue, the opening, the mothers, the
 * programme, the notes, the music, the design.
 *
 * Reachable BEFORE payment, which is the point: the watermarked preview shows
 * the finished invitation, so what she pays for is what she already saw.
 */
export async function saveDraftDetailsAction(
  locale: Locale,
  eventId: string,
  formData: FormData,
): Promise<void> {
  const draft = await resolveDraftAccess(eventId);
  if (!draft) redirect(`/${locale}/themes`);

  // The draft page has no event-name field; the name is composed from the
  // couple ("حفل زفاف فهد و نورة") so it follows every rename automatically.
  const values = readEventForm(formData, { composeName: true });
  if (!values) redirect(`/${locale}/draft/${eventId}/details?error=validation`);

  await claimDraft(eventId);
  // The published retention rule is "30 days from the last edit", and for an
  // ownerless draft this cookie is the only way back to it. Refreshed here so
  // the cookie's clock and the sweep's clock are the same clock — otherwise it
  // would expire on day 30 while the draft lived to day 55, unreachable to the
  // person whose names are in it.
  await refreshDraftToken();

  try {
    await updateEventDetails(eventId, values);
  } catch {
    redirect(`/${locale}/draft/${eventId}/details?error=validation`);
  }

  revalidatePath(`/${locale}/draft/${eventId}/details`);
  // Straight back to the preview: she just changed how the invitation reads,
  // and the whole reason this form is reachable before payment is so she can
  // see the result before deciding.
  redirect(`/preview/${eventId}`);
}

/** Her own "throw this away" control — the only self-service deletion an anonymous visitor has. */
export async function deleteDraftAction(locale: Locale, eventId: string): Promise<void> {
  const draft = await resolveDraftAccess(eventId);
  if (!draft) redirect(`/${locale}/themes`);

  try {
    await deleteDraft(eventId);
  } catch {
    redirect(`/${locale}/draft/${eventId}/details?error=delete`);
  }

  redirect(`/${locale}/themes`);
}
