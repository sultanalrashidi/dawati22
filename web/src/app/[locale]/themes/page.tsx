import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { listPublishedThemes } from "@/lib/events/service";
import type { ThemeConfig } from "@/lib/themes/types";
import { ThemeGalleryCard } from "@/components/themes/theme-gallery-card";

export default async function ThemesGalleryPage({ params }: PageProps<"/[locale]/themes">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const themes = await listPublishedThemes();

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-8">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-fg">{dict.admin.themes}</h1>
        <p className="mt-2 text-fg-muted">{dict.events.form.themeLabel}</p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((theme) => (
          <ThemeGalleryCard
            key={theme.id}
            name={locale === "ar" ? theme.nameAr : theme.name}
            category={theme.category}
            config={theme.config as unknown as ThemeConfig}
            dict={dict}
          />
        ))}
      </div>
    </div>
  );
}
