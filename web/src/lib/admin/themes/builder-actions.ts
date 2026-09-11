"use server";

import { revalidatePath } from "next/cache";
import { revalidatePublicGallery } from "@/lib/themes/revalidate-gallery";
import { redirect } from "next/navigation";
import { Role, ThemeOccasion, ThemeStatus, ThemeVisibility } from "@/generated/prisma/client";
import { requireUserOrThrow } from "@/lib/auth/guards";
import { defaultLocale, isLocale } from "@/lib/i18n/locales";
import { ThemeAdminError } from "@/lib/admin/themes/service";
import { BuilderValidationError } from "@/lib/themes/builder/schema";
import { SLOT_KEY_PATTERN } from "@/lib/themes/builder/slots";
import { FONT_FAMILY_PATTERN } from "@/lib/themes/font-registry";
import { isSafeBlobPath } from "@/lib/admin/themes/storage";
import { prisma } from "@/lib/db/client";
import { importLegacyTheme, revertLegacyImport } from "@/lib/admin/themes/legacy-import";
import {
  applyStarterLayout,
  assignThemeToUser,
  createBuilderTheme,
  createVariant,
  deleteAsset,
  deleteVariant,
  duplicateBuilderTheme,
  duplicateVariant,
  getBuilderTheme,
  publishBuilderTheme,
  recordAsset,
  reorderVariants,
  saveLayoutDoc,
  saveVariantOverrides,
  saveTypographyDoc,
  setDefaultVariant,
  unassignThemeFromUser,
  updateBuilderThemeMeta,
  updateVariant,
  validateForPublish,
  type ValidationIssue,
} from "@/lib/admin/themes/builder-service";

async function requireAdmin() {
  return requireUserOrThrow([Role.ADMIN]);
}

function safe(locale: string) {
  return isLocale(locale) ? locale : defaultLocale;
}

/** Domain errors become form state; anything else is a real bug and rethrows. */
function toState(error: unknown): { error: string } {
  if (error instanceof ThemeAdminError) return { error: error.message };
  if (error instanceof BuilderValidationError) {
    return { error: `${error.message}: ${error.issues.slice(0, 3).join(" · ")}` };
  }
  throw error;
}

export type BuilderFormState = { error?: string; ok?: boolean } | null;

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

export async function createBuilderThemeAction(
  locale: string,
  _prev: BuilderFormState,
  formData: FormData,
): Promise<BuilderFormState> {
  const user = await requireAdmin();

  const slug = String(formData.get("slug") ?? "").trim();
  const nameAr = String(formData.get("nameAr") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "classic").trim();
  const occasionRaw = String(formData.get("occasion") ?? "WEDDING");
  const occasion = (Object.values(ThemeOccasion) as string[]).includes(occasionRaw)
    ? (occasionRaw as ThemeOccasion)
    : ThemeOccasion.WEDDING;

  if (!slug || !nameAr || !name) return { error: "الاسم والمعرّف مطلوبة" };

  let themeId: string;
  try {
    const theme = await createBuilderTheme(user.id, {
      slug,
      name,
      nameAr,
      category,
      occasion,
      descriptionAr: String(formData.get("descriptionAr") ?? "").trim() || undefined,
    });
    themeId = theme.id;
  } catch (error) {
    return toState(error);
  }

  redirect(`/${safe(locale)}/admin/themes/builder/${themeId}`);
}

export async function updateBuilderThemeMetaAction(
  themeId: string,
  locale: string,
  _prev: BuilderFormState,
  formData: FormData,
): Promise<BuilderFormState> {
  const user = await requireAdmin();

  const occasionRaw = String(formData.get("occasion") ?? "WEDDING");
  const visibilityRaw = String(formData.get("visibility") ?? "PUBLIC");

  try {
    await updateBuilderThemeMeta(user.id, themeId, {
      name: String(formData.get("name") ?? "").trim(),
      nameAr: String(formData.get("nameAr") ?? "").trim(),
      category: String(formData.get("category") ?? "classic").trim(),
      occasion: (Object.values(ThemeOccasion) as string[]).includes(occasionRaw)
        ? (occasionRaw as ThemeOccasion)
        : ThemeOccasion.WEDDING,
      visibility: (Object.values(ThemeVisibility) as string[]).includes(visibilityRaw)
        ? (visibilityRaw as ThemeVisibility)
        : ThemeVisibility.PUBLIC,
      descriptionAr: String(formData.get("descriptionAr") ?? "").trim() || undefined,
    });
  } catch (error) {
    return toState(error);
  }

  revalidatePath(`/${safe(locale)}/admin/themes/builder/${themeId}`);
  return { ok: true };
}

