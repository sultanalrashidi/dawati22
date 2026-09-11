import type { ReactNode } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

/**
 * The frame every locale page shares. It deliberately reads no session: this
 * runs inside the root layout, so a single `cookies()` here made every page on
 * the site — the home page included — render on demand instead of being
 * served as a file from the CDN. The header works out who is signed in on the
 * client instead (see `session-hint.ts`).
 */
export function AppChrome({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader locale={locale} dict={dict} />
      <main className="flex-1">{children}</main>
      <SiteFooter locale={locale} dict={dict} />
    </>
  );
}
