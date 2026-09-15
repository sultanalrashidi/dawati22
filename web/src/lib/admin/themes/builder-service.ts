import "server-only";
import { prisma } from "@/lib/db/client";
import { getTypographyPreset } from "@/lib/settings/service";
import { presetToTypographyDoc } from "@/lib/themes/typography-preset";
import {
  Prisma,
  ThemeEngine,
  ThemeStatus,
  ThemeVisibility,
  type ThemeOccasion,
} from "@/generated/prisma/client";
import { ThemeAdminError } from "@/lib/admin/themes/service";
import { removeStoredAsset } from "@/lib/admin/themes/storage";
import { REQUIRED_SLOT_KEYS } from "@/lib/themes/builder/slots";
import {
  assertLayoutDoc,
  assertLayoutOverrides,
  assertPalette,
  assertTypographyDoc,
  parseLayoutDoc,
  parsePalette,
  parseTypographyDoc,
} from "@/lib/themes/builder/schema";
import { jasmineNewDesignLayout, REFERENCE_THEME_SLUG } from "@/lib/themes/builder/jasmine-standard";
import {
  DEFAULT_LAYOUT_DOC,
  DEFAULT_PALETTE,
  DEFAULT_TYPOGRAPHY_DOC,
  type LayoutDoc,
  type TypographyDoc,
  type VariantPalette,
} from "@/lib/themes/builder/types";
import { parseLayoutOverrides, type LayoutOverrides } from "@/lib/themes/builder/resolve";
import { ensureInkRoles } from "@/lib/themes/builder/ink-roles-server";
import { copyLayerOverrides, withNoQrPass, type NoQrPassRefusal } from "@/lib/themes/builder/no-qr-pass";

const json = (value: unknown) => value as Prisma.InputJsonValue;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

const builderInclude = {
  variants: { orderBy: { sortOrder: "asc" } },
  assets: true,
  layout: true,
  typography: true,
  assignments: { include: { user: { select: { id: true, name: true, phone: true } } } },
  _count: { select: { events: true } },
} satisfies Prisma.ThemeInclude;

export type BuilderThemeRow = Prisma.ThemeGetPayload<{ include: typeof builderInclude }>;

/** A builder theme with every stored document already validated. */
export interface BuilderTheme {
  theme: BuilderThemeRow;
  layout: LayoutDoc;
  /**
   * `ThemeLayout.updatedAt` as it stands AFTER hydration, which is the revision
   * a conditional save must match. Read fresh rather than taken from the row
   * loaded above, because `ensureInkRoles` may rewrite the document during this
   * very call — handing the editor the pre-upgrade stamp would make its first
   * save fail against a change it caused itself.
   */
  layoutUpdatedAt: Date | null;
  typography: TypographyDoc;
  variants: {
    id: string;
    slug: string;
    name: string;
    nameAr: string;
    colorTag: string | null;
    palette: VariantPalette;
    overrides: LayoutOverrides;
    isDefault: boolean;
    sortOrder: number;
  }[];
  assets: { id: string; slot: string; url: string; variantId: string | null; blobPath: string | null; width: number | null; height: number | null; fileSize: number | null }[];
}

async function hydrate(row: BuilderThemeRow): Promise<BuilderTheme> {
  const variants = row.variants.map((v) => ({
    id: v.id,
    slug: v.slug,
    name: v.name,
    nameAr: v.nameAr,
    colorTag: v.colorTag,
    palette: parsePalette(v.palette),
    overrides: parseLayoutOverrides(v.layoutOverrides),
    isDefault: v.isDefault,
    sortOrder: v.sortOrder,
  }));
  // The editor must open the same document a guest sees — see ink-roles.ts.
  const ink = await ensureInkRoles(row.id, row.layout?.doc, parseLayoutDoc(row.layout?.doc), variants);
  const current = await prisma.themeLayout.findUnique({
    where: { themeId: row.id },
    select: { updatedAt: true },
  });
  return {
    theme: row,
    layout: ink.layout,
    layoutUpdatedAt: current?.updatedAt ?? null,
    typography: parseTypographyDoc(row.typography?.doc),
    variants: variants.map((v) => ({ ...v, overrides: ink.overrides.get(v.id) ?? v.overrides })),
    assets: row.assets.map((a) => ({
      id: a.id,
      slot: a.slot,
      url: a.url,
      variantId: a.variantId,
      blobPath: a.blobPath,
      width: a.width,
      height: a.height,
      fileSize: a.fileSize,
    })),
  };
}

