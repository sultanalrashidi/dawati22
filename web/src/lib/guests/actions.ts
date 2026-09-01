"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/guards";
import { addGuest, markInvitationShared, setGuestBlocked, deleteGuest, GuestError } from "@/lib/guests/service";
import { Role } from "@/generated/prisma/client";
import { isLocale, defaultLocale } from "@/lib/i18n/locales";

export type GuestActionState = { error?: string } | null;

export async function addGuestAction(
  eventId: string,
  locale: string,
  _prev: GuestActionState,
  formData: FormData
): Promise<GuestActionState> {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;

  const nameAr = String(formData.get("nameAr") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const allowedCount = Number(formData.get("allowedCount") ?? 1);

  if (nameAr.length < 2) return { error: "invalid_name" };

  try {
    await addGuest(eventId, user.id, { nameAr, phone, allowedCount });
  } catch (err) {
    if (err instanceof GuestError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/${safeLocale}/events/${eventId}`);
  return null;
}

/**
 * The host pressed copy or WhatsApp on a guest's row — record the invitation
 * as sent. Fired alongside the share itself, so it swallows nothing: a
 * tampered guestId still throws, an honest click updates the "sent" count.
 */
export async function markInvitationSharedAction(guestId: string, eventId: string, locale: string) {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  await markInvitationShared(guestId, user.id);
  revalidatePath(`/${safeLocale}/events/${eventId}`);
}

export async function toggleGuestBlockedAction(guestId: string, eventId: string, locale: string, blocked: boolean) {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  await setGuestBlocked(guestId, user.id, blocked);
  revalidatePath(`/${safeLocale}/events/${eventId}`);
}

export async function deleteGuestAction(guestId: string, eventId: string, locale: string) {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  await deleteGuest(guestId, user.id);
  revalidatePath(`/${safeLocale}/events/${eventId}`);
}
