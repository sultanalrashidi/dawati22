"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
import { EventError, storedMusicTrack, updateEventDetails } from "@/lib/events/service";
import { markInvitationShared, markEventInvitationsShared } from "@/lib/guests/service";
import { readEventForm } from "@/lib/events/form";
import { resolveMusicLink } from "@/lib/music/link";
import { sweepAbandonedDrafts } from "@/lib/drafts/sweep";
import { Role, EventStatus } from "@/generated/prisma/client";
import { InvitationTier } from "@/generated/prisma/enums";
import { parseTier } from "@/lib/orders/pricing";
import { buildPriceOffer, type OfferInputError } from "@/lib/orders/offer";
import { listPricingRates } from "@/lib/orders/service";
import { getPriceOffer, setPriceOffer } from "@/lib/settings/service";
import { riyadhDateTimeLocalToDate } from "@/lib/dates";
import { buildDiscountCode, type CodeInputError } from "@/lib/discounts/rules";
import {
  DiscountCodeTakenError,
  createDiscountCode,
  deleteUnusedDiscountCode,
  getDiscountCode,
  setDiscountCodeActive,
  updateDiscountCode,
} from "@/lib/discounts/service";
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
 * "The team sent this event's invitations" — and the undo for the badge.
 *
 * Marking it done is also what records every invitation still unsent as sent.
 * On a team-managed event the customer never presses a share button, so
 * without this her dashboard would report nothing sent and her details would
 * stay editable while the invitations were in her guests' phones.
 *
 * It used to happen when the team COPIED the whole list, which is not
 * sending: copying the list to work through it marked all five hundred
 * delivered at once, before a single message had gone out. The button asks
 * first, because a recorded send is not taken back — the undo reopens the
 * badge only.
 */
export async function toggleGuestMgmtDoneAction(eventId: string, locale: string, done: boolean) {
  const admin = await requireAdmin();
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  if (done) await markEventInvitationsShared(eventId);
  await setGuestManagementDone(eventId, admin.id, done);
  revalidatePath(`/${safeLocale}/admin/events`);
  revalidatePath(`/${safeLocale}/admin/events/${eventId}/guests`);
  revalidatePath(`/${safeLocale}/events/${eventId}`);
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

  // As on the customer's page: a song link that does not play keeps the
  // event's current song, and everything else still saves.
  const music = await resolveMusicLink(formData.get("musicUrl"));
  const fields = readEventForm(formData, {
    musicTrack: music.ok ? music.track : await storedMusicTrack(eventId),
  });
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
  if (!music.ok) return { error: "music" };
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

  revalidatePricePages(locale);
  return { saved: true };
}

/**
 * The pricing page and the landing page are static files that quote the
 * prices; both are rebuilt now rather than at the end of their window. Every
 * locale, since a price is the same number in each.
 */
function revalidatePricePages(locale: string) {
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  revalidatePath(`/${safeLocale}/admin/plans`);
  revalidatePath("/[locale]/plans", "page");
  revalidatePath("/[locale]", "page");
}

export type OfferFormState = { error?: OfferInputError; saved?: boolean } | null;

/**
 * Saves the price offer and switches it on. The dates are Riyadh wall-clock
 * readings from `datetime-local` fields; the offer starts and stops by itself
 * at them, and only orders raised in between are charged the offer price.
 */
export async function savePriceOfferAction(
  locale: string,
  _prev: OfferFormState,
  formData: FormData,
): Promise<OfferFormState> {
  await requireAdmin();

  const rates = await listPricingRates();
  const regular = (tier: InvitationTier) => {
    const rate = rates.find((r) => r.tier === tier);
    return rate ? Number(rate.unitPrice) : null;
  };
  const built = buildPriceOffer(
    {
      nameAr: String(formData.get("nameAr") ?? ""),
      nameEn: String(formData.get("nameEn") ?? ""),
      withQr: Number(formData.get("withQr")),
      noQr: Number(formData.get("noQr")),
      startsAt: riyadhDateTimeLocalToDate(String(formData.get("startsAt") ?? "")),
      endsAt: riyadhDateTimeLocalToDate(String(formData.get("endsAt") ?? "")),
    },
    { withQr: regular(InvitationTier.WITH_QR), noQr: regular(InvitationTier.NO_QR) },
    new Date(),
  );
  if ("error" in built) return { error: built.error };

  await setPriceOffer(built.offer);
  revalidatePricePages(locale);
  return { saved: true };
}

/** Stops the offer at once. Its fields stay, so the next occasion starts from them. */
export async function stopPriceOfferAction(locale: string) {
  await requireAdmin();
  const offer = await getPriceOffer();
  if (offer) await setPriceOffer({ ...offer, enabled: false });
  revalidatePricePages(locale);
}

export type DiscountCodeFormState = { error?: CodeInputError | "taken"; saved?: boolean } | null;

/** An empty `datetime-local` is an open end, not a mistake. */
function optionalRiyadhDate(value: FormDataEntryValue | null): Date | null {
  const text = String(value ?? "").trim();
  return text ? riyadhDateTimeLocalToDate(text) : null;
}

function readDiscountCodeForm(formData: FormData, code: string) {
  const maxUses = String(formData.get("maxUses") ?? "").trim();
  return buildDiscountCode(
    {
      code,
      kind: String(formData.get("kind") ?? ""),
      value: Number(formData.get("value")),
      maxUses: maxUses === "" ? null : Number(maxUses),
      startsAt: optionalRiyadhDate(formData.get("startsAt")),
      endsAt: optionalRiyadhDate(formData.get("endsAt")),
    },
    new Date(),
  );
}

function discountsPath(locale: string) {
  return `/${isLocale(locale) ? locale : defaultLocale}/admin/discounts`;
}

export async function createDiscountCodeAction(
  locale: string,
  _prev: DiscountCodeFormState,
  formData: FormData,
): Promise<DiscountCodeFormState> {
  await requireAdmin();
  const built = readDiscountCodeForm(formData, String(formData.get("code") ?? ""));
  if ("error" in built) return { error: built.error };
  try {
    await createDiscountCode(built.code);
  } catch (err) {
    if (err instanceof DiscountCodeTakenError) return { error: "taken" };
    throw err;
  }
  revalidatePath(discountsPath(locale));
  return { saved: true };
}

/** Everything but the code itself, which stays as customers were given it. */
export async function updateDiscountCodeAction(
  id: string,
  locale: string,
  _prev: DiscountCodeFormState,
  formData: FormData,
): Promise<DiscountCodeFormState> {
  await requireAdmin();
  const existing = await getDiscountCode(id);
  if (!existing) return { error: "code" };
  const built = readDiscountCodeForm(formData, existing.code);
  if ("error" in built) return { error: built.error };
  const { kind, value, maxUses, startsAt, endsAt } = built.code;
  await updateDiscountCode(id, { kind, value, maxUses, startsAt, endsAt });
  revalidatePath(discountsPath(locale));
  redirect(discountsPath(locale));
}

export async function setDiscountCodeActiveAction(id: string, locale: string, active: boolean) {
  await requireAdmin();
  await setDiscountCodeActive(id, active);
  revalidatePath(discountsPath(locale));
}

/** Refused quietly for a code any order carries — the page offers «إيقاف» for those instead. */
export async function deleteDiscountCodeAction(id: string, locale: string) {
  await requireAdmin();
  await deleteUnusedDiscountCode(id);
  revalidatePath(discountsPath(locale));
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