export async function getBuilderTheme(themeId: string): Promise<BuilderTheme | null> {
  const row = await prisma.theme.findUnique({ where: { id: themeId }, include: builderInclude });
  return row ? hydrate(row) : null;
}

export async function getBuilderThemeBySlug(slug: string): Promise<BuilderTheme | null> {
  const row = await prisma.theme.findUnique({ where: { slug }, include: builderInclude });
  return row ? hydrate(row) : null;
}

export async function listBuilderThemes() {
  return prisma.theme.findMany({
    where: { engine: ThemeEngine.BUILDER },
    include: { variants: { orderBy: { sortOrder: "asc" } }, _count: { select: { events: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// Theme lifecycle
// ---------------------------------------------------------------------------

export interface CreateBuilderThemeInput {
  slug: string;
  name: string;
  nameAr: string;
  category: string;
  occasion: ThemeOccasion;
  descriptionAr?: string;
  description?: string;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function assertSlug(slug: string) {
  if (!SLUG_PATTERN.test(slug)) {
    throw new ThemeAdminError("المعرّف يجب أن يكون أحرفًا إنجليزية صغيرة وأرقامًا وشرطات فقط");
  }
}

/**
 * A new builder theme is born complete: one default variant, a typography
 * document, and a *starter layout* with the standard invitation elements
 * already placed and bound to the real fields (guest name, couple names, date,
 * location, QR). An empty canvas would make every new design start with the
 * same twenty minutes of rebuilding the same list.
 */
export async function createBuilderTheme(actorId: string, input: CreateBuilderThemeInput) {
  assertSlug(input.slug);
  const clash = await prisma.theme.findUnique({ where: { slug: input.slug }, select: { id: true } });
  if (clash) throw new ThemeAdminError("يوجد تصميم بنفس المعرّف");

  return prisma.theme.create({
    data: {
      slug: input.slug,
      name: input.name,
      nameAr: input.nameAr,
      category: input.category,
      occasion: input.occasion,
      description: input.description,
      descriptionAr: input.descriptionAr,
      engine: ThemeEngine.BUILDER,
      status: ThemeStatus.DRAFT,
      visibility: ThemeVisibility.PUBLIC,
      config: json({ engine: "builder" }),
      createdById: actorId,
      // عروس الياسمين's screens, lines and entry pass, so a new design opens
      // already reading like the rest of the collection; the admin moves what
      // the new artwork needs moved.
      layout: { create: { doc: json(await newDesignStart()) } },
      // The house typeface, so a new design starts consistent instead of
      // starting from a default and being corrected afterwards.
      typography: { create: { doc: json(presetToTypographyDoc(await getTypographyPreset())) } },
      variants: {
        create: {
          slug: "default",
          name: "Default",
          nameAr: "الأساسي",
          palette: json(DEFAULT_PALETTE),
          isDefault: true,
          sortOrder: 0,
        },
      },
    },
    include: builderInclude,
  });
}

export interface UpdateBuilderThemeMetaInput {
  name: string;
  nameAr: string;
  category: string;
  occasion: ThemeOccasion;
  descriptionAr?: string;
  description?: string;
  visibility: ThemeVisibility;
  thumbnailUrl?: string | null;
}

export async function updateBuilderThemeMeta(actorId: string, themeId: string, input: UpdateBuilderThemeMetaInput) {
  return prisma.theme.update({
    where: { id: themeId },
    data: { ...input, updatedById: actorId },
  });
}

/**
 * Write the shared layout — optionally only if nobody else has since you read it.
 *
 * A PUBLISHED theme has no draft layout: this row is what every live
 * invitation renders from, and the editor of one admin knows nothing about the
 * editor of another. Unconditional, this is last-write-wins on data that
 * hundreds of guests are reading — a colleague's half hour of work disappears
 * with nothing to show it ever existed.
 *
 * So a caller that read the document may pass the `updatedAt` it read, and the
 * write happens only if the row still carries it. `expectedUpdatedAt` is
 * optional because the starter-layout path and the importer both write rows
 * they have just created, where there is nothing to race.
 *
 * A refusal is not a failure to retry: it means the document on screen is no
 * longer the document in the database, and the right move is to reload and
 * look before deciding.
 */
export async function saveLayoutDoc(
  actorId: string,
  themeId: string,
  raw: unknown,
  expectedUpdatedAt?: Date | string | null,
) {
  const doc = assertLayoutDoc(raw);

  if (expectedUpdatedAt) {
    const expected = new Date(expectedUpdatedAt);
    if (Number.isNaN(expected.getTime())) throw new ThemeAdminError("طابع المراجعة غير صالح");

    await prisma.$transaction(async (tx) => {
      const applied = await tx.themeLayout.updateMany({
        where: { themeId, updatedAt: expected },
        data: { doc: json(doc) },
      });
      if (applied.count === 0) {
        throw new ThemeAdminError(
          "تغيّر التصميم من جهة ثانية بعد ما فتحت المحرر. حدّث الصفحة وراجع الفرق قبل الحفظ — ما كتبنا شيئًا.",
        );
      }
      await tx.theme.update({ where: { id: themeId }, data: { updatedById: actorId } });
    });
    return doc;
  }

  await prisma.$transaction([
    prisma.themeLayout.upsert({
      where: { themeId },
      create: { themeId, doc: json(doc) },
      update: { doc: json(doc) },
    }),
    prisma.theme.update({ where: { id: themeId }, data: { updatedById: actorId } }),
  ]);
  return doc;
}

/**
 * Drop the starter elements into an existing theme. Offered for themes created
 * before the starter existed, and as a way back after clearing the canvas.
 *
 * Adds ONLY the layers. The stored page background, scene aspect ratios and
 * animation settings are document-level settings an admin may already have
 * tuned on an otherwise empty canvas — replacing the whole document (which is
 * what a naive "write the starter" would do) would silently reset all three
 * while the guard only ever looked at the layer count.
 */
export async function applyStarterLayout(actorId: string, themeId: string) {
  const existing = await prisma.themeLayout.findUnique({ where: { themeId } });
  const current = parseLayoutDoc(existing?.doc);
  if (current.layers.length > 0) {
    throw new ThemeAdminError("التصميم فيه عناصر بالفعل — احذفها أولاً إذا تبي تبدأ من جديد");
  }
  return saveLayoutDoc(actorId, themeId, { ...current, layers: (await newDesignStart()).layers });
}

const NO_QR_PASS_REFUSALS: Record<NoQrPassRefusal, string> = {
  exists: "التصميم فيه بطاقة بدون باركود من قبل — تلقاها في الشاشات.",
  noPass: "التصميم ما فيه «بطاقة الدخول» ننسخ منها.",
  full: "التصميم وصل الحد الأقصى للشاشات أو العناصر — احذف شي ما تحتاجه وجرّب مرة ثانية.",
};

/**
 * Give a design its own no-barcode pass: a copy of its pass without the code,
 * which the owner then arranges on its own (see no-qr-pass.ts). Every colour's
 * own tweaks to the pass are copied onto the new layers in the same
 * transaction, so the copy looks exactly like the automatic card it replaces.
 *
 * Built from the document as the editor loads it (`getBuilderTheme`), and only
 * written if the stored row is still the revision the editor opened — the same
 * guard as `saveLayoutDoc`, because a live design is being changed.
 */
export async function createNoQrPass(
  actorId: string,
  themeId: string,
  expectedUpdatedAt: string | null,
): Promise<string> {
  const stale = "تغيّر التصميم من جهة ثانية بعد ما فتحت المحرر. حدّث الصفحة وجرّب مرة ثانية — ما كتبنا شيئًا.";
  const builder = await getBuilderTheme(themeId);
  if (!builder) throw new ThemeAdminError("التصميم غير موجود");
  const revision = builder.layoutUpdatedAt;
  if (!revision) throw new ThemeAdminError(NO_QR_PASS_REFUSALS.noPass);
  if (expectedUpdatedAt && new Date(expectedUpdatedAt).getTime() !== revision.getTime()) {
    throw new ThemeAdminError(stale);
  }

  const copy = withNoQrPass(builder.layout);
  if ("error" in copy) throw new ThemeAdminError(NO_QR_PASS_REFUSALS[copy.error]);
  const doc = assertLayoutDoc(copy.doc);

  await prisma.$transaction(async (tx) => {
    const applied = await tx.themeLayout.updateMany({
      where: { themeId, updatedAt: revision },
      data: { doc: json(doc) },
    });
    if (applied.count === 0) throw new ThemeAdminError(stale);
    for (const variant of builder.variants) {
      const overrides = copyLayerOverrides(variant.overrides, copy.layerIds);
      if (!overrides) continue;
      await tx.themeVariant.update({
        where: { id: variant.id },
        data: { layoutOverrides: json(assertLayoutOverrides(overrides)) },
      });
    }
    await tx.theme.update({ where: { id: themeId }, data: { updatedById: actorId } });
  });
  return copy.sceneId;
}

/**
 * What a new design starts from: عروس الياسمين as it is in the database right
 * now, so the owner's later changes to it carry into every design made after.
 * The copy committed with the code stands in if that design is ever missing.
 */
async function newDesignStart(): Promise<LayoutDoc> {
  const reference = await prisma.themeLayout.findFirst({ where: { theme: { slug: REFERENCE_THEME_SLUG } }, select: { doc: true } });
  if (reference) {
    try {
      return assertLayoutDoc(reference.doc);
    } catch {
      // A reference that no longer validates must not block creating a design.
    }
  }
  return jasmineNewDesignLayout();
}

export async function saveTypographyDoc(actorId: string, themeId: string, raw: unknown) {
  const doc = assertTypographyDoc(raw);
  await prisma.$transaction([
    prisma.themeTypography.upsert({
      where: { themeId },
      create: { themeId, doc: json(doc) },
      update: { doc: json(doc) },
    }),
    prisma.theme.update({ where: { id: themeId }, data: { updatedById: actorId } }),
  ]);
  return doc;
}

/**
 * Deep-copy a whole design. Assets are re-pointed at the same stored objects
 * rather than re-uploaded — the copy is a new arrangement of the same art until
 * the admin swaps images, and duplicating must not double the storage bill.
 * The trade-off is recorded on the row: `blobPath` is cleared on copies so
 * deleting one never deletes an object the original still shows.
 */
export async function duplicateBuilderTheme(actorId: string, themeId: string) {
  const source = await prisma.theme.findUnique({ where: { id: themeId }, include: builderInclude });
  if (!source) throw new ThemeAdminError("التصميم غير موجود");

  let slug = `${source.slug}-copy`;
  let n = 2;
  while (await prisma.theme.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${source.slug}-copy-${n}`;
    n += 1;
  }

  return prisma.$transaction(async (tx) => {
    const copy = await tx.theme.create({
      data: {
        slug,
        name: `${source.name} (copy)`,
        nameAr: `${source.nameAr} (نسخة)`,
        category: source.category,
        occasion: source.occasion,
        description: source.description,
        descriptionAr: source.descriptionAr,
        engine: source.engine,
        visibility: source.visibility,
        thumbnailUrl: source.thumbnailUrl,
        status: ThemeStatus.DRAFT,
        config: source.config as Prisma.InputJsonValue,
        createdById: actorId,
        layout: { create: { doc: (source.layout?.doc ?? json(DEFAULT_LAYOUT_DOC)) as Prisma.InputJsonValue } },
        typography: { create: { doc: (source.typography?.doc ?? json(DEFAULT_TYPOGRAPHY_DOC)) as Prisma.InputJsonValue } },
      },
    });

    const variantIdMap = new Map<string, string>();
    for (const variant of source.variants) {
      const created = await tx.themeVariant.create({
        data: {
          themeId: copy.id,
          slug: variant.slug,
          name: variant.name,
          nameAr: variant.nameAr,
          colorTag: variant.colorTag,
          palette: variant.palette as Prisma.InputJsonValue,
          layoutOverrides: (variant.layoutOverrides ?? undefined) as Prisma.InputJsonValue | undefined,
          sortOrder: variant.sortOrder,
          isDefault: variant.isDefault,
        },
      });
      variantIdMap.set(variant.id, created.id);
    }

    for (const asset of source.assets) {
      await tx.themeAsset.create({
        data: {
          themeId: copy.id,
          variantId: asset.variantId ? (variantIdMap.get(asset.variantId) ?? null) : null,
          slot: asset.slot,
          url: asset.url,
          blobPath: null,
          width: asset.width,
          height: asset.height,
          fileSize: asset.fileSize,
          mimeType: asset.mimeType,
        },
      });
    }

    return copy;
  });
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

export async function createVariant(
  themeId: string,
  input: { slug: string; name: string; nameAr: string; colorTag?: string | null; palette?: unknown },
) {
  assertSlug(input.slug);
  const clash = await prisma.themeVariant.findUnique({
    where: { themeId_slug: { themeId, slug: input.slug } },
    select: { id: true },
  });
  if (clash) throw new ThemeAdminError("يوجد لون بنفس المعرّف في هذا التصميم");

  const count = await prisma.themeVariant.count({ where: { themeId } });
  return prisma.themeVariant.create({
    data: {
      themeId,
      slug: input.slug,
      name: input.name,
      nameAr: input.nameAr,
      colorTag: input.colorTag ?? null,
      palette: json(input.palette ? assertPalette(input.palette) : DEFAULT_PALETTE),
      sortOrder: count,
      isDefault: count === 0,
    },
  });
}

export async function updateVariant(
  variantId: string,
  input: { name: string; nameAr: string; colorTag?: string | null; palette: unknown },
) {
  return prisma.themeVariant.update({
    where: { id: variantId },
    data: {
      name: input.name,
      nameAr: input.nameAr,
      colorTag: input.colorTag ?? null,
      palette: json(assertPalette(input.palette)),
    },
  });
}

/**
 * Save one variant's own colours (and any geometry overrides already stored
 * alongside them).
 *
 * Colours are per-variant rather than per-design because the layout document
 * is shared by every colour of a theme: recolouring the seal on the navy
 * variant used to recolour it on all of them.
 */
export async function saveVariantOverrides(variantId: string, raw: unknown) {
  const overrides = assertLayoutOverrides(raw);
  return prisma.themeVariant.update({
    where: { id: variantId },
    data: { layoutOverrides: json(overrides) },
  });
}

/**
 * "Duplicate variant, then swap the images" is the flow the admin actually
 * uses, so the copy carries the source's assets across — otherwise every new
 * color would start from four empty slots.
 */
export async function duplicateVariant(variantId: string) {
  const source = await prisma.themeVariant.findUnique({
    where: { id: variantId },
    include: { assets: true },
  });
  if (!source) throw new ThemeAdminError("اللون غير موجود");

  let slug = `${source.slug}-copy`;
  let n = 2;
  while (
    await prisma.themeVariant.findUnique({
      where: { themeId_slug: { themeId: source.themeId, slug } },
      select: { id: true },
    })
  ) {
    slug = `${source.slug}-copy-${n}`;
    n += 1;
  }

  const count = await prisma.themeVariant.count({ where: { themeId: source.themeId } });

  return prisma.$transaction(async (tx) => {
    const copy = await tx.themeVariant.create({
      data: {
        themeId: source.themeId,
        slug,
        name: `${source.name} (copy)`,
        nameAr: `${source.nameAr} (نسخة)`,
        colorTag: source.colorTag,
        palette: source.palette as Prisma.InputJsonValue,
        layoutOverrides: (source.layoutOverrides ?? undefined) as Prisma.InputJsonValue | undefined,
        sortOrder: count,
        isDefault: false,
      },
    });

    for (const asset of source.assets) {
      await tx.themeAsset.create({
        data: {
          themeId: source.themeId,
          variantId: copy.id,
          slot: asset.slot,
          url: asset.url,
          // Shared object with the source variant — see duplicateBuilderTheme.
          blobPath: null,
          width: asset.width,
          height: asset.height,
          fileSize: asset.fileSize,
          mimeType: asset.mimeType,
        },
      });
    }

    return copy;
  });
}

export async function deleteVariant(variantId: string) {
  const variant = await prisma.themeVariant.findUnique({ where: { id: variantId } });
  if (!variant) throw new ThemeAdminError("اللون غير موجود");

  const remaining = await prisma.themeVariant.count({ where: { themeId: variant.themeId } });
  if (remaining <= 1) throw new ThemeAdminError("لا يمكن حذف آخر لون في التصميم");

  const assets = await prisma.themeAsset.findMany({ where: { variantId } });
  await prisma.themeVariant.delete({ where: { id: variantId } });
  for (const asset of assets) await removeStoredAsset(asset.blobPath);

  if (variant.isDefault) {
    const next = await prisma.themeVariant.findFirst({
      where: { themeId: variant.themeId },
      orderBy: { sortOrder: "asc" },
    });
    if (next) await prisma.themeVariant.update({ where: { id: next.id }, data: { isDefault: true } });
  }
}

export async function setDefaultVariant(themeId: string, variantId: string) {
  await prisma.$transaction([
    prisma.themeVariant.updateMany({ where: { themeId }, data: { isDefault: false } }),
    prisma.themeVariant.update({ where: { id: variantId }, data: { isDefault: true } }),
  ]);
}

export async function reorderVariants(themeId: string, orderedIds: string[]) {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.themeVariant.updateMany({ where: { id, themeId }, data: { sortOrder: index } }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export async function recordAsset(input: {
  themeId: string;
  variantId: string | null;
  slot: string;
  url: string;
  blobPath: string;
  mimeType: string;
  fileSize: number;
  width?: number | null;
  height?: number | null;
}) {
  // One image per slot per variant: uploading again replaces, so the admin
  // never has to hunt for a stale asset that is still winning the lookup.
  const previous = await prisma.themeAsset.findMany({
    where: { themeId: input.themeId, variantId: input.variantId, slot: input.slot },
  });

  const created = await prisma.themeAsset.create({
    data: {
      themeId: input.themeId,
      variantId: input.variantId,
      slot: input.slot,
      url: input.url,
      blobPath: input.blobPath,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      width: input.width ?? null,
      height: input.height ?? null,
    },
  });

  for (const asset of previous) {
    await prisma.themeAsset.delete({ where: { id: asset.id } });
    await removeStoredAsset(asset.blobPath);
  }

  return created;
}

export async function deleteAsset(assetId: string) {
  const asset = await prisma.themeAsset.findUnique({ where: { id: assetId } });
  if (!asset) return;
  await prisma.themeAsset.delete({ where: { id: assetId } });
  await removeStoredAsset(asset.blobPath);
}

// ---------------------------------------------------------------------------
// Visibility & assignments
// ---------------------------------------------------------------------------

export async function assignThemeToUser(themeId: string, userId: string, assignedById: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new ThemeAdminError("العميل غير موجود");
  await prisma.themeAssignment.upsert({
    where: { themeId_userId: { themeId, userId } },
    create: { themeId, userId, assignedById },
    update: {},
  });
}

export async function unassignThemeFromUser(themeId: string, userId: string) {
  await prisma.themeAssignment.deleteMany({ where: { themeId, userId } });
}

// ---------------------------------------------------------------------------
// Publish validation
// ---------------------------------------------------------------------------

export interface ValidationIssue {
  level: "error" | "warning";
  messageAr: string;
}

/**
 * Runs before publishing. Errors block; warnings are shown and can be accepted
 * — a design with no blessing text is unusual but not broken, whereas one with
 * no closed envelope has nothing to show the guest at all.
 */
export function validateForPublish(builder: BuilderTheme): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { layout, variants, assets } = builder;

  const defaultVariant = variants.find((v) => v.isDefault) ?? variants[0];
  if (!defaultVariant) {
    issues.push({ level: "error", messageAr: "التصميم بدون أي لون — أضف لونًا واحدًا على الأقل" });
    return issues;
  }

  for (const variant of variants) {
    const slots = new Set(
      assets.filter((a) => a.variantId === null || a.variantId === variant.id).map((a) => a.slot),
    );
    for (const required of REQUIRED_SLOT_KEYS) {
      if (!slots.has(required)) {
        issues.push({
          level: "error",
          messageAr: `اللون «${variant.nameAr}» ينقصه: ${slotLabel(required)}`,
        });
      }
    }
  }

  const layerSlots = new Set(layout.layers.filter((l) => l.type === "asset").map((l) => l.slot));
  for (const required of REQUIRED_SLOT_KEYS) {
    if (!layerSlots.has(required)) {
      issues.push({
        level: "warning",
        messageAr: `الصورة «${slotLabel(required)}» مرفوعة لكن ما فيه طبقة تعرضها في المحرر`,
      });
    }
  }

  if (!layout.layers.some((l) => l.type === "qr")) {
    issues.push({ level: "error", messageAr: "ما فيه منطقة باركود QR — المدعو ما راح يقدر يدخل" });
  }
  if (!layout.layers.some((l) => l.type === "text" && l.source === "content")) {
    issues.push({ level: "warning", messageAr: "ما فيه منطقة نص تعرض بيانات الدعوة (اسم المدعو، التاريخ...)" });
  }

  // A layout authored only at desktop widths silently breaks on the phone most
  // guests actually open the invitation on, so check the mobile pass explicitly.
  const offStage = layout.layers.filter(
    (l) => l.base.x < -20 || l.base.x > 120 || l.base.y < -20 || l.base.y > 120,
  );
  if (offStage.length > 0) {
    issues.push({
      level: "warning",
      messageAr: `${offStage.length} عنصر خارج حدود الشاشة على الجوال — راجع مقاس «جوال» في المحرر`,
    });
  }

  return issues;
}

function slotLabel(key: string): string {
  const labels: Record<string, string> = {
    background: "خلفية التصميم",
    envelopeClosed: "الظرف المغلق",
    envelopeOpen: "الظرف المفتوح",
    card: "بطاقة الدعوة",
  };
  return labels[key] ?? key;
}

export async function publishBuilderTheme(themeId: string) {
  const builder = await getBuilderTheme(themeId);
  if (!builder) throw new ThemeAdminError("التصميم غير موجود");

  const issues = validateForPublish(builder);
  const errors = issues.filter((i) => i.level === "error");
  if (errors.length > 0) {
    throw new ThemeAdminError(`لا يمكن النشر:\n${errors.map((e) => `• ${e.messageAr}`).join("\n")}`);
  }

  await prisma.theme.update({
    where: { id: themeId },
    data: { status: ThemeStatus.PUBLISHED, archivedAt: null },
  });
}
