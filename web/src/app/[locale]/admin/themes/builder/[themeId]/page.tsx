import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { prisma } from "@/lib/db/client";
import { getBuilderTheme } from "@/lib/admin/themes/builder-service";
import { isBlobStorageEnabled } from "@/lib/admin/themes/storage";
import { BUILTIN_FONTS, googleFontsHref, type FontOption } from "@/lib/themes/font-registry";
import { ThemeBuilder } from "@/components/admin/builder/theme-builder";
import { ThemeMetaForm } from "@/components/admin/builder/theme-meta-form";
import { ThemeAccessPanel } from "@/components/admin/builder/theme-access-panel";
import { ConvertToBuilder } from "@/components/admin/builder/convert-to-builder";
import { ThemeEngine } from "@/generated/prisma/client";

export default async function ThemeBuilderPage({ params }: PageProps<"/[locale]/admin/themes/builder/[themeId]">) {
  const { locale, themeId } = await params;
  const dict = await getDictionary(locale === "en" ? "en" : "ar");

  const builder = await getBuilderTheme(themeId);
  if (!builder || builder.theme.engine !== ThemeEngine.BUILDER) notFound();

  // A natively-created builder theme stores `config: { engine: "builder" }`;
  // an imported one still carries the artwork config it was built from, which
  // is exactly what revert needs.
  const wasConverted = Boolean((builder.theme.config as { card?: unknown } | null)?.card);

  const customFonts = await prisma.themeFont.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  const fonts: FontOption[] = [
    ...BUILTIN_FONTS,
    ...customFonts.map((font) => ({
      family: font.family,
      label: font.label,
      labelAr: font.labelAr ?? font.label,
      source: "GOOGLE" as const,
      isArabic: font.isArabic,
      weights: font.weights.split(",").map((w) => Number.parseInt(w.trim(), 10)).filter(Number.isFinite),
    })),
  ];

  // Admin-added families are not bundled by next/font, so the editor has to
  // pull their stylesheet itself or the canvas would preview the fallback.
  const fontsHref = googleFontsHref(customFonts.map((f) => ({ family: f.family, weights: f.weights })));

  return (
    <div className="flex flex-col gap-4">
      {fontsHref && <link rel="stylesheet" href={fontsHref} />}

      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href={`/${locale}/admin/themes`} className="text-xs text-fg-muted hover:underline">
            ← {dict.admin.themes}
          </Link>
          <h1 className="text-xl font-semibold text-fg">{builder.theme.nameAr}</h1>
          <p className="text-xs text-fg-muted" dir="ltr">
            {builder.theme.slug} · {builder.theme.status}
            {builder.theme._count.events > 0 && ` · ${builder.theme._count.events} events`}
          </p>
        </div>
      </header>

      {/* A theme imported from the hand-coded engine keeps its original
          `config.card`, so it can still go back. The control belongs here:
          the legacy page it used to live on now redirects builder themes
          straight to this editor, which would leave revert unreachable. */}
      {wasConverted && (
        <ConvertToBuilder
          themeId={builder.theme.id}
          locale={locale}
          dict={dict}
          converted
          colorCount={builder.variants.length}
        />
      )}

      <ThemeBuilder
        themeId={builder.theme.id}
        themeStatus={builder.theme.status}
        locale={locale}
        initialLayout={builder.layout}
        typography={builder.typography}
        variants={builder.variants}
        assets={builder.assets}
        fonts={fonts}
        blobEnabled={isBlobStorageEnabled()}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ThemeMetaForm
          themeId={builder.theme.id}
          locale={locale}
          theme={{
            name: builder.theme.name,
            nameAr: builder.theme.nameAr,
            category: builder.theme.category,
            occasion: builder.theme.occasion,
            visibility: builder.theme.visibility,
            descriptionAr: builder.theme.descriptionAr,
            status: builder.theme.status,
          }}
        />
        <ThemeAccessPanel
          themeId={builder.theme.id}
          locale={locale}
          visibility={builder.theme.visibility}
          assignments={builder.theme.assignments.map((a) => ({
            userId: a.user.id,
            name: a.user.name,
            phone: a.user.phone,
          }))}
        />
      </div>
    </div>
  );
}