/**
 * The editor's save. It ships the whole document rather than a patch: the
 * canvas holds the authoritative state while editing, and a partial save is
 * how a layers list ends up half-applied.
 */
export async function saveLayoutAction(
  themeId: string,
  doc: unknown,
  /** The layout revision the editor loaded. Omitted, the save is unconditional. */
  expectedUpdatedAt?: string | null,
): Promise<BuilderFormState> {
  const user = await requireAdmin();
  try {
    await saveLayoutDoc(user.id, themeId, doc, expectedUpdatedAt);
  } catch (error) {
    return toState(error);
  }
  return { ok: true };
}

/** Persist the colours the admin set on one colour variant. */
export async function saveVariantOverridesAction(
  variantId: string,
  overrides: unknown,
): Promise<BuilderFormState> {
  await requireAdmin();
  try {
    await saveVariantOverrides(variantId, overrides);
  } catch (error) {
    return toState(error);
  }
  return { ok: true };
}

/**
 * Drops the standard element set into a theme that has none. The service
 * refuses when the stored layout already holds layers, so this can never
 * silently overwrite an admin's arrangement.
 *
 * Returns the saved document so the editor can adopt it in place. Reloading the
 * page instead would collide with the unsaved-changes prompt: the admin could
 * cancel the navigation and be left holding a stale empty document that the
 * next Save would write straight back over the new layers.
 */
export async function applyStarterLayoutAction(
  themeId: string,
  locale: string,
): Promise<BuilderFormState & { doc?: unknown }> {
  const user = await requireAdmin();
  let doc: unknown;
  try {
    doc = await applyStarterLayout(user.id, themeId);
  } catch (error) {
    return toState(error);
  }
  revalidatePath(`/${safe(locale)}/admin/themes/builder/${themeId}`);
  return { ok: true, doc };
}

export async function saveTypographyAction(themeId: string, doc: unknown): Promise<BuilderFormState> {
  const user = await requireAdmin();
  try {
    await saveTypographyDoc(user.id, themeId, doc);
  } catch (error) {
    return toState(error);
  }
  return { ok: true };
}

export async function duplicateBuilderThemeAction(themeId: string, locale: string) {
  const user = await requireAdmin();
  const copy = await duplicateBuilderTheme(user.id, themeId);
  redirect(`/${safe(locale)}/admin/themes/builder/${copy.id}`);
}

/**
 * `status` arrives as a plain string rather than the Prisma enum: importing the
 * generated client into a client component drags `node:module` into the browser
 * bundle. It is validated here, which is where an untrusted value belongs
 * anyway.
 */
export async function setBuilderThemeStatusAction(themeId: string, locale: string, status: string) {
  await requireAdmin();
  if (!(Object.values(ThemeStatus) as string[]).includes(status)) return;
  const next = status as ThemeStatus;
  await prisma.theme.update({
    where: { id: themeId },
    data: { status: next, archivedAt: next === ThemeStatus.ARCHIVED ? new Date() : null },
  });
  revalidatePath(`/${safe(locale)}/admin/themes/builder/${themeId}`);
  revalidatePath(`/${safe(locale)}/admin/themes`);
  revalidatePublicGallery();
}

export async function publishBuilderThemeAction(
  themeId: string,
  locale: string,
): Promise<BuilderFormState> {
  await requireAdmin();
  try {
    await publishBuilderTheme(themeId);
  } catch (error) {
    return toState(error);
  }
  revalidatePath(`/${safe(locale)}/admin/themes/builder/${themeId}`);
  revalidatePath(`/${safe(locale)}/admin/themes`);
  revalidatePublicGallery();
  return { ok: true };
}

export async function checkBuilderThemeAction(themeId: string): Promise<ValidationIssue[]> {
  await requireAdmin();
  const builder = await getBuilderTheme(themeId);
  if (!builder) return [{ level: "error", messageAr: "التصميم غير موجود" }];
  return validateForPublish(builder);
}

