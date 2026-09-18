import "server-only";
import { prisma } from "@/lib/db/client";
import {
  CoupleFormat,
  EventType,
  HostMode,
  InvitationOpening,
  InvitationTier,
  OrderStatus,
  Prisma,
  Role,
} from "@/generated/prisma/client";
import {
  EventError,
  assertThemeSelectable,
  coupleRows,
  primaryCoupleColumns,
} from "@/lib/events/service";
import { getSessionUser } from "@/lib/auth/session";
import { PAYABLE_ORDER_STATUSES } from "@/lib/orders/status";
import { DEFAULT_MUSIC_TRACK } from "@/lib/themes/builder/content";
import {
  SAMPLE_BRIDE_MOTHER,
  SAMPLE_COUPLE,
  SAMPLE_EVENT_NAME,
  SAMPLE_GROOM_MOTHER,
  SAMPLE_REGION,
  SAMPLE_SCHEDULE,
  SAMPLE_VENUE,
  sampleEventDate,
} from "@/lib/drafts/sample";
import {
  clearDraftToken,
  clientAddressHash,
  issueDraftToken,
  readDraftTokenHash,
  refreshDraftToken,
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

export class DraftError extends Error {}
export class DraftRateLimitError extends DraftError {}

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
  const user = await getSessionUser();
  const ownerId = user?.role === Role.CUSTOMER ? user.id : null;

  // An anonymous draft (ownerId null) may use PUBLIC designs only; a signed-in
  // customer may also use a PRIVATE design assigned to her. A hand-posted
  // private theme id from anyone else is refused here.
  await assertThemeSelectable(input.themeId, input.themeVariantId, { userId: ownerId });

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
    if (repointed.count > 0) {
      // The repoint stamps `updatedAt`, which is the clock the sweep reads —
      // so it has to move the cookie's clock too, or a draft kept alive by
      // gallery taps outlives the only key its browser has to it.
      await refreshDraftToken();
      return existing.id;
    }
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
      // Born complete — see lib/drafts/sample.ts. Every column the details
      // form edits is written here so the first preview shows every screen
      // the finished invitation will have, and the edit page opens with
      // nothing blank.
      name: SAMPLE_EVENT_NAME,
      ...primaryCoupleColumns([SAMPLE_COUPLE]),
      couples: { create: coupleRows([SAMPLE_COUPLE]) },
      openingKind: InvitationOpening.VERSE,
      hostMode: HostMode.TEMPLATE,
      groomMotherAr: SAMPLE_GROOM_MOTHER,
      brideMotherAr: SAMPLE_BRIDE_MOTHER,
      hostLineAr: null,
      coupleFormat: CoupleFormat.ALA,
      // Null means "the default preset" — the renderer resolves it, and the
      // closing field shows it, so the row does not store a copy that would
      // go stale if the preset changed.
      closingAr: null,
      invitationTextAr: "",
      eventDate: sampleEventDate(),
      locationName: SAMPLE_VENUE,
      regionName: SAMPLE_REGION,
      mapUrl: null,
      // Written explicitly rather than left to the renderer's fallback, so
      // the music field opens prefilled and clearing it is her own choice.
      // It starts with the reveal, as the house track always has; switching
      // to "the guest taps to play" is hers to choose.
      musicYoutubeId: DEFAULT_MUSIC_TRACK,
      musicAutoplay: true,
      scheduleItems: SAMPLE_SCHEDULE as unknown as Prisma.InputJsonValue,
      // One standard note on, so the notes screen exists in the preview.
      // Not the entry-pass note: a NO_QR draft has no code to show.
      noteNoPhotos: true,
      noteNoChildren: false,
      noteShowPass: false,
      notesAr: null,
      rsvpRequired: true,
      allowGuestPartySize: true,
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

/**
 * Throws the draft away.
 *
 * Refused while any order is outstanding against it: a PENDING order can still
 * be settled by the payment webhook minutes later, and deleting its draft would
 * turn that into a charge with nothing to activate. A FAILED order counts as
 * outstanding too — a declined card can be retried (see orders/status.ts).
 */
export async function deleteDraft(eventId: string): Promise<void> {
  const [tokenHash, draft] = await Promise.all([
    readDraftTokenHash(),
    prisma.event.findUnique({ where: { id: eventId }, select: { draftTokenHash: true } }),
  ]);
  const outstanding = [...PAYABLE_ORDER_STATUSES, OrderStatus.PAID];

  await prisma.$transaction(async (tx) => {
    const blocking = await tx.order.count({
      where: {
        draftEventId: eventId,
        status: { in: outstanding },
      },
    });
    if (blocking > 0) throw new DraftError("A payment is in progress for this draft");

    // A superseded or refunded order leaves a CANCELLED or REFUNDED row still
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
        status: { notIn: outstanding },
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
