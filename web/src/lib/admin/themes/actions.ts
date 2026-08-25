"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserOrThrow } from "@/lib/auth/guards";
import {
  createTheme,
  updateTheme,
  getThemeConfig,
  duplicateTheme,
  setThemeStatus,
  deleteTheme,
  getThemeDeletionContext,
  addThemeAsset,
  removeThemeAsset,
  assignThemeToEvent,
  ThemeAdminError,
  ThemeDeleteError,
  type ThemeDeleteErrorCode,
  type ThemeInput,
} from "@/lib/admin/themes/service";
import { saveThemeAssetFile } from "@/lib/admin/themes/upload";
import { Role, ThemeStatus } from "@/generated/prisma/client";
import { isLocale, defaultLocale } from "@/lib/i18n/locales";
import { getDictionary, type Dictionary } from "@/lib/i18n/get-dictionary";
import type { ThemeConfig } from "@/lib/themes/types";

async function requireAdmin() {
  return requireUserOrThrow([Role.ADMIN]);
}

/**
 * Build a theme's config from the editor form.
 *
 * The form only has inputs for a SUBSET of `ThemeConfig`. Everything it can't
 * edit — most importantly `card`, the artwork config of the 27 art themes —
 * has to be carried over from `base`, the theme's stored config, or saving an
 * art theme would strip it back to a plain colour theme. `base` is omitted on
 * create, which legitimately starts from a blank config.
 */
