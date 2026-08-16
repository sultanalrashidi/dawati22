"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserOrThrow } from "@/lib/auth/guards";
import {
  createTheme,
  updateTheme,
  duplicateTheme,
  setThemeStatus,
  deleteTheme,
  addThemeAsset,
  removeThemeAsset,
  assignThemeToEvent,
  ThemeAdminError,
  type ThemeInput,
} from "@/lib/admin/themes/service";
import { saveThemeAssetFile } from "@/lib/admin/themes/upload";
import { Role, ThemeStatus } from "@/generated/prisma/client";
import { isLocale, defaultLocale } from "@/lib/i18n/locales";
import type { ThemeConfig } from "@/lib/themes/types";

async function requireAdmin() {
  return requireUserOrThrow([Role.ADMIN]);
}

function parseThemeForm(formData: FormData): ThemeInput | null {
  const slug = String(formData.get("slug") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const nameAr = String(formData.get("nameAr") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  if (!slug || !name || !nameAr || !category) return null;

  const config: ThemeConfig = {
    layout: String(formData.get("layout") ?? "classic-center") as ThemeConfig["layout"],
    palette: {
      bg: String(formData.get("paletteBg") ?? "#ffffff"),
      surface: String(formData.get("paletteSurface") ?? "#ffffff"),
      fg: String(formData.get("paletteFg") ?? "#000000"),
      fgMuted: String(formData.get("paletteFgMuted") ?? "#666666"),
      accent: String(formData.get("paletteAccent") ?? "#b08d57"),
      accentFg: String(formData.get("paletteAccentFg") ?? "#ffffff"),
    },
    fonts: {
      arabicDisplay: String(formData.get("fontArDisplay") ?? "IBM Plex Sans Arabic"),
      arabicBody: String(formData.get("fontArBody") ?? "IBM Plex Sans Arabic"),
      latinDisplay: String(formData.get("fontEnDisplay") ?? "Inter"),
    },
    motion: {
      openStyle: String(formData.get("openStyle") ?? "fade") as ThemeConfig["motion"]["openStyle"],
      reducedMotionFallback: "fade",
    },
    sections: {
      showCountdown: formData.get("showCountdown") === "on",
      showMap: formData.get("showMap") === "on",
      showRsvp: formData.get("showRsvp") === "on",
    },
  };

  return {
    slug,
    name,
    nameAr,
    category,
    description: String(formData.get("description") ?? "") || undefined,
    descriptionAr: String(formData.get("descriptionAr") ?? "") || undefined,
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
  const input = parseThemeForm(formData);
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

export async function deleteThemeAction(themeId: string, locale: string) {
  await requireAdmin();
  const safeLocale = isLocale(locale) ? locale : defaultLocale;
  await deleteTheme(themeId);
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
  const kind = String(formData.get("kind") ?? "DECORATION");
  if (!(file instanceof File) || file.size === 0) return { error: "no_file" };

  try {
    const saved = await saveThemeAssetFile(themeId, file);
    await addThemeAsset(themeId, { kind, ...saved });
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
