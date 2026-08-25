/**
 * The font library the Theme Builder offers.
 *
 * Two tiers, deliberately:
 *
 * - **Built-in** families come through `next/font/google`, are self-hosted and
 *   optimised at build time, and already have a CSS variable declared on
 *   `<html>`. Fastest, but adding one needs a code change.
 * - **Admin-added** families live in the `ThemeFont` table and are pulled from
 *   the Google Fonts CSS API at request time. An admin adds a family from the
 *   panel and uses it immediately — no code edit, no deploy — at the cost of
 *   one extra stylesheet fetch.
 *
 * Both resolve through `fontStackFor`, so a text layer never has to care which
 * tier its family came from.
 */

import { fontVarFor } from "@/lib/themes/fonts";

export interface FontOption {
  family: string;
  label: string;
  labelAr: string;
  source: "BUILTIN" | "GOOGLE";
  isArabic: boolean;
  weights: number[];
}

/** Kept in sync with lib/themes/fonts.ts — these are the ones next/font loads. */
export const BUILTIN_FONTS: FontOption[] = [
  { family: "Amiri", label: "Amiri", labelAr: "أميري", source: "BUILTIN", isArabic: true, weights: [400, 700] },
  { family: "IBM Plex Sans Arabic", label: "IBM Plex Sans Arabic", labelAr: "آي بي إم بلكس", source: "BUILTIN", isArabic: true, weights: [400, 500, 600] },
  { family: "Aref Ruqaa", label: "Aref Ruqaa", labelAr: "عارف رقعة", source: "BUILTIN", isArabic: true, weights: [400, 700] },
  { family: "Reem Kufi", label: "Reem Kufi", labelAr: "ريم كوفي", source: "BUILTIN", isArabic: true, weights: [400, 700] },
  { family: "Tajawal", label: "Tajawal", labelAr: "تجوّل", source: "BUILTIN", isArabic: true, weights: [400, 500, 700] },
  { family: "Cormorant Garamond", label: "Cormorant Garamond", labelAr: "كورمورانت", source: "BUILTIN", isArabic: false, weights: [400, 500, 600] },
  { family: "Playfair Display", label: "Playfair Display", labelAr: "بلاي فير", source: "BUILTIN", isArabic: false, weights: [500, 600, 700] },
  { family: "Bodoni Moda", label: "Bodoni Moda", labelAr: "بودوني", source: "BUILTIN", isArabic: false, weights: [500, 600, 700] },
  { family: "EB Garamond", label: "EB Garamond", labelAr: "غاراموند", source: "BUILTIN", isArabic: false, weights: [400, 500, 600] },
  { family: "Inter", label: "Inter", labelAr: "إنتر", source: "BUILTIN", isArabic: false, weights: [400, 500, 600] },
];

const BUILTIN_FAMILIES = new Set(BUILTIN_FONTS.map((f) => f.family));

export function isBuiltinFont(family: string): boolean {
  return BUILTIN_FAMILIES.has(family);
}

/**
 * The `font-family` value to render with. Built-ins go through the CSS variable
 * next/font declared; admin-added families are named directly, backed by the
 * stylesheet `googleFontsHref` pulls in.
 */
export function fontStackFor(family: string): string {
  if (BUILTIN_FAMILIES.has(family)) return fontVarFor(family);
  return `"${family.replace(/"/g, "")}", var(--font-plex-arabic)`;
}

/** Google's CSS2 API wants `Family+Name` and a sorted weight list. */
export function googleFontsHref(families: { family: string; weights: string }[]): string | null {
  const specs = families
    .filter((f) => !BUILTIN_FAMILIES.has(f.family))
    .map((f) => {
      const weights = f.weights
        .split(",")
        .map((w) => Number.parseInt(w.trim(), 10))
        .filter((w) => Number.isFinite(w) && w >= 100 && w <= 900)
        .sort((a, b) => a - b);
      const name = f.family.trim().replace(/\s+/g, "+");
      return weights.length > 0 ? `family=${name}:wght@${weights.join(";")}` : `family=${name}`;
    });

  if (specs.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${specs.join("&")}&display=swap`;
}

/** A family name Google would accept, and that is safe to interpolate into CSS. */
export const FONT_FAMILY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ]{0,48}$/;
