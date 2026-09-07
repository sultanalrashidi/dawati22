"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/guards";
import {
  setUserBlocked,
  setEventStatus,
  setEventDetailsLock,
  setGuestManagementDone,
  updatePricingRate,
  grantExtraInvitations,
  AdminGrantError,
} from "@/lib/admin/service";
import { EventError, updateEventDetails } from "@/lib/events/service";
import { markInvitationShared, markInvitationsShared } from "@/lib/guests/service";
import { readEventForm } from "@/lib/events/form";
import { sweepAbandonedDrafts } from "@/lib/drafts/sweep";
import { Role, EventStatus } from "@/generated/prisma/client";
import { parseTier } from "@/lib/orders/pricing";
import { isLocale, defaultLocale } from "@/lib/i18n/locales";
import { logger } from "@/lib/logger";

async function requireAdmin() {
  return requireUserOrThrow([Role.ADMIN]);
}

export async function toggleUserBlockedAction(userId: string, locale: string, blocked: boolean) {
  await requireAdmin();
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  await setUserBlocked(userId, blocked);
  revalidatePath(`/${safeLocale}/admin/users`);
}

export async function cancelEventAction(eventId: string, locale: string) {
  await requireAdmin();
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  await setEventStatus(eventId, EventStatus.ARCHIVED);
  revalidatePath(`/${safeLocale}/admin/events`);
}

/**
 * The team pressed copy or WhatsApp for one guest on the admin guests page —
 * the same "this invitation was actually sent" record the customer's own
 * share buttons write, minus the ownership check an admin cannot pass.
 */
export async function markInvitationSharedAdminAction(guestId: string, eventId: string, locale: string) {
  await requireAdmin();
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  await markInvitationShared(guestId, null);
  revalidatePath(`/${safeLocale}/admin/events/${eventId}/guests`);
}

/**
 * The team copied EVERY link for an event at once.
 *
 * Without this the team-managed flow — where the customer never presses a
 * share button at all — would hand out three hundred invitations and leave
 * `sentAt` null on every one of them, so her dashboard would report nothing
 * sent and her details would stay editable while the invitations were already
 * in her guests' phones.
 */
export async function markAllInvitationsSharedAdminAction(
  eventId: string,
  guestIds: string[],
  locale: string,
) {
  await requireAdmin();
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  await markInvitationsShared(eventId, guestIds, null);
  revalidatePath(`/${safeLocale}/admin/events/${eventId}/guests`);
  revalidatePath(`/${safeLocale}/events/${eventId}`);
}

/** "The team sent this event's invitations" — and the undo for a misclick. */
export async function toggleGuestMgmtDoneAction(eventId: string, locale: string, done: boolean) {
  const admin = await requireAdmin();
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  await setGuestManagementDone(eventId, admin.id, done);
  revalidatePath(`/${safeLocale}/admin/events`);
  revalidatePath(`/${safeLocale}/admin/events/${eventId}/guests`);
}

/**
 * Reopen (or re-freeze) the customer's own edit form for one event.
 *
 * A POST, never a link: Next prefetches links, and a prefetch that reopens an
 * event is not a control. `requireAdmin` here in the action itself rather than
 * leaning on route matching, which can be refactored around.
 */
export async function setEventDetailsLockAction(eventId: string, locale: string, locked: boolean) {
  await requireAdmin();
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  await setEventDetailsLock(eventId, locked);
  revalidatePath(`/${safeLocale}/admin/events/${eventId}`);
  revalidatePath(`/${safeLocale}/admin/events`);
  // The customer's dashboard and her edit screen both read this column.
  revalidatePath(`/${safeLocale}/events/${eventId}`);
  revalidatePath(`/${safeLocale}/events/${eventId}/details`);
}

/**
 * Runs the retention sweep by hand.
 *
 * The same function the nightly cron calls — a second caller, never a second
 * implementation, so what support triggers is exactly what runs at 2am.
 */
export async function sweepAbandonedDraftsAction(locale: string) {
  await requireAdmin();
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  await sweepAbandonedDrafts();
  revalidatePath(`/${safeLocale}/admin`);
}

export type EventEditState = { error?: string; saved?: boolean } | null;

