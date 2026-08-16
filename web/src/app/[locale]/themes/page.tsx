import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { listPublishedThemes } from "@/lib/events/service";
import type { ThemeConfig } from "@/lib/themes/types";

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
        {themes.map((theme) => {
          const config = theme.config as unknown as ThemeConfig;
          return (
            <div
              key={theme.id}
              className="flex flex-col items-center gap-4 rounded-2xl p-8 text-center shadow-sm"
              style={{ background: config.palette.bg, color: config.palette.fg }}
            >
              <p className="text-xs uppercase tracking-[0.3em]" style={{ color: config.palette.accent }}>
                {dict.guest.guestOf}
              </p>
              <p className="text-lg">{locale === "ar" ? theme.nameAr : theme.name}</p>
              <p className="text-sm" style={{ color: config.palette.fgMuted }}>
                Sultan &amp; Noura
              </p>
              <span
                className="rounded-full border px-4 py-1.5 text-xs"
                style={{ borderColor: config.palette.accent, color: config.palette.accent }}
              >
                {theme.category}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
