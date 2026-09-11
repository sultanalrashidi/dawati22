import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { ThemesGalleryView } from "@/components/themes/themes-gallery-view";

// The public gallery, served from the CDN and rebuilt in the background at
// most once a minute — so a design published in the admin shows up here within
// a minute, and publishing revalidates it at once (see the theme actions).
// Signed-in visitors never land here: next.config.ts rewrites them to
// `themes/mine`, which also shows the designs made for them.
export const revalidate = 60;

export default async function ThemesGalleryPage({ params }: PageProps<"/[locale]/themes">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <ThemesGalleryView locale={locale} userId={null} />;
}
