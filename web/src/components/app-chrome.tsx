import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth/session";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { SiteHeader } from "@/components/site-header";

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
      <footer className="border-t border-border px-4 py-6 text-center text-sm text-fg-muted sm:px-8">
        © {new Date().getFullYear()} {dict.brand.name}
      </footer>
    </>
  );
}
