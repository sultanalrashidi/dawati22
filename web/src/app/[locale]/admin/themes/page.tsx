import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { listAllThemes } from "@/lib/admin/themes/service";
import type { ThemeConfig } from "@/lib/themes/types";

export default async function AdminThemesPage({ params }: PageProps<"/[locale]/admin/themes">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const themes = await listAllThemes();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-fg">{dict.admin.themes}</h1>
        <Link
          href={`/${locale}/admin/themes/new`}
          className="h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-fg hover:bg-accent-strong inline-flex"
        >
          {dict.admin.addTheme}
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((theme) => {
          const config = theme.config as unknown as ThemeConfig;
          return (
            <Link
              key={theme.id}
              href={`/${locale}/admin/themes/${theme.id}`}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent"
            >
              <div
                className="h-24 w-full rounded-xl"
                style={{ background: `linear-gradient(135deg, ${config.palette.bg}, ${config.palette.accent})` }}
              />
              <div className="flex items-center justify-between">
                <p className="font-medium text-fg">{locale === "ar" ? theme.nameAr : theme.name}</p>
                <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-fg-muted">
                  {dict.admin.themeStatus[theme.status]}
                </span>
              </div>
              <p className="text-xs text-fg-muted">
                {theme.category} · {dict.admin.usedByEvents.replace("{count}", String(theme._count.events))}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
