"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { InvitationTier } from "@/generated/prisma/client";
import { isValidInvitationCount } from "@/lib/orders/pricing";
import { readEventEssentials, readEventForm } from "@/lib/events/form";
import { EventError, updateEventDetails } from "@/lib/events/service";
import {
  DraftRateLimitError,
  claimDraft,
  deleteDraft,
  resolveDraftAccess,
  saveDraftBasics,
  startDraft,
} from "@/lib/drafts/service";
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
 * is the first step of the journey and the first row it writes.
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

  redirect(`/${locale}/draft/${draftId}/basics`);
}

/** The three-field form: names, date, venue. */
export async function saveDraftBasicsAction(
  locale: Locale,
  eventId: string,
  formData: FormData,
): Promise<void> {
  const draft = await resolveDraftAccess(eventId);
  if (!draft) redirect(`/${locale}/themes`);

  const essentials = readEventEssentials(formData);
  if (!essentials) redirect(`/${locale}/draft/${eventId}/basics?error=validation`);

  // Saving is the deliberate act that attaches an anonymous draft to whoever
  // is signed in — a POST she made, not a URL she happened to open. A no-op
  // when there is no session or the draft already has an owner.
  await claimDraft(eventId);

  try {
    await saveDraftBasics(eventId, essentials);
  } catch {
    redirect(`/${locale}/draft/${eventId}/basics?error=validation`);
  }

  revalidatePath(`/${locale}/draft/${eventId}/basics`);
  // The payoff of the whole free half of the journey: three answers, and she
  // is looking at her own invitation.
  redirect(`/preview/${eventId}`);
}

/**
 * The full details form — the opening, the mothers, the programme, the notes,
 * the music, the design.
 *
 * Reachable BEFORE payment, which is the point: it means the watermarked
 * preview shows the finished invitation rather than defaults standing in for
 * everything she has not been asked for yet, so what she pays for is what she
 * already saw.
 */
export async function saveDraftDetailsAction(
  locale: Locale,
  eventId: string,
  formData: FormData,
): Promise<void> {
  const draft = await resolveDraftAccess(eventId);
  if (!draft) redirect(`/${locale}/themes`);

  const values = readEventForm(formData);
  if (!values) redirect(`/${locale}/draft/${eventId}/details?error=validation`);

  await claimDraft(eventId);

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
    redirect(`/${locale}/draft/${eventId}/basics?error=delete`);
  }

  redirect(`/${locale}/themes`);
}