/**
 * Support's edit of a customer's event. This is the only way the details change
 * after creation — the customer's form is create-only, and the create page says
 * so — so it returns its outcome as state rather than redirecting: the admin
 * stays on the filled-in form and can see what did or did not save.
 */
export async function updateEventDetailsAction(
  eventId: string,
  locale: string,
  _prev: EventEditState,
  formData: FormData,
): Promise<EventEditState> {
  await requireAdmin();

  const fields = readEventForm(formData);
  if (!fields) return { error: "invalid" };

  try {
    await updateEventDetails(eventId, fields);
  } catch (err) {
    if (err instanceof EventError) return { error: err.message };
    throw err;
  }

  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  revalidatePath(`/${safeLocale}/admin/events`);
  revalidatePath(`/${safeLocale}/admin/events/${eventId}`);
  // The owner's own dashboard reads the same row.
  revalidatePath(`/${safeLocale}/events/${eventId}`);
  // And the guests'. The whole promise of this screen is that a corrected name
  // reaches invitations already sent, so the guest route is invalidated too —
  // by pattern, because the tokens are not known here and there can be
  // hundreds. The RSVP action revalidates the same route for the same reason.
  revalidatePath("/i/[token]", "page");
  return { saved: true };
}

export type PricingFormState = { error?: string; saved?: boolean } | null;

/**
 * Sets the price of one invitation for one tier. Takes effect on new orders
 * only — an order freezes its own unitPrice and total at purchase, so nothing
 * already sold moves when this changes.
 */
export async function updatePricingRateAction(
  locale: string,
  _prev: PricingFormState,
  formData: FormData,
): Promise<PricingFormState> {
  await requireAdmin();

  const tier = parseTier(formData.get("tier"));
  const unitPrice = Number(formData.get("unitPrice"));
  if (!tier) return { error: "invalid" };

  try {
    await updatePricingRate(tier, unitPrice);
  } catch {
    return { error: "invalid" };
  }

  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  revalidatePath(`/${safeLocale}/admin/plans`);
  // The public price list reads these rows on every render.
  revalidatePath(`/${safeLocale}/plans`);
  return { saved: true };
}

export type GrantActionState = { error?: string; saved?: { total: number; granted: number } } | null;

/**
 * Hand an event more invitations than were paid for.
 *
 * The reason is required and stored: a grant is capacity with no money behind
 * it, so "why" is the only thing that makes the audit row worth reading later.
 * Every refusal comes back as a code the form renders — an admin who is told
 * "something went wrong" while trying to fix a customer's night will simply
 * press it again.
 */
export async function grantExtraInvitationsAction(
  eventId: string,
  locale: string,
  _prev: GrantActionState,
  formData: FormData,
): Promise<GrantActionState> {
  const admin = await requireAdmin();
  const safeLocale = isLocale(locale) ? locale : defaultLocale;

  const extra = Number(formData.get("extraInvitationCount"));
  const reason = String(formData.get("reason") ?? "");
  // What the panel was showing when it was submitted. The service refuses the
  // write if the column has moved since — see `grantExtraInvitations`.
  const expectedBefore = Number(formData.get("expectedBefore"));

  try {
    const result = await grantExtraInvitations(
      eventId,
      { id: admin.id, name: admin.name, role: admin.role },
      extra,
      reason,
      Number.isInteger(expectedBefore) ? expectedBefore : -1,
    );
    // Both sides: the admin screen he is looking at, and the customer's own
    // dashboard, which is where the new capacity actually has to appear.
    revalidatePath(`/${safeLocale}/admin/events/${eventId}`);
    revalidatePath(`/${safeLocale}/events/${eventId}`);
    revalidatePath(`/${safeLocale}/events`);
    return { saved: { total: result.total, granted: result.granted } };
  } catch (err) {
    if (err instanceof AdminGrantError) return { error: err.message };
    // Anything else — a lock wait that outran the budget, a dropped connection
    // — has to come back as something the panel can render. A thrown server
    // action escapes as an uncaught window error, which leaves an admin
    // staring at a dead button with no idea whether the grant landed.
    logger.error("admin.grant_failed", { eventId, err: String(err) });
    return { error: "generic" };
  }
}
