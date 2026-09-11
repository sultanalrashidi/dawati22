import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getSessionUser } from "@/lib/auth/session";
import { ThemesGalleryView } from "@/components/themes/themes-gallery-view";

/**
 * The gallery for someone holding a session cookie — next.config.ts rewrites
 * `/[locale]/themes` here for them, so the address bar never shows `/mine`.
 * Rendered per request because it adds the PRIVATE designs assigned to this
 * customer; for everyone else the static `themes/page.tsx` is the same page.
 */
export default async function MyThemesGalleryPage({ params }: PageProps<"/[locale]/themes/mine">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const user = await getSessionUser();
  return <ThemesGalleryView locale={locale} userId={user?.id ?? null} />;
}
