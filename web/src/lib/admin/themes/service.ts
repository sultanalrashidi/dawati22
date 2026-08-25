import "server-only";
import { prisma } from "@/lib/db/client";
import { ThemeEngine, ThemeStatus, ThemeVisibility } from "@/generated/prisma/client";
import { removeStoredAsset } from "@/lib/admin/themes/storage";
import type { ThemeConfig } from "@/lib/themes/types";

export class ThemeAdminError extends Error {}

/**
 * Slugs `prisma/seed.ts` upserts. Deleting one of these removes it from the
 * database, but the next `npm run db:seed` recreates it (the seed upserts by
 * slug), so the confirmation step warns the admin instead of letting a design
 * reappear from nowhere.
 *
 * A literal list is the only honest source here: the seed is a standalone
 * script that opens its own PrismaClient and calls `main()` on import, so it
 * cannot be imported from the app, and nothing on the row itself distinguishes
 * a seeded theme from one an admin created. Keep this list in step with the
 * `themes` array in prisma/seed.ts — a missing entry only costs a warning, not
 * correctness.
 */
export const SEEDED_THEME_SLUGS: ReadonlySet<string> = new Set([
  "palace-gold", "modern-minimal", "botanical-garden", "velvet-midnight",
  "black-tie", "desert-rose", "najdi-modern", "dusty-rose-editorial",
  "pearl-luster", "royal-espresso", "pure-ivory", "the-line",
  "ghost-monogram", "architectural-grid", "stone-serif", "centered-soul",
  "the-frame", "floating-names", "paper-press", "quiet-luxury",
  "grand-ballroom", "palace-entrance", "the-chandelier", "silk-flow",
  "gilded-arch", "majestic-arch", "crowned-typo", "riyadh-horizon",
  "the-gateway", "oasis-couture", "soft-couture", "botanical-fine-line",
  "petal-shadows", "romantic-arch", "midnight-palace", "burgundy-velvet",
  "smoked-glass", "eclipse", "asymmetric-edge", "the-reveal",
  "geometric-play", "typographic-hero", "digital-horizon", "elite-couture",
  "secret-garden", "palace-doors", "immersive-espresso", "rose-candlelight",
  "rose-navy", "rose-emerald", "rose-purple", "rose-blush",
  "rose-charcoal", "ivory-bloom", "ivory-bloom-rose", "ivory-bloom-sage",
  "ivory-bloom-sand", "ivory-bloom-mauve", "ivory-bloom-sky", "ivory-bloom-navy",
  "ivory-bloom-burgundy", "ivory-bloom-mocha", "ribbon-bloom", "marble-bloom",
  "porcelain-seal", "gilded-tassel", "sapphire-bloom", "champagne-tassel",
  "pearl-lace", "pearl-lace-champagne", "pearl-lace-blush", "pearl-lace-sage",
  "pearl-lace-black",
]);

export function isSeededThemeSlug(slug: string): boolean {
  return SEEDED_THEME_SLUGS.has(slug);
}

export interface ThemeInput {
  slug: string;
  name: string;
  nameAr: string;
  category: string;
  /** `null` clears the stored value; `undefined` leaves it untouched on update. */
  description?: string | null;
  descriptionAr?: string | null;
  /**
   * The COMPLETE config to store. The admin editor only has inputs for a
   * subset of `ThemeConfig`, so callers must merge their edits onto the
   * theme's stored config (see `getThemeConfig`) before handing it over —
   * whatever lands here replaces the `config` column wholesale.
   */
  config: ThemeConfig;
}

