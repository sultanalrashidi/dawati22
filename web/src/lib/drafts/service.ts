import "server-only";
import { prisma } from "@/lib/db/client";
import { EventType, InvitationTier, OrderStatus, Role } from "@/generated/prisma/client";
import {
  EventError,
  assertThemeSelectable,
  coupleRows,
  primaryCoupleColumns,
} from "@/lib/events/service";
import type { EventEssentials } from "@/lib/events/form";
import { getSessionUser } from "@/lib/auth/session";
import {
  clearDraftToken,
  clientAddressHash,
  issueDraftToken,
  readDraftTokenHash,
} from "@/lib/drafts/session";

/**
 * A draft is an invitation somebody is designing but has not paid for: a real
 * Event row with no order and, until she signs in, no owner.
 *
 * It is deliberately the same row the paid event will become, rather than a
 * separate table. The reason is the payment path: if the Event were created at
 * the moment the card is charged, creation could fail (the design archived
 * mid-flow, a reference-code collision) AFTER the money moved, and the customer
 * would be charged for nothing. Because the row already exists, activating it
 * is a single update that cannot fail.
 *
 * What used to stop an unpaid invitation being shared was `Event.orderId` being
 * NOT NULL. That guarantee now lives at the real chokepoint instead: guest
 * creation is the only code in the product that mints an invitation link, and
 * it refuses an event with no order. A draft also has no reference code, which
 * is the only way the door scanner can find an event.
 */

/**
 * Anonymous starts per address per hour.
 *
 * Only anonymous ones are counted: a signed-in customer is already a phone
 * number that survived an OTP, which is a far better identity than an address
 * shared by everyone on a carrier's CGNAT pool, a mall's wifi or one family's
 * router. Rate-limiting her too would punish the ordinary case (a bride
 * comparing designs on hotel wifi) for a threat she does not represent.
 */
const DRAFT_RATE_LIMIT = 20;
const DRAFT_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Placeholders for the columns the database requires but the gallery cannot
 * know yet. They live for the few seconds between picking a design and saving
 * the basics; the preview is not reachable until the basics are in.
 */
const DRAFT_PLACEHOLDER_NAME = "دعوة جديدة";
const DRAFT_PLACEHOLDER_DAYS_AHEAD = 60;

export class DraftError extends Error {}
export class DraftRateLimitError extends DraftError {}

function placeholderDate() {
  return new Date(Date.now() + DRAFT_PLACEHOLDER_DAYS_AHEAD * 24 * 60 * 60 * 1000);
}

/** The event's own name, composed from the couple — groom first, as everywhere. */
function composeEventName(essentials: EventEssentials): string {
  const [couple] = essentials.couples;
  const groom = couple.groomNameAr?.trim() || couple.groomNameEn.trim();
  const bride = couple.brideNameAr?.trim() || couple.brideNameEn.trim();
  return groom && bride ? `حفل زفاف ${groom} و ${bride}` : DRAFT_PLACEHOLDER_NAME;
}

async function assertUnderRateLimit() {
  const ipHash = await clientAddressHash();
  const since = new Date(Date.now() - DRAFT_RATE_WINDOW_MS);
  const recent = await prisma.draftCreationAttempt.count({ where: { ipHash, createdAt: { gte: since } } });
  if (recent >= DRAFT_RATE_LIMIT) throw new DraftRateLimitError("Too many drafts started");
  await prisma.draftCreationAttempt.create({ data: { ipHash } });
}

export interface StartDraftInput {
  themeId: string;
  themeVariantId: string | null;
  /** What she picked on /plans before designing, if she came that way. */
  intendedTier?: InvitationTier | null;
  intendedCount?: number | null;
}

/**
 * Starts (or re-points) the free draft this browser is working on.
 *
 * A browser already carrying an unclaimed draft gets that same draft moved onto
 * the newly chosen design rather than a second row — changing your mind about a
 * design is the most ordinary thing on the gallery, and it must not litter.
 */
