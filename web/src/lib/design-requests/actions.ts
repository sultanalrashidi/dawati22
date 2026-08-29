"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/guards";
import { Role } from "@/generated/prisma/client";
import { isLocale, defaultLocale } from "@/lib/i18n/locales";
import {
  approveDesign,
  cancelDesignRequest,
  createDesignRequestForEvent,
  DesignRequestError,
  markDesignReady,
  requestDesignChanges,
  startDesignWork,
  type DesignBrief,
} from "@/lib/design-requests/service";

export type DesignRequestState = { error?: string; saved?: boolean } | null;

async function requireAdmin() {
  return requireUserOrThrow([Role.ADMIN]);
}

function readBrief(formData: FormData): DesignBrief {
  return {
    colorTags: formData.getAll("designColorTags").map((v) => String(v)),
    styleCategory: String(formData.get("designStyle") ?? "") || null,
    inspirationThemeId: String(formData.get("designInspirationThemeId") ?? "") || null,
    notes: String(formData.get("designNotes") ?? ""),
  };
}

// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------

/** Starting a request after the event already exists. */
export async function createDesignRequestAction(
  eventId: string,
  locale: string,
  _prev: DesignRequestState,
  formData: FormData,
): Promise<DesignRequestState> {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;

  try {
    await createDesignRequestForEvent(user.id, eventId, readBrief(formData));
  } catch (err) {
    if (err instanceof DesignRequestError) return { error: err.message };
    throw err;
  }
  revalidatePath(`/${safeLocale}/events/${eventId}`);
  return { saved: true };
}

export async function requestDesignChangesAction(
  requestId: string,
  eventId: string,
  locale: string,
  _prev: DesignRequestState,
  formData: FormData,
): Promise<DesignRequestState> {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  const note = String(formData.get("revisionNote") ?? "").trim();
  if (note.length < 3) return { error: "note_required" };

  try {
    await requestDesignChanges(requestId, user.id, note);
  } catch (err) {
    if (err instanceof DesignRequestError) return { error: err.message };
    throw err;
  }
  revalidatePath(`/${safeLocale}/events/${eventId}`);
  return { saved: true };
}

/**
 * "I like it" — creates the fee order and sends the customer to the same
 * checkout page every other payment uses, so there is one payment surface and
 * one set of provider branches to keep working.
 */
export async function approveDesignAction(requestId: string, locale: string) {
  const user = await requireUserOrThrow([Role.CUSTOMER]);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;

  let orderId: string;
  try {
    const order = await approveDesign(requestId, user.id);
    orderId = order.id;
  } catch (err) {
    if (err instanceof DesignRequestError) redirect(`/${safeLocale}/events`);
    throw err;
  }
  redirect(`/${safeLocale}/checkout/${orderId}`);
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

export async function startDesignWorkAction(
  requestId: string,
  locale: string,
  _prev: DesignRequestState,
  formData: FormData,
): Promise<DesignRequestState> {
  await requireAdmin();
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  await startDesignWork(requestId, String(formData.get("adminNote") ?? ""));
  revalidatePath(`/${safeLocale}/admin/design-requests`);
  return { saved: true };
}

export async function markDesignReadyAction(
  requestId: string,
  locale: string,
  _prev: DesignRequestState,
  formData: FormData,
): Promise<DesignRequestState> {
  const admin = await requireAdmin();
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  const themeId = String(formData.get("themeId") ?? "").trim();
  if (!themeId) return { error: "theme_required" };

  try {
    await markDesignReady(requestId, themeId, admin.id, String(formData.get("adminNote") ?? ""));
  } catch (err) {
    if (err instanceof DesignRequestError) return { error: err.message };
    throw err;
  }
  revalidatePath(`/${safeLocale}/admin/design-requests`);
  return { saved: true };
}

export async function cancelDesignRequestAction(
  requestId: string,
  locale: string,
  _prev: DesignRequestState,
  formData: FormData,
): Promise<DesignRequestState> {
  await requireAdmin();
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  await cancelDesignRequest(requestId, String(formData.get("adminNote") ?? ""));
  revalidatePath(`/${safeLocale}/admin/design-requests`);
  return { saved: true };
}