// ---------------------------------------------------------------------------
// Importing a hand-coded artwork theme
// ---------------------------------------------------------------------------

/**
 * Turn one of the 27 LEGACY artwork themes into an editable builder theme.
 *
 * Redirects into the editor on success, because the point of converting is to
 * start moving things — landing back on the read-only legacy form would leave
 * the admin wondering whether anything happened.
 */
export async function convertLegacyThemeAction(
  themeId: string,
  locale: string,
  _prev: BuilderFormState,
  formData: FormData,
): Promise<BuilderFormState> {
  const user = await requireAdmin();

  try {
    await importLegacyTheme(user.id, themeId, {
      // Unchecked means the checkbox was left out of the payload entirely.
      mergeFamily: formData.get("mergeFamily") === "on",
    });
  } catch (error) {
    return toState(error);
  }

  revalidatePath(`/${safe(locale)}/admin/themes`);
  revalidatePath(`/${safe(locale)}/admin/themes/${themeId}`);
  redirect(`/${safe(locale)}/admin/themes/builder/${themeId}`);
}

/** Put a converted theme back on the hand-coded renderers. */
export async function revertToLegacyAction(
  themeId: string,
  locale: string,
  _prev: BuilderFormState,
  formData: FormData,
): Promise<BuilderFormState> {
  const user = await requireAdmin();

  try {
    await revertLegacyImport(user.id, themeId, {
      restoreColors: formData.get("restoreColors") === "on",
    });
  } catch (error) {
    return toState(error);
  }

  revalidatePath(`/${safe(locale)}/admin/themes`);
  revalidatePath(`/${safe(locale)}/admin/themes/${themeId}`);
  // The theme is LEGACY again, and the builder page 404s for a legacy theme —
  // staying put would drop the admin on a "page not found" right after a
  // successful revert. Send them to the editor that now owns it.
  redirect(`/${safe(locale)}/admin/themes/${themeId}`);
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

export async function createVariantAction(
  themeId: string,
  locale: string,
  _prev: BuilderFormState,
  formData: FormData,
): Promise<BuilderFormState> {
  await requireAdmin();
  try {
    await createVariant(themeId, {
      slug: String(formData.get("slug") ?? "").trim(),
      name: String(formData.get("name") ?? "").trim(),
      nameAr: String(formData.get("nameAr") ?? "").trim(),
      colorTag: String(formData.get("colorTag") ?? "").trim() || null,
    });
  } catch (error) {
    return toState(error);
  }
  revalidatePath(`/${safe(locale)}/admin/themes/builder/${themeId}`);
  return { ok: true };
}

export async function updateVariantAction(
  variantId: string,
  themeId: string,
  locale: string,
  input: { name: string; nameAr: string; colorTag: string | null; palette: unknown },
): Promise<BuilderFormState> {
  await requireAdmin();
  try {
    await updateVariant(variantId, input);
  } catch (error) {
    return toState(error);
  }
  revalidatePath(`/${safe(locale)}/admin/themes/builder/${themeId}`);
  return { ok: true };
}

export async function duplicateVariantAction(variantId: string, themeId: string, locale: string) {
  await requireAdmin();
  await duplicateVariant(variantId);
  revalidatePath(`/${safe(locale)}/admin/themes/builder/${themeId}`);
}

export async function deleteVariantAction(
  variantId: string,
  themeId: string,
  locale: string,
): Promise<BuilderFormState> {
  await requireAdmin();
  try {
    await deleteVariant(variantId);
  } catch (error) {
    return toState(error);
  }
  revalidatePath(`/${safe(locale)}/admin/themes/builder/${themeId}`);
  return { ok: true };
}

export async function setDefaultVariantAction(themeId: string, variantId: string, locale: string) {
  await requireAdmin();
  await setDefaultVariant(themeId, variantId);
  revalidatePath(`/${safe(locale)}/admin/themes/builder/${themeId}`);
}

export async function reorderVariantsAction(themeId: string, orderedIds: string[], locale: string) {
  await requireAdmin();
  await reorderVariants(themeId, orderedIds);
  revalidatePath(`/${safe(locale)}/admin/themes/builder/${themeId}`);
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

/**
 * Called after the browser has finished writing to the blob store. It is the
 * only place a row is created, which keeps dev (local disk) and production
 * (direct-to-blob) on one code path.
 */
export async function registerThemeAssetAction(input: {
  themeId: string;
  variantId: string | null;
  slot: string;
  url: string;
  blobPath: string;
  mimeType: string;
  fileSize: number;
  width?: number | null;
  height?: number | null;
}): Promise<BuilderFormState> {
  await requireAdmin();

  if (!SLOT_KEY_PATTERN.test(input.slot)) return { error: "مفتاح الصورة غير صالح" };
  // The browser relays this back from the upload, and it later reaches a
  // filesystem/blob delete — so it is validated here, not trusted.
  if (!isSafeBlobPath(input.blobPath)) return { error: "مسار الملف غير صالح" };

  // The client names the theme and variant, so re-check both belong together
  // before trusting the pair — a valid admin session is not a valid target.
  const theme = await prisma.theme.findUnique({ where: { id: input.themeId }, select: { id: true } });
  if (!theme) return { error: "التصميم غير موجود" };
  if (input.variantId) {
    const variant = await prisma.themeVariant.findUnique({
      where: { id: input.variantId },
      select: { themeId: true },
    });
    if (!variant || variant.themeId !== input.themeId) return { error: "اللون لا ينتمي لهذا التصميم" };
  }

  try {
    await recordAsset(input);
  } catch (error) {
    return toState(error);
  }
  return { ok: true };
}

export async function deleteThemeAssetAction(assetId: string, themeId: string, locale: string) {
  await requireAdmin();
  await deleteAsset(assetId);
  revalidatePath(`/${safe(locale)}/admin/themes/builder/${themeId}`);
}

// ---------------------------------------------------------------------------
// Private-theme assignments
// ---------------------------------------------------------------------------

export async function assignThemeToUserAction(
  themeId: string,
  locale: string,
  _prev: BuilderFormState,
  formData: FormData,
): Promise<BuilderFormState> {
  const admin = await requireAdmin();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!phone) return { error: "أدخل رقم جوال العميل" };

  const user = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
  if (!user) return { error: "ما فيه عميل بهذا الرقم" };

  try {
    await assignThemeToUser(themeId, user.id, admin.id);
  } catch (error) {
    return toState(error);
  }
  revalidatePath(`/${safe(locale)}/admin/themes/builder/${themeId}`);
  return { ok: true };
}

export async function unassignThemeFromUserAction(themeId: string, userId: string, locale: string) {
  await requireAdmin();
  await unassignThemeFromUser(themeId, userId);
  revalidatePath(`/${safe(locale)}/admin/themes/builder/${themeId}`);
}

// ---------------------------------------------------------------------------
// Font library
// ---------------------------------------------------------------------------

export async function addThemeFontAction(
  locale: string,
  _prev: BuilderFormState,
  formData: FormData,
): Promise<BuilderFormState> {
  await requireAdmin();

  const family = String(formData.get("family") ?? "").trim();
  if (!FONT_FAMILY_PATTERN.test(family)) {
    return { error: "اسم الخط يجب أن يكون بالإنجليزية بدون رموز، مثل: Marhey" };
  }

  const weights = String(formData.get("weights") ?? "400,700")
    .split(",")
    .map((w) => Number.parseInt(w.trim(), 10))
    .filter((w) => Number.isFinite(w) && w >= 100 && w <= 900);
  if (weights.length === 0) return { error: "أوزان الخط غير صالحة" };

  const existing = await prisma.themeFont.findUnique({ where: { family }, select: { id: true } });
  if (existing) return { error: "الخط مضاف مسبقًا" };

  await prisma.themeFont.create({
    data: {
      family,
      label: family,
      labelAr: String(formData.get("labelAr") ?? "").trim() || null,
      weights: weights.join(","),
      isArabic: formData.get("isArabic") === "on",
      subsets: formData.get("isArabic") === "on" ? "arabic,latin" : "latin",
    },
  });

  revalidatePath(`/${safe(locale)}/admin/themes/fonts`);
  return { ok: true };
}

export async function deleteThemeFontAction(fontId: string, locale: string) {
  await requireAdmin();
  await prisma.themeFont.delete({ where: { id: fontId } });
  revalidatePath(`/${safe(locale)}/admin/themes/fonts`);
}
