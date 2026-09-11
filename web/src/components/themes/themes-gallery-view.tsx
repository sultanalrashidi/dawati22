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
import { builderThemeThumbnail, legacyThemeThumbnail, type EnvelopeCutout } from "@/lib/themes/thumbnail";

type GalleryItem = {
  id: string;
  /**
   * The real database ids the draft is created against. `id` above is the
   * gallery's own key — the Theme for a legacy design, the ThemeVariant for a
   * builder one — so it cannot be used to write an Event on its own.
   */
  themeId: string;
  themeVariantId: string | null;
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
  /**
   * The design's own closed-envelope art — what the card leads with. A theme
   * drawn in CSS rather than from photos has none, and the card falls back to
   * its palette.
   */
  thumbnailUrl?: string;
  /** Set when that art must be cut out of its photograph — see `builderThemeThumbnail`. */
  thumbnailCutout?: EnvelopeCutout;
};

export default async function ThemesGalleryPage({
  params,
  searchParams,
}: PageProps<"/[locale]/themes">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const search = await searchParams;
  const dict = await getDictionary(locale);

  // Carried from the pricing page when she picked a package before a design.
  // Read loosely on purpose — a mangled query should cost her the pre-filled
  // number, not the page. The action validates both again before storing them.
  const rawCount = Number(search.count);
  const intent = {
    tier: typeof search.tier === "string" ? search.tier : null,
    count: Number.isFinite(rawCount) && rawCount > 0 ? rawCount : null,
  };
  const startError = typeof search.error === "string" ? search.error : null;
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
      const config = theme.config as unknown as ThemeConfig;
      return [
        {
          id: theme.id,
          themeId: theme.id,
          // A legacy design's colours are separate Theme rows, so there is no
          // variant to point at.
          themeVariantId: null,
          slug: theme.slug,
          name: locale === "ar" ? theme.nameAr : theme.name,
          category: theme.category,
          config,
          createdAt: theme.createdAt.toISOString(),
          eventCount: theme.eventCount,
          thumbnailUrl: legacyThemeThumbnail(config),
        },
      ];
    }

    // A builder theme with no variant yet has no palette to draw a card with.
    const defaultVariant = pickDefaultVariant(theme.variants);
    if (!defaultVariant) return [];

    return theme.variants.map((variant) => {
      const builder = builderArt.get(theme.id)?.get(variant.id);
      const thumbnail = builderThemeThumbnail(builder);
      return {
        id: variant.id,
        themeId: theme.id,
        themeVariantId: variant.id,
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
        builder,
        thumbnailUrl: thumbnail.url,
        thumbnailCutout: thumbnail.cutout,
      };
    });
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-8">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-fg">{dict.themesGallery.heading}</h1>
        <p className="mt-2 text-fg-muted">{dict.themesGallery.subheading}</p>
      </div>

      {startError && (
        <p className="mx-auto mt-6 max-w-md rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-center text-sm text-fg">
          {startError === "rate" ? dict.themesGallery.startRateLimited : dict.themesGallery.startError}
        </p>
      )}

      <ThemeGalleryGrid themes={items} dict={dict} locale={locale} intent={intent} />
    </div>
  );
}