export async function listAllThemes() {
  return prisma.theme.findMany({
    include: { assets: true, _count: { select: { events: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getThemeForEdit(themeId: string) {
  return prisma.theme.findUnique({
    where: { id: themeId },
    include: { assets: true, _count: { select: { events: true } } },
  });
}

/**
 * The stored config of a single theme, for callers that need to build their
 * edit ON TOP of it rather than from scratch. Returns null when the theme is
 * gone.
 */
export async function getThemeConfig(themeId: string): Promise<ThemeConfig | null> {
  const theme = await prisma.theme.findUnique({ where: { id: themeId }, select: { config: true } });
  return theme ? (theme.config as unknown as ThemeConfig) : null;
}

export async function createTheme(actorId: string, input: ThemeInput) {
  const existing = await prisma.theme.findUnique({ where: { slug: input.slug } });
  if (existing) throw new ThemeAdminError("A theme with this slug already exists");

  return prisma.theme.create({
    data: {
      ...input,
      config: input.config as unknown as object,
      status: ThemeStatus.DRAFT,
      createdById: actorId,
    },
  });
}

export async function duplicateTheme(actorId: string, themeId: string) {
  const source = await prisma.theme.findUnique({ where: { id: themeId } });
  if (!source) throw new ThemeAdminError("Theme not found");

  let slug = `${source.slug}-copy`;
  let n = 2;
  while (await prisma.theme.findUnique({ where: { slug } })) {
    slug = `${source.slug}-copy-${n}`;
    n += 1;
  }

  return prisma.theme.create({
    data: {
      slug,
      name: `${source.name} (copy)`,
      nameAr: `${source.nameAr} (نسخة)`,
      category: source.category,
      description: source.description,
      descriptionAr: source.descriptionAr,
      config: source.config as object,
      status: ThemeStatus.DRAFT,
      createdById: actorId,
    },
  });
}

/**
 * Versioning-safe update: if the theme is already used by any event, editing
 * it must not change what those guests see. We fork a new row (new id/slug,
 * version+1) for the edit and archive the original instead of mutating it —
 * existing events keep pointing at the untouched original.
 */
export async function updateTheme(actorId: string, themeId: string, input: ThemeInput) {
  const theme = await prisma.theme.findUnique({ where: { id: themeId }, include: { _count: { select: { events: true } } } });
  if (!theme) throw new ThemeAdminError("Theme not found");

  // A BUILDER theme's design lives in ThemeLayout/ThemeTypography/ThemeVariant/
  // ThemeAsset rows, none of which the fork below copies — forking one would
  // archive the row holding the design and leave a hollow replacement. The
  // admin page redirects builder themes to their own editor, and this is the
  // backstop for anything that reaches the service directly.
  if (theme.engine === ThemeEngine.BUILDER) {
    throw new ThemeAdminError("هذا التصميم يُعدَّل من المحرر المرئي، مو من المحرر القديم");
  }

  const inUse = theme._count.events > 0;

  if (!inUse) {
    if (input.slug !== theme.slug) {
      const collision = await prisma.theme.findUnique({ where: { slug: input.slug } });
      if (collision) throw new ThemeAdminError("A theme with this slug already exists");
    }
    return prisma.theme.update({
      where: { id: themeId },
      data: { ...input, config: input.config as unknown as object, updatedById: actorId },
    });
  }

  let forkedSlug = `${theme.slug}-v${theme.version + 1}`;
  let n = 2;
  while (await prisma.theme.findUnique({ where: { slug: forkedSlug } })) {
    forkedSlug = `${theme.slug}-v${theme.version + 1}-${n}`;
    n += 1;
  }

  const [, forked] = await prisma.$transaction([
    prisma.theme.update({ where: { id: themeId }, data: { status: ThemeStatus.ARCHIVED } }),
    prisma.theme.create({
      data: {
        ...input,
        slug: forkedSlug,
        version: theme.version + 1,
        // The caller merged its edits onto the stored config, so the fork
        // inherits every key the editor has no input for (artwork `card`,
        // `family`, …) exactly as the archived original had them.
        config: input.config as unknown as object,
        // `null` is an explicit clear, `undefined` means "not edited" — which
        // on a create would silently become NULL, so inherit it instead.
        description: input.description === undefined ? theme.description : input.description,
        descriptionAr: input.descriptionAr === undefined ? theme.descriptionAr : input.descriptionAr,
        // Columns outside ThemeInput: a fork is the same design one version
        // on, so it must inherit them instead of falling back to the schema
        // defaults (which would republish a private theme as public and drop
        // its gallery imagery).
        coverImageUrl: theme.coverImageUrl,
        thumbnailUrl: theme.thumbnailUrl,
        engine: theme.engine,
        occasion: theme.occasion,
        visibility: theme.visibility,
        isCustom: theme.isCustom,
        status: theme.status === ThemeStatus.PUBLISHED ? ThemeStatus.PUBLISHED : ThemeStatus.DRAFT,
        createdById: theme.createdById,
        updatedById: actorId,
      },
    }),
  ]);

  return forked;
}

export async function setThemeStatus(themeId: string, status: ThemeStatus) {
  await prisma.theme.update({
    where: { id: themeId },
    data: { status, archivedAt: status === ThemeStatus.ARCHIVED ? new Date() : null },
  });
}

/**
 * Everything the delete confirmation has to say before the admin commits:
 * how many invitations ride on this design, whether the seed will bring it
 * back, and which published designs the events can be moved onto.
 */
export interface ThemeDeletionContext {
  id: string;
  slug: string;
  name: string;
  nameAr: string;
  status: ThemeStatus;
  /** Events whose `themeId` points here. Each one is a live invitation. */
  eventCount: number;
  /** Pinned-to-an-event rows; dropped by the delete. */
  clientAssignmentCount: number;
  /** Private-theme grants to customers; dropped by the delete. */
  grantCount: number;
  isSeeded: boolean;
  /** Published themes the events can be reassigned to, this one excluded. */
  replacements: Array<{ id: string; name: string; nameAr: string }>;
}

export async function getThemeDeletionContext(themeId: string): Promise<ThemeDeletionContext | null> {
  const theme = await prisma.theme.findUnique({
    where: { id: themeId },
    select: {
      id: true,
      slug: true,
      name: true,
      nameAr: true,
      status: true,
      _count: { select: { events: true, clientAssignments: true, assignments: true } },
    },
  });
  if (!theme) return null;

  const replacements = await prisma.theme.findMany({
    // PUBLIC only: moving another customer's event onto a PRIVATE design would
    // hand them a theme they hold no ThemeAssignment grant for, and the gallery
    // would then refuse to show them the design their own invitation uses.
    where: {
      status: ThemeStatus.PUBLISHED,
      visibility: ThemeVisibility.PUBLIC,
      id: { not: themeId },
    },
    select: { id: true, name: true, nameAr: true },
    orderBy: { nameAr: "asc" },
  });

  return {
    id: theme.id,
    slug: theme.slug,
    name: theme.name,
    nameAr: theme.nameAr,
    status: theme.status,
    eventCount: theme._count.events,
    clientAssignmentCount: theme._count.clientAssignments,
    grantCount: theme._count.assignments,
    isSeeded: isSeededThemeSlug(theme.slug),
    replacements,
  };
}

export type ThemeDeleteErrorCode =
  | "theme_not_found"
  | "replacement_required"
  | "replacement_is_self"
  | "replacement_not_found"
  | "replacement_not_published";

/** Carries a stable code so the action can localise without matching prose. */
export class ThemeDeleteError extends ThemeAdminError {
  readonly code: ThemeDeleteErrorCode;

  constructor(code: ThemeDeleteErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface DeleteThemeOptions {
  /**
   * Where the events using this theme move to. Required whenever the theme is
   * used: `Event.themeId` is a non-null FK with no cascade, so a delete that
   * left events behind would either be rejected by the database or — worse, if
   * the constraint ever changed — leave guests looking at a broken invitation.
   */
  reassignToThemeId?: string | null;
}

/**
 * Delete any theme, in use or not.
 *
 * Relations that go on their own (schema `onDelete: Cascade` on `themeId`):
 * `ThemeVariant`, `ThemeAsset`, `ThemeLayout`, `ThemeTypography`,
 * `ThemeAssignment` — so a BUILDER theme's whole document tree dies with the
 * row. `ClientAssignedTheme` has NO cascade and would block the delete, so it
 * is removed explicitly; `ThemeAssignment` is removed explicitly too, so the
 * transaction reads as the complete list of what it drops rather than relying
 * on a schema detail one migration away from changing.
 *
 * Stored objects are not a relation and nothing cleans them up: the asset rows
 * are collected BEFORE the delete and their blobs removed after it commits.
 */
export async function deleteTheme(themeId: string, options: DeleteThemeOptions = {}) {
  const theme = await prisma.theme.findUnique({
    where: { id: themeId },
    include: { _count: { select: { events: true } } },
  });
  if (!theme) throw new ThemeDeleteError("theme_not_found", "Theme not found");

  const replacementId = options.reassignToThemeId?.trim() || null;

  if (theme._count.events > 0 && !replacementId) {
    throw new ThemeDeleteError(
      "replacement_required",
      "Theme is used by existing events; a replacement theme is required"
    );
  }

  if (replacementId) {
    if (replacementId === themeId) {
      throw new ThemeDeleteError("replacement_is_self", "The replacement cannot be the theme being deleted");
    }
    const replacement = await prisma.theme.findUnique({
      where: { id: replacementId },
      select: { id: true, status: true, visibility: true },
    });
    if (!replacement) throw new ThemeDeleteError("replacement_not_found", "Replacement theme not found");
    // Re-checked server-side, not just filtered in the dropdown: the id comes
    // from the browser and a crafted request must not be able to move events
    // onto a draft, archived or private design.
    if (replacement.status !== ThemeStatus.PUBLISHED || replacement.visibility !== ThemeVisibility.PUBLIC) {
      throw new ThemeDeleteError("replacement_not_published", "The replacement theme must be published and public");
    }
  }

  // Read the objects this theme owns while its rows still exist — they cascade
  // away with the theme and would otherwise be unrecoverable. A NULL blobPath
  // means the file is git-tracked art under `public/themes/` shared with every
  // other theme naming the same `assetFolder` (see legacy-import.ts), so those
  // rows are filtered out here and their files left untouched.
  const ownedAssets = await prisma.themeAsset.findMany({
    where: { themeId, blobPath: { not: null } },
    select: { blobPath: true },
  });

  await prisma.$transaction(async (tx) => {
    // Unconditional when a replacement was given, not gated on the count read
    // above: an event created between that read and this transaction is moved
    // too, instead of aborting the delete on a foreign key error.
    if (replacementId) {
      // `themeVariantId` is cleared with the move: it names a colour of the
      // design being deleted, which the replacement does not have. The FK's
      // SetNull would catch it a moment later when the variants cascade away,
      // but leaving it to that would briefly point live events at a colour of
      // a theme they no longer use.
      await tx.event.updateMany({
        where: { themeId },
        data: { themeId: replacementId, themeVariantId: null },
      });
    }
    await tx.clientAssignedTheme.deleteMany({ where: { themeId } });
    await tx.themeAssignment.deleteMany({ where: { themeId } });
    await tx.theme.delete({ where: { id: themeId } });
  });

  // After the commit: a failed blob delete costs storage, a failed one before
  // the commit would have deleted art off a theme that still exists.
  for (const asset of ownedAssets) await removeStoredAsset(asset.blobPath);
}

export async function addThemeAsset(
  themeId: string,
  input: { slot: string; url: string; mimeType: string; fileSize: number; width?: number; height?: number }
) {
  return prisma.themeAsset.create({ data: { themeId, ...input } });
}

export async function removeThemeAsset(assetId: string) {
  await prisma.themeAsset.delete({ where: { id: assetId } });
}

export async function assignThemeToEvent(themeId: string, eventId: string, assignedById: string) {
  const theme = await prisma.theme.findUnique({ where: { id: themeId } });
  if (!theme) throw new ThemeAdminError("Theme not found");

  await prisma.$transaction([
    prisma.clientAssignedTheme.deleteMany({ where: { eventId } }),
    prisma.clientAssignedTheme.create({ data: { themeId, eventId, assignedById } }),
    // Clear the colour: it belongs to the OLD design's variant list, and a
    // leftover id would point this event at another theme's artwork.
    prisma.event.update({ where: { id: eventId }, data: { themeId, themeVariantId: null } }),
  ]);
}