export async function startDraft(input: StartDraftInput): Promise<string> {
  await assertThemeSelectable(input.themeId, input.themeVariantId);

  const user = await getSessionUser();
  const ownerId = user?.role === Role.CUSTOMER ? user.id : null;

  // Only what was actually supplied. Coercing a missing tier/count to null
  // would mean arriving at the gallery a second time (from the header, or via
  // "change design") silently wiping the package she picked on the pricing
  // page — the one thing that link exists to carry.
  const design: {
    themeId: string;
    themeVariantId: string | null;
    intendedTier?: InvitationTier;
    intendedCount?: number;
  } = { themeId: input.themeId, themeVariantId: input.themeVariantId };
  if (input.intendedTier) design.intendedTier = input.intendedTier;
  if (input.intendedCount) design.intendedCount = input.intendedCount;

  // The draft this BROWSER is working on, if it is still hers to change.
  const existing = await findResumableDraft(ownerId);
  if (existing) {
    const repointed = await prisma.event.updateMany({
      // `orderId: null` again: she may have paid in another tab since the page
      // she is clicking from was rendered, and an activated event must never
      // have its design changed by a gallery click.
      where: { id: existing.id, orderId: null },
      data: { ...design, ...(ownerId && existing.ownerId === null ? { ownerId } : {}) },
    });
    if (repointed.count > 0) return existing.id;
  }

  // Only anonymous starts are throttled — see DRAFT_RATE_LIMIT.
  if (!ownerId) await assertUnderRateLimit();

  // The cookie is issued for everyone, not just anonymous visitors: it means
  // "the draft this browser is working on", which is a different question from
  // "who owns it". Ownership is what grants access; the cookie only decides
  // which draft a second tap on the gallery continues.
  const draftTokenHash = await issueDraftToken();

  const draft = await prisma.event.create({
    data: {
      ownerId,
      orderId: null,
      draftTokenHash,
      type: EventType.WEDDING,
      name: DRAFT_PLACEHOLDER_NAME,
      eventDate: placeholderDate(),
      locationName: "",
      // Explicit, not defaulted: hasQr defaults to true for the benefit of
      // legacy rows, and a draft that inherited that default would be handing
      // out the paid entry pass. It is set for real from the order at payment.
      hasQr: false,
      referenceCode: null,
      ...design,
    },
    select: { id: true },
  });

  return draft.id;
}

/**
 * The draft this browser is mid-way through — and only that one.
 *
 * Keyed on the cookie rather than on "any unpaid event this customer owns",
 * which would mean a returning customer could never start a second invitation:
 * her first one would silently be dragged onto whatever design she tapped
 * next. A browser with no cookie starts something new.
 *
 * The ownership test is what makes the cookie safe on a shared phone: it
 * resumes a draft that is either nobody's yet, or already this customer's.
 */
async function findResumableDraft(ownerId: string | null) {
  const tokenHash = await readDraftTokenHash();
  if (!tokenHash) return null;

  const draft = await prisma.event.findFirst({
    where: { draftTokenHash: tokenHash, orderId: null },
    select: { id: true, ownerId: true },
  });
  if (!draft) return null;
  if (draft.ownerId !== null && draft.ownerId !== ownerId) return null;
  return draft;
}

const DRAFT_INCLUDE = {
  theme: { include: { variants: { orderBy: { sortOrder: "asc" } } } },
  couples: { orderBy: { sortOrder: "asc" } },
} as const;

export type DraftWithDesign = NonNullable<Awaited<ReturnType<typeof resolveDraftAccess>>>;

/**
 * The draft, if this caller is allowed to work on it — otherwise null, with no
 * hint that it exists.
 *
 * Two ways in, and only two:
 *  - she is signed in and owns it;
 *  - it has NO owner and her cookie matches.
 *
 * The second is checked against `ownerId: null` on purpose. Without that, an
 * old cookie would keep opening a draft after it had been claimed by an
 * account — including on a shared phone, where the previous person's cookie is
 * still sitting there.
 *
 * This function is READ-ONLY, and deliberately so. It is called from page
 * renders, where Next refuses to let cookies be written at all — and where
 * silently transferring ownership on a GET would be wrong anyway, since a
 * back button, a restored tab or a link prefetch all reach a URL without
 * anyone deciding anything. Ownership moves in `claimDraft`, from an action.
 */
export async function resolveDraftAccess(eventId: string) {
  const [user, tokenHash] = await Promise.all([getSessionUser(), readDraftTokenHash()]);

  const draft = await prisma.event.findFirst({
    where: { id: eventId, orderId: null },
    include: DRAFT_INCLUDE,
  });
  if (!draft) return null;

  const isOwner = Boolean(user && draft.ownerId === user.id);
  const isBearer = draft.ownerId === null && tokenHash !== null && draft.draftTokenHash === tokenHash;
  if (!isOwner && !isBearer) return null;

  return draft;
}

/**
 * Attaches an unowned draft to the customer who is working on it.
 *
 * Call only from a server action — it writes. Guarded by `ownerId: null` so a
 * draft somebody else already claimed is left alone rather than stolen, and it
 * never throws: failing to claim costs her the link between the draft and her
 * account, which the next save will try again, not the work itself.
 *
 * The cookie is deliberately NOT cleared. Once `draftTokenHash` is null the
 * cookie opens nothing — `resolveDraftAccess` only trusts it on an ownerless
 * row — so it is already inert, and clearing it would drop the pointer to
 * "the draft this browser is working on" that the gallery uses to resume.
 */
