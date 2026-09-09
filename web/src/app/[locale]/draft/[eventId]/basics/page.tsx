import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";

/**
 * The former three-field "basics" screen. A draft is now born complete and has
 * one edit page; anything that still points here — an old bookmark, a tab
 * restored from before the change — lands on it.
 */
export default async function DraftBasicsRedirect({
  params,
}: PageProps<"/[locale]/draft/[eventId]/basics">) {
  const { locale, eventId } = await params;
  if (!isLocale(locale)) notFound();
  redirect(`/${locale}/draft/${eventId}/details`);
}
