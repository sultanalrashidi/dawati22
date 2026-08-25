import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { listPublishedThemes } from "@/lib/events/service";
import { getSessionUser } from "@/lib/auth/session";
import { ThemeEngine } from "@/generated/prisma/client";
import { parsePalette } from "@/lib/themes/builder/schema";
import {
  builderThemeConfig,
  loadBuilderThemesForGallery,
  pickDefaultVariant,
  type GuestBuilderTheme,
} from "@/lib/themes/builder/guest";
import type { ThemeConfig } from "@/lib/themes/types";
import { ThemeGalleryGrid } from "@/components/themes/theme-gallery-grid";

type GalleryItem = {
  id: string;
  slug: string;
  name: string;
  category: string;
  config: ThemeConfig;
  createdAt: string;
  eventCount: number;
  /**
   * Present for BUILDER themes only. Without it the preview dialog renders the
   * generic legacy invitation — no page background and none of the design's own
   * art — which is exactly the "theme doesn't show" symptom on the guest page.
   */
  builder?: GuestBuilderTheme;
};

export default async function ThemesGalleryPage({ params }: PageProps<"/[locale]/themes">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const user = await getSessionUser();
  const themes = await listPublishedThemes(user?.id ?? null);

  // One extra query for every builder theme on the page, not one per card.
  const builderArt = await loadBuilderThemesForGallery(
    themes.filter((t) => t.engine === ThemeEngine.BUILDER).map((t) => t.id),
  );

  // A LEGACY theme is one gallery entry per color (each color is its own Theme
  // row, grouped by `config.family`). A BUILDER theme is a single row whose
  // colors are ThemeVariants — so it is expanded into one entry per variant
  // sharing a `family`, which lands it in the grid as one card with a swatch
  // per color, exactly like a legacy family.
  const items: GalleryItem[] = themes.flatMap((theme): GalleryItem[] => {
    if (theme.engine !== ThemeEngine.BUILDER) {
      return [
        {
          id: theme.id,
          slug: theme.slug,
          name: locale === "ar" ? theme.nameAr : theme.name,
          category: theme.category,
          config: theme.config as unknown as ThemeConfig,
          createdAt: theme.createdAt.toISOString(),
          eventCount: theme.eventCount,
        },
      ];
    }

    // A builder theme with no variant yet has no palette to draw a card with.
    const defaultVariant = pickDefaultVariant(theme.variants);
    if (!defaultVariant) return [];

    return theme.variants.map((variant) => ({
      id: variant.id,
      // The family's representative card is the one whose slug matches the
      // family key — that's the default variant here.
      slug: variant.id === defaultVariant.id ? theme.slug : `${theme.slug}-${variant.slug}`,
      name: locale === "ar" ? theme.nameAr : theme.name,
      category: theme.category,
      config: builderThemeConfig({
        palette: parsePalette(variant.palette),
        family: theme.slug,
        colorTag: variant.colorTag,
      }),
      createdAt: theme.createdAt.toISOString(),
      // All variants share one Theme row's usage count; crediting it to the
      // representative keeps the family's "popular" sort from multiplying it.
      eventCount: variant.id === defaultVariant.id ? theme.eventCount : 0,
      builder: builderArt.get(theme.id)?.get(variant.id),
    }));
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-8">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-fg">{dict.themesGallery.heading}</h1>
        <p className="mt-2 text-fg-muted">{dict.themesGallery.subheading}</p>
      </div>

      <ThemeGalleryGrid themes={items} dict={dict} />
    </div>
  );
}
