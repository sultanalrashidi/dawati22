"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import type { SessionUser } from "@/lib/auth/session";
import { logoutAction } from "@/lib/auth/actions";
import { supportWhatsAppUrl } from "@/lib/support";
import { ThemeToggle } from "@/components/theme-toggle";
import { ScanIcon } from "@/components/icons/scan-icon";

/**
 * The site header: the wordmark and a menu button at the start, and at the end
 * the three things someone actually arrives here to do — open the door
 * scanner, sign in (only when signed out), and start a design.
 *
 * The scanner sits in the strip rather than in the panel because it is the one
 * link used under pressure: a door team standing at the entrance with a queue
 * behind them should not have to find it inside a menu. It always carries a
 * label — the full wording on a wide screen, a shorter one on a phone — so
 * nobody has to guess what a bare icon means.
 *
 * Everything else lives in the slide-in panel, including the language switch —
 * it was a permanent word in the strip for something most visitors never touch.
 */
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
  const [open, setOpen] = useState(false);
  const otherLocale: Locale = locale === "ar" ? "en" : "ar";
  const swappedPath = pathname.replace(`/${locale}`, `/${otherLocale}`) || `/${otherLocale}`;
  const n = dict.nav;

  // A route change means the panel's job is done — leaving it open over the new
  // page would hide the very thing the tap asked for. Derived during render
  // rather than in an effect: an effect would paint the new page with the panel
  // still over it for one frame, and every drawer link already closes on click,
  // so this only has to catch navigation that happens another way (the back
  // button, mostly).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  // A panel that covers the page must not leave the page scrolling behind it.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // The links every visitor gets. `#` targets are sections of the home page,
  // so they carry the locale prefix and work from any route.
  const menuLinks = [
    { href: `/${locale}/themes`, label: n.themes },
    { href: `/${locale}#how-it-works`, label: n.howItWorks },
    { href: `/${locale}/plans`, label: n.plans },
    { href: `/${locale}#faq`, label: n.faq },
  ];

  // Kept from the old header — these were icon buttons in the top strip and
  // would otherwise have disappeared with it. The scanner is repeated here on
  // purpose: the strip only ever has room for its short label, and this is
  // where a first-time door team reads the full wording.
  const accountLinks = [
    ...(user?.role === "CUSTOMER" ? [{ href: `/${locale}/events`, label: n.myEvents }] : []),
    ...(user?.role === "ADMIN" ? [{ href: `/${locale}/admin`, label: n.admin }] : []),
    ...(user?.role === "GATE_STAFF" ? [{ href: `/${locale}/gate`, label: n.gate }] : []),
    { href: `/${locale}/gate-access`, label: n.scan },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:gap-3 sm:px-8">
          <div className="flex items-center gap-2">
            <Link href={`/${locale}`} className="font-display text-xl text-fg">
              {dict.brand.name}
            </Link>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={n.menu}
              aria-expanded={open}
              className="flex h-9 w-9 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href={`/${locale}/gate-access`}
              title={n.scanFull}
              aria-label={n.scanFull}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-accent-soft/60 bg-accent-soft/15 px-2 text-sm font-bold text-accent transition-colors hover:border-accent hover:bg-accent-soft/30 sm:gap-2 sm:px-3.5"
            >
              <ScanIcon className="h-[18px] w-[18px]" />
              <span className="hidden min-[360px]:inline sm:hidden">{n.scanShort}</span>
              <span className="hidden sm:inline">{n.scan}</span>
            </Link>
            {!user && (
              <Link
                href={`/${locale}/login`}
                aria-label={n.login}
                className="inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full px-2 text-sm font-bold text-fg transition-colors hover:text-accent sm:px-3"
              >
                <span className="sm:hidden">{n.loginShort}</span>
                <span className="hidden sm:inline">{n.login}</span>
              </Link>
            )}
            <Link
              href={`/${locale}/plans`}
              className="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-full bg-fg px-3.5 text-sm font-bold text-bg transition-opacity hover:opacity-90 sm:px-5"
            >
              {n.designYours}
            </Link>
          </div>
        </div>
      </header>

      {/* ── SLIDE-IN PANEL ──────────────────────────────────────────────── */}
      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label={n.closeMenu}
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-black/45"
          />

          {/* `start-0` is the RIGHT edge in Arabic — the panel opens on the
              same side as the button that summoned it, and mirrors to the left
              automatically in English. */}
          <div className="absolute inset-y-0 start-0 flex w-[19rem] max-w-[85vw] flex-col gap-5 overflow-y-auto border-e border-border bg-bg p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="font-display text-xl text-fg">{dict.brand.name}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={n.closeMenu}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <nav className="flex flex-col">
              {menuLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="border-b border-border py-3.5 text-base font-medium text-fg transition-colors hover:text-accent"
                >
                  {link.label}
                </Link>
              ))}
              <a
                href={supportWhatsAppUrl(n.contactMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="border-b border-border py-3.5 text-base font-medium text-fg transition-colors hover:text-accent"
              >
                {n.contact}
              </a>
            </nav>

            {accountLinks.length > 0 && (
              <nav className="flex flex-col">
                {accountLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="py-2.5 text-sm text-fg-muted transition-colors hover:text-fg"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            )}

            <ThemeToggle dict={dict} />

            <div className="mt-auto flex flex-col gap-3 pt-2">
              <Link
                href={swappedPath}
                onClick={() => setOpen(false)}
                className="flex h-11 items-center justify-center rounded-full border border-border text-sm font-bold text-fg-muted transition-colors hover:text-fg"
              >
                {n.language}
              </Link>

              {user && (
                <form action={logoutAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <button
                    type="submit"
                    className="h-11 w-full rounded-full border border-danger/30 text-sm font-bold text-danger transition-colors hover:bg-danger/10"
                  >
                    {n.logout}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
