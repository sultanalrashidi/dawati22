"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/guards";
import {
  addGuest,
  addGuestsBulk,
  undoImport,
  markInvitationShared,
  unmarkInvitationShared,
  setGuestBlocked,
  deleteGuest,
  listGuestKeysForEvent,
  GuestError,
} from "@/lib/guests/service";
import {
  parseGuestList,
  isCommittable,
  existingGuestKeys,
  countGuestLines,
  MAX_IMPORT_LINES,
} from "@/lib/guests/import-parse";
import { Role } from "@/generated/prisma/client";
import { isLocale, defaultLocale } from "@/lib/i18n/locales";
import { toWesternDigits } from "@/lib/arabic";

export type GuestActionState = { error?: string } | null;

/**
 * A `GuestError` message turned into something a form can render.
 *
 * The add-guest form used to print "you have reached your limit" for every
 * error it was handed, whatever had actually gone wrong — which was survivable
 * while capacity was the only refusal, and stops being survivable the moment
 * there is a second one.
 */
function guestErrorCode(err: GuestError): string {
  if (err.message === "Name needs a phone") return "name_needs_phone";
  if (err.message.startsWith("Guest limit")) return "capacity";
  if (err.message === "Invalid seat count") return "invalid_seats";
  return "failed";
}

export async function addGuestAction(
  eventId: string,
  locale: string,
  _prev: GuestActionState,
  formData: FormData
): Promise<GuestActionState> {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;

  const nameAr = String(formData.get("nameAr") ?? "").trim();
  // Someone typing on an Arabic keyboard sends "٠٥٠…" and "٢"; fold to ASCII
  // digits before the phone parser and Number() ever see them.
  const phone = toWesternDigits(String(formData.get("phone") ?? "")).trim();
  const allowedCount = Number(toWesternDigits(String(formData.get("allowedCount") ?? "1"))) || 1;

  if (nameAr.length < 2) return { error: "invalid_name" };

  try {
    await addGuest(eventId, user.id, { nameAr, phone, allowedCount });
  } catch (err) {
    if (err instanceof GuestError) return { error: guestErrorCode(err) };
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

/**
 * "I did not actually send that one" — the send queue's correction.
 *
 * Deliberately does not un-freeze the event's details: something else in the
 * batch may well have reached a guest, and one correction is not evidence that
 * nothing went out.
 */
export async function unmarkGuestSentAction(guestId: string, eventId: string, locale: string) {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  await unmarkInvitationShared(guestId, user.id);
  revalidatePath(`/${safeLocale}/events/${eventId}`);
  revalidatePath(`/${safeLocale}/events/${eventId}/send`);
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

  // Counted on the raw text: parseGuestList truncates to MAX_IMPORT_LINES, so
  // testing its output could never see an over-long paste.
  if (countGuestLines(text) > MAX_IMPORT_LINES) return { error: "too_many" };

  // Re-parsed against the guests she ALREADY has, exactly as the review table
  // does. Without this argument the action saw no duplicates at all, so every
  // warning the browser drew was decorative and the write went through
  // regardless — the preview agreeing with itself while the real output
  // differed. `addGuestsBulk` re-checks the same rule at the row level; this
  // is what makes the paste path see it in the first place.
  const guests = await listGuestKeysForEvent(eventId, user.id);
  const rows = parseGuestList(text, existingGuestKeys(guests)).filter(isCommittable);
  if (rows.length === 0) return { error: "empty" };

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
    // Anything else — a transaction that ran out of budget, a lost connection
    // — must come back as a message she can retry from. There is no error
    // boundary on this route, so a rethrow here is a blank screen after she
    // typed three hundred names.
    return { error: "import_failed" };
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