export async function claimDraft(eventId: string): Promise<void> {
  const [user, tokenHash] = await Promise.all([getSessionUser(), readDraftTokenHash()]);
  if (!user || user.role !== Role.CUSTOMER || !tokenHash) return;

  await prisma.event.updateMany({
    where: { id: eventId, ownerId: null, orderId: null, draftTokenHash: tokenHash },
    data: { ownerId: user.id },
  });
}

/** Whether the basics have been filled in — what the preview waits for. */
export function draftHasBasics(draft: { locationName: string; couples: { groomNameAr: string | null }[] }): boolean {
  return draft.locationName.trim().length > 0 && draft.couples.length > 0;
}

/**
 * Saves the three things the free form asks for.
 *
 * Only ever touches a draft: an activated event goes through
 * updateEventDetails, which enforces the edit lock. Callers get the draft from
 * resolveDraftAccess, so permission is already settled by the time we get here
 * — but the `orderId: null` in the update's own filter means a draft that was
 * activated in between (she paid in another tab) cannot be written by this
 * path anyway.
 */
export async function saveDraftBasics(eventId: string, essentials: EventEssentials): Promise<void> {
  // One transaction for all three writes. The Event's own columns mirror the
  // primary couple, so committing them without the EventCouple rows would
  // leave the invitation printing one set of names from its columns and
  // another from its rows.
  // Interactive rather than the array form: the guard has to be able to ABORT
  // the transaction. Checking the count after an array transaction would be
  // too late — the couple rows would already have been replaced on a draft
  // that turned out to be activated or locked.
  await prisma.$transaction(async (tx) => {
    const updated = await tx.event.updateMany({
      where: { id: eventId, orderId: null, detailsLockedAt: null },
      data: {
        name: composeEventName(essentials),
        eventDate: essentials.eventDate,
        locationName: essentials.locationName,
        regionName: essentials.regionName || null,
        ...primaryCoupleColumns(essentials.couples),
      },
    });
    if (updated.count === 0) throw new EventError("Draft is no longer editable");

    // Replaced wholesale rather than diffed — the same thing updateEventDetails
    // does, and the only way a removed couple actually disappears.
    await tx.eventCouple.deleteMany({ where: { eventId } });
    await tx.eventCouple.createMany({
      data: coupleRows(essentials.couples).map((row) => ({ ...row, eventId })),
    });
  });
}

/**
 * Throws the draft away.
 *
 * Refused while any order is outstanding against it: a PENDING order can still
 * be settled by the payment webhook minutes later, and deleting its draft would
 * turn that into a charge with nothing to activate.
 */
export async function deleteDraft(eventId: string): Promise<void> {
  const [tokenHash, draft] = await Promise.all([
    readDraftTokenHash(),
    prisma.event.findUnique({ where: { id: eventId }, select: { draftTokenHash: true } }),
  ]);

  await prisma.$transaction(async (tx) => {
    const blocking = await tx.order.count({
      where: {
        draftEventId: eventId,
        status: { in: [OrderStatus.PENDING, OrderStatus.PAID] },
      },
    });
    if (blocking > 0) throw new DraftError("A payment is in progress for this draft");

    // A card that was declined leaves a CANCELLED or FAILED order still
    // POINTING at this draft, and `Order.draftEventId` is onDelete: Restrict —
    // so without this the database refuses the delete and she cannot remove
    // her own invitation. Nothing is lost: the order keeps its own record of
    // what was attempted, it just stops naming a row that is going away.
    //
    // Inside the transaction with the delete, so that if the draft turns out
    // to have been activated in another tab the pointer-nulling rolls back
    // with it rather than orphaning a live event's order.
    await tx.order.updateMany({
      where: {
        draftEventId: eventId,
        status: { notIn: [OrderStatus.PENDING, OrderStatus.PAID] },
      },
      data: { draftEventId: null },
    });

    const deleted = await tx.event.deleteMany({ where: { id: eventId, orderId: null } });
    if (deleted.count === 0) throw new EventError("Draft not found");
  });

  // Only when the cookie pointed at THIS draft. A signed-in customer deleting
  // one of several drafts must not lose the pointer to the one she is actually
  // working on in this browser.
  if (tokenHash && draft?.draftTokenHash === tokenHash) await clearDraftToken();
}
