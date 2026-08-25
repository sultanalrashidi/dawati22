import { notFound } from "next/navigation";
import { ThemeFontSource } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { googleFontsHref } from "@/lib/themes/font-registry";
import { FontLibrary } from "@/components/admin/builder/font-library";

export default async function AdminFontsPage({ params }: PageProps<"/[locale]/admin/themes/fonts">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  const fonts = await prisma.themeFont.findMany({
    where: { source: ThemeFontSource.GOOGLE },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, family: true, label: true, labelAr: true, weights: true, isArabic: true },
  });

  // One stylesheet for the whole list, built here so the previews below can
  // actually render in the family they name.
  const href = googleFontsHref(fonts.map((f) => ({ family: f.family, weights: f.weights })));

  return (
    <div>
      {href && <link rel="stylesheet" href={href} />}
      <h1 className="text-2xl font-semibold text-fg">{dict.admin.fontsLibrary}</h1>
      <div className="mt-6">
        <FontLibrary locale={locale} dict={dict} googleFonts={fonts} />
      </div>
    </div>
  );
}
