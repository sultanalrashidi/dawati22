import Link from "next/link";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { defaultLocale } from "@/lib/i18n/locales";
import "./globals.css";

/**
 * The root 404. Needed in addition to [locale]/not-found.tsx because the
 * guest invitation tree (/i/[token]) and /theme-preview sit OUTSIDE the
 * [locale] segment and so never reach that one — a guest following a dead
 * invitation link is exactly the person who must not see an English stack of
 * default Next.js text.
 */
export default async function RootNotFound() {
  const dict = await getDictionary(defaultLocale);

  return (
    <html lang={defaultLocale} dir="rtl" data-theme="light">
      <body className="min-h-screen bg-bg text-fg antialiased">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-5 px-4 py-28 text-center sm:px-8">
          <span className="text-6xl text-accent">٤٠٤</span>
          <h1 className="text-3xl font-semibold text-fg">{dict.common.notFoundTitle}</h1>
          <p className="text-base leading-relaxed text-fg-muted">{dict.common.notFoundBody}</p>
          <Link
            href={`/${defaultLocale}`}
            className="mt-2 inline-flex h-12 items-center rounded-full bg-accent px-7 text-sm font-bold text-accent-fg transition-colors hover:bg-accent-strong"
          >
            {dict.common.notFoundHome}
          </Link>
        </div>
      </body>
    </html>
  );
}
