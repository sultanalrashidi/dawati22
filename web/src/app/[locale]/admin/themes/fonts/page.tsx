import { notFound } from "next/navigation";
import { ThemeFontSource } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { googleFontsHref } from "@/lib/themes/font-registry";
import { FontLibrary } from "@/components/admin/builder/font-library";
import { HouseTypefacePanel } from "@/components/admin/house-typeface-panel";
import { getTypographyPreset } from "@/lib/settings/service";
import { summariseThemeFonts } from "@/lib/admin/themes/typography-apply";
import { BUILTIN_FONTS, parseFontWeights } from "@/lib/themes/font-registry";
import { THEME_CATEGORIES, themeCategoryLabel } from "@/lib/themes/vocabulary";

export default async function AdminFontsPage({ params }: PageProps<"/[locale]/admin/themes/fonts">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  const fonts = await prisma.themeFont.findMany({
    where: { source: ThemeFontSource.GOOGLE },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, family: true, label: true, labelAr: true, weights: true, isArabic: true },
  });

  const [preset, combinations, themeRows] = await Promise.all([
    getTypographyPreset(),
    summariseThemeFonts(),
    prisma.theme.findMany({
      select: { id: true, name: true, nameAr: true, category: true },
      orderBy: { nameAr: "asc" },
    }),
  ]);

  // Both tiers, because the house typeface may name either — see font-registry.
  const fontOptions = [
    ...BUILTIN_FONTS,
    ...fonts.map((f) => ({
      family: f.family,
      label: f.label,
      // Both are optional on the row and required on the option; falling back
      // to the family name beats an empty entry nobody can identify.
      labelAr: f.labelAr ?? f.label ?? f.family,
      source: "GOOGLE" as const,
      isArabic: f.isArabic,
      weights: parseFontWeights(f.weights),
    })),
  ];

  // Only the styles that designs actually use: an empty scope is a button that
  // can only ever change nothing.
  const usedCategories = new Set(themeRows.map((t) => t.category));
  const categories = THEME_CATEGORIES.filter(
    (c) => c.dbValue !== null && usedCategories.has(c.dbValue),
  ).map((c) => ({
    value: c.dbValue as string,
    label: themeCategoryLabel(c.dbValue as string, dict.themesGallery),
  }));

  // One stylesheet for the whole list, built here so the previews below can
  // actually render in the family they name.
  const href = googleFontsHref(fonts.map((f) => ({ family: f.family, weights: f.weights })));

  return (
    <div>
      {href && <link rel="stylesheet" href={href} />}
      <h1 className="text-2xl font-semibold text-fg">{dict.admin.fontsLibrary}</h1>
      <div className="mt-6">
        <HouseTypefacePanel
          locale={locale}
          dict={dict}
          preset={preset}
          fonts={fontOptions}
          combinations={combinations}
          themes={themeRows.map((t) => ({
            id: t.id,
            name: locale === "ar" ? t.nameAr : t.name,
            category: t.category,
          }))}
          categories={categories}
        />
      </div>

      <div className="mt-10">
        <FontLibrary locale={locale} dict={dict} googleFonts={fonts} />
      </div>
    </div>
  );
}
