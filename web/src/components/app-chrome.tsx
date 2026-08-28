import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth/session";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export async function AppChrome({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: ReactNode;
}) {
  const user = await getSessionUser();

  return (
    <>
      <SiteHeader locale={locale} dict={dict} user={user} />
      <main className="flex-1">{children}</main>
      <SiteFooter locale={locale} dict={dict} />
    </>
  );
}
