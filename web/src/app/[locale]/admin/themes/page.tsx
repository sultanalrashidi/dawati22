import Link from "next/link";
import { notFound } from "next/navigation";
import { ThemeEngine, ThemeVisibility } from "@/generated/prisma/client";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { listAllThemes } from "@/lib/admin/themes/service";
import { listBuilderThemes } from "@/lib/admin/themes/builder-service";
import { parsePalette } from "@/lib/themes/builder/schema";
import { ThemeDeleteControl } from "@/components/admin/theme-status-actions";
import type { ThemeConfig } from "@/lib/themes/types";

export default async function AdminThemesPage({ params }: PageProps<"/[locale]/admin/themes">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const a = dict.admin;

  const [allThemes, builderThemes] = await Promise.all([listAllThemes(), listBuilderThemes()]);
  // The legacy grid reads `config.palette`, which only legacy themes carry —
  // builder themes store their colors on their variants instead.
  const legacyThemes = allThemes.filter((theme) => theme.engine === ThemeEngine.LEGACY);

  return (
    <div className="flex flex-col gap-10">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-fg">{a.builderThemes}</h1>
            <p className="mt-1 text-sm text-fg-muted">{a.builderThemesNote}</p>
          </div>
          <Link
            href={`/${locale}/admin/themes/builder/new`}
            className="inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-fg hover:bg-accent-strong"
          >
            {a.newBuilderTheme}
          </Link>
        </div>

        {builderThemes.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-border bg-surface p-6 text-sm text-fg-muted">
            {a.noBuilderThemes}
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {builderThemes.map((theme) => {
              const palette = parsePalette(theme.variants.find((v) => v.isDefault)?.palette ?? theme.variants[0]?.palette);
              return (
                // The delete control is a form, so it sits beside the Link
                // rather than inside it — a form nested in an anchor is invalid
                // markup and the anchor would swallow every click in the panel.
                <div
                  key={theme.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors focus-within:border-accent hover:border-accent"
                >
                  <Link href={`/${locale}/admin/themes/builder/${theme.id}`} className="flex flex-col gap-3">
                    <div
                      className="h-24 w-full rounded-xl"
                      style={{ background: `linear-gradient(135deg, ${palette.bg}, ${palette.accent})` }}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate font-medium text-fg">
                        {locale === "ar" ? theme.nameAr : theme.name}
                      </p>
                      <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-fg-muted">
                        {a.themeStatus[theme.status]}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="rounded-full bg-surface-2 px-2.5 py-1 text-fg-muted">
                        {a.themeOccasion[theme.occasion]}
                      </span>
                      <span
                        className={
                          theme.visibility === ThemeVisibility.PRIVATE
                            ? "rounded-full bg-warning/10 px-2.5 py-1 text-warning"
                            : "rounded-full bg-surface-2 px-2.5 py-1 text-fg-muted"
                        }
                      >
                        {theme.visibility === ThemeVisibility.PRIVATE ? a.visibilityPrivate : a.visibilityPublic}
                      </span>
                      <span className="rounded-full bg-surface-2 px-2.5 py-1 text-fg-muted">
                        {a.variantCount.replace("{count}", String(theme.variants.length))}
                      </span>
                    </div>
                    <p className="text-xs text-fg-muted">
                      {a.usedByEvents.replace("{count}", String(theme._count.events))}
                    </p>
                  </Link>
                  <ThemeDeleteControl themeId={theme.id} locale={locale} label={a.delete} className="mt-auto" />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-8">
          <div>
            <h2 className="text-xl font-semibold text-fg">{a.legacyThemes}</h2>
            <p className="mt-1 text-sm text-fg-muted">{a.legacyThemesNote}</p>
          </div>
          <Link
            href={`/${locale}/admin/themes/new`}
            className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-fg hover:bg-surface-2"
          >
            {a.addTheme}
          </Link>
        </div>

        {legacyThemes.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-border bg-surface p-6 text-sm text-fg-muted">
            {a.noLegacyThemes}
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {legacyThemes.map((theme) => {
              const config = theme.config as unknown as ThemeConfig;
              return (
                <div
                  key={theme.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors focus-within:border-accent hover:border-accent"
                >
                  <Link href={`/${locale}/admin/themes/${theme.id}`} className="flex flex-col gap-3">
                    <div
                      className="h-24 w-full rounded-xl"
                      style={{ background: `linear-gradient(135deg, ${config.palette.bg}, ${config.palette.accent})` }}
                    />
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-fg">{locale === "ar" ? theme.nameAr : theme.name}</p>
                      <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-fg-muted">
                        {a.themeStatus[theme.status]}
                      </span>
                    </div>
                    <p className="text-xs text-fg-muted">
                      {theme.category} · {a.usedByEvents.replace("{count}", String(theme._count.events))}
                    </p>
                  </Link>
                  <ThemeDeleteControl themeId={theme.id} locale={locale} label={a.delete} className="mt-auto" />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