function parseThemeForm(formData: FormData, base?: ThemeConfig): ThemeInput | null {
  const slug = String(formData.get("slug") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const nameAr = String(formData.get("nameAr") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  if (!slug || !name || !nameAr || !category) return null;

  const config: ThemeConfig = {
    // Carry over every key the form has no input for (`card`, and anything
    // added to ThemeConfig later); the explicit keys below then overwrite the
    // ones it does own.
    ...base,
    layout: String(formData.get("layout") ?? "classic-center") as ThemeConfig["layout"],
    palette: {
      ...base?.palette,
      bg: String(formData.get("paletteBg") ?? "#ffffff"),
      surface: String(formData.get("paletteSurface") ?? "#ffffff"),
      fg: String(formData.get("paletteFg") ?? "#000000"),
      fgMuted: String(formData.get("paletteFgMuted") ?? "#666666"),
      accent: String(formData.get("paletteAccent") ?? "#b08d57"),
      accentFg: String(formData.get("paletteAccentFg") ?? "#ffffff"),
    },
    fonts: {
      ...base?.fonts,
      arabicDisplay: String(formData.get("fontArDisplay") ?? "IBM Plex Sans Arabic"),
      arabicBody: String(formData.get("fontArBody") ?? "IBM Plex Sans Arabic"),
      latinDisplay: String(formData.get("fontEnDisplay") ?? "Inter"),
    },
    motion: {
      ...base?.motion,
      openStyle: String(formData.get("openStyle") ?? "fade") as ThemeConfig["motion"]["openStyle"],
      reducedMotionFallback: "fade",
    },
    sections: {
      ...base?.sections,
      showCountdown: formData.get("showCountdown") === "on",
      showMap: formData.get("showMap") === "on",
      showRsvp: formData.get("showRsvp") === "on",
    },
  };

  // Optional keys: an emptied input must DELETE the key, not store an empty
  // string — the gallery and the renderer test these with `?.effect === "…"`
  // and `config.family ?? id`, so a `{ effect: "" }` left behind would be a
  // silently broken config.
  const swatch = String(formData.get("paletteSwatch") ?? "").trim();
  if (formData.get("paletteSwatchOverride") === "on" && swatch) config.palette.swatch = swatch;
  else delete config.palette.swatch;

  const family = String(formData.get("family") ?? "").trim();
  if (family) config.family = family;
  else delete config.family;

  const colorTag = String(formData.get("colorTag") ?? "").trim();
  if (colorTag) config.colorTag = colorTag;
  else delete config.colorTag;

  if (String(formData.get("backgroundEffect") ?? "") === "shader-silk") {
    config.background = { effect: "shader-silk" };
  } else {
    delete config.background;
  }

  if (String(formData.get("particlesEffect") ?? "") === "floating-hearts") {
    config.particles = { effect: "floating-hearts" };
  } else {
    delete config.particles;
  }

  return {
    slug,
    name,
    nameAr,
    category,
    // Both descriptions have an input, so an emptied box is a deliberate clear.
    description: String(formData.get("description") ?? "").trim() || null,
    descriptionAr: String(formData.get("descriptionAr") ?? "").trim() || null,
    config,
  };
}

export type ThemeFormState = { error?: string } | null;

export async function createThemeAction(
  locale: string,
  _prev: ThemeFormState,
  formData: FormData
): Promise<ThemeFormState> {
  const user = await requireAdmin();
  const input = parseThemeForm(formData);
  if (!input) return { error: "invalid" };

  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  let themeId: string;
  try {
    const theme = await createTheme(user.id, input);
    themeId = theme.id;
  } catch (err) {
    if (err instanceof ThemeAdminError) return { error: err.message };
    throw err;
  }
  redirect(`/${safeLocale}/admin/themes/${themeId}`);
}

export async function updateThemeAction(
  themeId: string,
  locale: string,
  _prev: ThemeFormState,
  formData: FormData
): Promise<ThemeFormState> {
  const user = await requireAdmin();
  // Merge onto what's stored rather than rebuilding from the form: the form
  // has no inputs for the artwork `card`, so a from-scratch config would wipe
  // it off every art theme.
  const stored = await getThemeConfig(themeId);
  if (!stored) return { error: "Theme not found" };
  const input = parseThemeForm(formData, stored);
  if (!input) return { error: "invalid" };

  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  let finalId = themeId;
  try {
    const result = await updateTheme(user.id, themeId, input);
    finalId = result.id;
  } catch (err) {
    if (err instanceof ThemeAdminError) return { error: err.message };
    throw err;
  }
  revalidatePath(`/${safeLocale}/admin/themes`);
  if (finalId !== themeId) redirect(`/${safeLocale}/admin/themes/${finalId}`);
  return null;
}

export async function duplicateThemeAction(themeId: string, locale: string) {
  const user = await requireAdmin();
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  const copy = await duplicateTheme(user.id, themeId);
  revalidatePath(`/${safeLocale}/admin/themes`);
  redirect(`/${safeLocale}/admin/themes/${copy.id}`);
}

export async function setThemeStatusAction(themeId: string, locale: string, status: ThemeStatus) {
  await requireAdmin();
  await setThemeStatus(themeId, status);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  revalidatePath(`/${safeLocale}/admin/themes`);
}

// ---------------------------------------------------------------------------
// Deleting a theme
// ---------------------------------------------------------------------------

/**
 * Arabic doesn't have a single plural form: 1 is مناسبة واحدة, 2 is a dual
 * (مناسبتين), 3–10 take the "few" plural and 11+ go back to the singular noun.
 * Interpolating a count into one fixed string gives "1 مناسبات", which reads
 * as broken Arabic. Same one/two/few/many split the gallery already uses.
 */
function inUseMessage(count: number, a: Dictionary["admin"]): string {
  if (count === 1) return a.deleteThemeInUseOne;
  if (count === 2) return a.deleteThemeInUseTwo;
  const template = count >= 3 && count <= 10 ? a.deleteThemeInUseFew : a.deleteThemeInUseMany;
  return template.replace("{count}", String(count));
}

/**
 * Everything the confirmation step renders, already localised.
 *
 * The copy is resolved here rather than passed in as a prop because the delete
 * control is mounted in three places, one of which — the builder's meta form —
 * has no dictionary in scope; sending it down with the counts keeps a single
 * source of copy and one round trip.
 */
export interface ThemeDeletePrompt {
  eventCount: number;
  requiresReplacement: boolean;
  replacements: Array<{ id: string; label: string }>;
  copy: {
    title: string;
    message: string;
    unlinks: string | null;
    seededNote: string | null;
    archiveHint: string;
    replacementLabel: string;
    replacementPlaceholder: string;
    noReplacement: string | null;
    confirm: string;
    cancel: string;
  };
}

export type ThemeDeletePromptResult =
  | { ok: true; prompt: ThemeDeletePrompt }
  | { ok: false; error: string };

function deleteErrorMessage(dict: Dictionary, code: ThemeDeleteErrorCode): string {
  const a = dict.admin;
  switch (code) {
    case "replacement_required":
      return a.deleteThemeErrorRequired;
    case "replacement_is_self":
    case "replacement_not_found":
    case "replacement_not_published":
      return a.deleteThemeErrorReplacement;
    case "theme_not_found":
      return a.deleteThemeErrorMissing;
  }
}

/**
 * Read step of the delete flow, called when the admin opens the confirmation.
 * Loading it on demand keeps the list page from fetching every published theme
 * once per card just in case one of them is about to be deleted.
 */
export async function loadThemeDeletePromptAction(
  themeId: string,
  locale: string
): Promise<ThemeDeletePromptResult> {
  await requireAdmin();
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  const dict = await getDictionary(safeLocale);
  const a = dict.admin;

  const context = await getThemeDeletionContext(themeId);
  if (!context) return { ok: false, error: a.deleteThemeErrorMissing };

  const requiresReplacement = context.eventCount > 0;
  const unlinkCount = context.clientAssignmentCount + context.grantCount;
  const replacements = context.replacements.map((theme) => ({
    id: theme.id,
    label: safeLocale === "ar" ? theme.nameAr : theme.name,
  }));

  return {
    ok: true,
    prompt: {
      eventCount: context.eventCount,
      requiresReplacement,
      replacements,
      copy: {
        title: a.deleteThemeTitle,
        message: requiresReplacement
          ? inUseMessage(context.eventCount, a)
          : a.deleteThemeUnused,
        unlinks: unlinkCount > 0 ? a.deleteThemeUnlinks.replace("{count}", String(unlinkCount)) : null,
        seededNote: context.isSeeded ? a.deleteThemeSeededNote : null,
        archiveHint: a.deleteThemeArchiveHint,
        replacementLabel: a.deleteThemeReplacement,
        replacementPlaceholder: a.deleteThemeReplacementPlaceholder,
        // Only a blocker when the events have nowhere to go.
        noReplacement:
          requiresReplacement && replacements.length === 0 ? a.deleteThemeNoReplacement : null,
        confirm: a.deleteThemeConfirm,
        cancel: a.cancel,
      },
    },
  };
}

export type ThemeDeleteState = { error?: string } | null;

export async function deleteThemeAction(
  themeId: string,
  locale: string,
  _prev: ThemeDeleteState,
  formData: FormData
): Promise<ThemeDeleteState> {
  await requireAdmin();
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  const reassignToThemeId = String(formData.get("reassignToThemeId") ?? "").trim() || null;

  try {
    await deleteTheme(themeId, { reassignToThemeId });
  } catch (err) {
    if (err instanceof ThemeDeleteError) {
      const dict = await getDictionary(safeLocale);
      return { error: deleteErrorMessage(dict, err.code) };
    }
    if (err instanceof ThemeAdminError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/${safeLocale}/admin/themes`);
  // The theme page itself is gone; the builder route shares the same data.
  revalidatePath(`/${safeLocale}/admin/themes/${themeId}`);
  revalidatePath(`/${safeLocale}/admin/themes/builder/${themeId}`);
  redirect(`/${safeLocale}/admin/themes`);
}

export type AssetUploadState = { error?: string } | null;

export async function uploadThemeAssetAction(
  themeId: string,
  locale: string,
  _prev: AssetUploadState,
  formData: FormData
): Promise<AssetUploadState> {
  await requireAdmin();
  const file = formData.get("file");
  const slot = String(formData.get("kind") ?? "DECORATION");
  if (!(file instanceof File) || file.size === 0) return { error: "no_file" };

  try {
    const saved = await saveThemeAssetFile(themeId, file);
    await addThemeAsset(themeId, { slot, ...saved });
  } catch (err) {
    if (err instanceof ThemeAdminError) return { error: err.message };
    throw err;
  }

  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  revalidatePath(`/${safeLocale}/admin/themes/${themeId}`);
  return null;
}

export async function removeThemeAssetAction(assetId: string, themeId: string, locale: string) {
  await requireAdmin();
  await removeThemeAsset(assetId);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  revalidatePath(`/${safeLocale}/admin/themes/${themeId}`);
}

export async function assignThemeToEventAction(themeId: string, locale: string, formData: FormData) {
  const user = await requireAdmin();
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) return;
  await assignThemeToEvent(themeId, eventId, user.id);
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  revalidatePath(`/${safeLocale}/admin/themes/${themeId}`);
}
