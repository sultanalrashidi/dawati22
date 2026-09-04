"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/guards";
import {
  addGuest,
  addGuestsBulk,
  undoImport,
  markInvitationShared,
  setGuestBlocked,
  deleteGuest,
  GuestError,
} from "@/lib/guests/service";
import { parseGuestList, isCommittable, MAX_IMPORT_LINES } from "@/lib/guests/import-parse";
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

export type ImportActionState = {
  error?: string;
  created?: number;
  deleted?: number;
  kept?: number;
  alreadyApplied?: boolean;
  /** How many seats over the paid count the list would put her. */
  capacityShortBy?: number;
  /** The batch just written, so the panel can offer its undo. */
  batchId?: string;
} | null;

/**
 * Commits a pasted guest list.
 *
 * The TEXT is posted, not the parsed rows: re-parsing here means the server
 * decides what those lines mean, and the review table stays a preview of that
 * decision rather than an authority over it. She can only ever import what she
 * actually looked at, because it is the same function that produced both.
 */
export async function importGuestsAction(
  eventId: string,
  locale: string,
  _prev: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;

  const text = String(formData.get("guestList") ?? "");
  const batchId = String(formData.get("batchId") ?? "");
  if (!batchId) return { error: "invalid_batch" };

  const rows = parseGuestList(text).filter(isCommittable);
  if (rows.length === 0) return { error: "empty" };
  if (rows.length > MAX_IMPORT_LINES) return { error: "too_many" };

  try {
    const result = await addGuestsBulk(
      eventId,
      user.id,
      rows.map((r) => ({ nameAr: r.nameAr, phone: r.phone, allowedCount: r.allowedCount })),
      batchId,
    );
    revalidatePath(`/${safeLocale}/events/${eventId}`);
    return { ...result, batchId };
  } catch (err) {
    if (err instanceof GuestError) return { error: err.message };
    throw err;
  }
}

/** Removes an import — everything in it that has not gone out or replied yet. */
export async function undoImportAction(
  eventId: string,
  locale: string,
  batchId: string,
): Promise<ImportActionState> {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  try {
    const result = await undoImport(eventId, user.id, batchId);
    revalidatePath(`/${safeLocale}/events/${eventId}`);
    return result;
  } catch (err) {
    if (err instanceof GuestError) return { error: err.message };
    throw err;
  }
}
