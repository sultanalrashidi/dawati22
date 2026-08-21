import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { listPublishedThemes } from "@/lib/events/service";
import type { ThemeConfig } from "@/lib/themes/types";
import { ThemeGalleryGrid } from "@/components/themes/theme-gallery-grid";

export default async function ThemesGalleryPage({ params }: PageProps<"/[locale]/themes">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const themes = await listPublishedThemes();

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-8">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-fg">{dict.themesGallery.heading}</h1>
        <p className="mt-2 text-fg-muted">{dict.themesGallery.subheading}</p>
      </div>

      <ThemeGalleryGrid
        themes={themes.map((theme) => ({
          id: theme.id,
          slug: theme.slug,
          name: locale === "ar" ? theme.nameAr : theme.name,
          category: theme.category,
          config: theme.config as unknown as ThemeConfig,
          createdAt: theme.createdAt.toISOString(),
          eventCount: theme.eventCount,
        }))}
        dict={dict}
      />
    </div>
  );
}
