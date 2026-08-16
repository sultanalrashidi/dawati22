"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import type { SessionUser } from "@/lib/auth/session";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction } from "@/lib/auth/actions";

export function SiteHeader({
  locale,
  dict,
  user,
}: {
  locale: Locale;
  dict: Dictionary;
  user: SessionUser | null;
}) {
  const pathname = usePathname();
  const otherLocale: Locale = locale === "ar" ? "en" : "ar";
  const swappedPath = pathname.replace(`/${locale}`, `/${otherLocale}`) || `/${otherLocale}`;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
        <Link href={`/${locale}`} className="font-display text-lg font-semibold text-fg">
          {dict.brand.name}
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-fg-muted sm:flex">
          <Link href={`/${locale}/plans`} className="hover:text-fg">
            {dict.nav.plans}
          </Link>
          <Link href={`/${locale}/themes`} className="hover:text-fg">
            {dict.nav.themes}
          </Link>
          {user?.role === "CUSTOMER" && (
            <Link href={`/${locale}/events`} className="hover:text-fg">
              {dict.nav.myEvents}
            </Link>
          )}
          {user?.role === "ADMIN" && (
            <Link href={`/${locale}/admin`} className="hover:text-fg">
              {dict.nav.admin}
            </Link>
          )}
          {user?.role === "GATE_STAFF" && (
            <Link href={`/${locale}/gate`} className="hover:text-fg">
              {dict.nav.gate}
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={swappedPath}
            className="hidden h-9 items-center rounded-full border border-border px-3 text-sm text-fg-muted transition-colors hover:text-fg hover:bg-surface-2 sm:inline-flex"
          >
            {dict.nav.language}
          </Link>
          <ThemeToggle label={dict.nav.theme} />
          {user ? (
            <form action={logoutAction}>
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                className="h-9 rounded-full bg-surface-2 px-4 text-sm font-medium text-fg transition-colors hover:bg-border"
              >
                {dict.nav.logout}
              </button>
            </form>
          ) : (
            <Link
              href={`/${locale}/login`}
              className="h-9 rounded-full bg-accent px-4 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong inline-flex items-center"
            >
              {dict.nav.login}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
