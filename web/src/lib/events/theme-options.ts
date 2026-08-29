import "server-only";
import { prisma } from "@/lib/db/client";
import { ThemeEngine } from "@/generated/prisma/client";
import { listPublishedThemes } from "@/lib/events/service";
import { parsePalette } from "@/lib/themes/builder/schema";
import { builderThemeConfig, loadBuilderThemesForGallery } from "@/lib/themes/builder/guest";
import type { ThemeConfig } from "@/lib/themes/types";
import type { ThemeOption } from "@/components/events/theme-picker";
import type { Locale } from "@/lib/i18n/locales";
import { legacyThemeThumbnail } from "@/lib/themes/thumbnail";

/** The columns an option needs, whichever query produced the row. */
const THEME_SELECT = {
  id: true,
  engine: true,
  name: true,
  nameAr: true,
  category: true,
  config: true,
  variants: {
    select: { id: true, nameAr: true, name: true, colorTag: true, palette: true },
    orderBy: { sortOrder: "asc" },
  },
} as const;

type ThemeRow = {
  id: string;
  engine: ThemeEngine;
  name: string;
  nameAr: string;
  category: string;
  config: unknown;
  variants: { id: string; nameAr: string; name: string; colorTag: string | null; palette: unknown }[];
};

/**
 * One option per COLOUR, not per design. A builder theme's colours are
 * ThemeVariant rows, and the gallery already advertises them individually —
 * collapsing them here is what used to hand every customer the default
 * colour whatever they picked.
 *
 * `keepThemeId` is for the admin edit form: an event whose design was archived
 * since it was created must still show that design as the current selection,
 * or saving an unrelated correction would quietly move the invitation onto
 * whichever theme happened to be first in the gallery.
 */
export async function buildThemeOptions(
  locale: Locale,
  userId: string | null,
  keepThemeId?: string | null,
): Promise<ThemeOption[]> {
  const published = await listPublishedThemes(userId);
  const rows: ThemeRow[] = published.map((theme) => ({
    id: theme.id,
    engine: theme.engine,
    name: theme.name,
    nameAr: theme.nameAr,
    category: theme.category,
    config: theme.config,
    variants: theme.variants,
  }));

  if (keepThemeId && !rows.some((row) => row.id === keepThemeId)) {
    const current = await prisma.theme.findUnique({ where: { id: keepThemeId }, select: THEME_SELECT });
    if (current) rows.unshift(current);
  }

  const builderArt = await loadBuilderThemesForGallery(
    rows.filter((row) => row.engine === ThemeEngine.BUILDER).map((row) => row.id),
  );

  return rows.flatMap((theme): ThemeOption[] => {
    const name = locale === "ar" ? theme.nameAr : theme.name;
    if (theme.engine !== ThemeEngine.BUILDER) {
      const config = theme.config as unknown as ThemeConfig;
      return [
        {
          key: theme.id,
          themeId: theme.id,
          variantId: null,
          name,
          category: theme.category,
          config,
          // Each colour of a hand-coded design is its own Theme row, so the
          // grouping key is the shared `family` the gallery already groups by.
          familyKey: config.family ?? theme.id,
          colorTag: config.colorTag ?? undefined,
          thumbnailUrl: legacyThemeThumbnail(config),
        },
      ];
    }
    const art = builderArt.get(theme.id);
    return theme.variants.map((variant) => {
      const builder = art?.get(variant.id);
      return {
        key: `${theme.id}:${variant.id}`,
        themeId: theme.id,
        variantId: variant.id,
        name,
        // Only worth showing when the design actually offers a choice.
        variantName:
          theme.variants.length > 1 ? (locale === "ar" ? variant.nameAr : variant.name) : undefined,
        category: theme.category,
        config: builderThemeConfig({ palette: parsePalette(variant.palette) }),
        // A builder design's colours are rows of one theme, so the theme IS
        // the family.
        familyKey: theme.id,
        colorTag: variant.colorTag ?? undefined,
        // The closed envelope is what the customer sees first on the guest
        // page, so it is what the tile should show; the other two only stand
        // in for a design that has not uploaded one yet.
        thumbnailUrl:
          builder?.assets.envelopeClosed ?? builder?.assets.background ?? builder?.assets.card,
      };
    });
  });
}

/** The picker key that selects an event's current design + colour. */
export function themeOptionKey(themeId: string, themeVariantId: string | null): string {
  return themeVariantId ? `${themeId}:${themeVariantId}` : themeId;
}
