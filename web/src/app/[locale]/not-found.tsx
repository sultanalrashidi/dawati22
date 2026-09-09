import Link from "next/link";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { defaultLocale } from "@/lib/i18n/locales";

/**
 * Every notFound() inside the localised tree used to land on Next's built-in
 * page: English, left-to-right, unstyled, on an Arabic RTL product.
 *
 * A not-found file cannot read route params, so the locale is not knowable
 * here — this renders the default locale, and the surrounding [locale]/layout
 * still supplies the right direction and chrome.
 */
export default async function LocaleNotFound() {
  const dict = await getDictionary(defaultLocale);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-5 px-4 py-28 text-center sm:px-8">
      <span className="text-6xl font-extrabold tabular-nums text-accent-soft">٤٠٤</span>
      <h1 className="text-3xl font-extrabold text-fg">{dict.common.notFoundTitle}</h1>
      <p className="text-base leading-relaxed text-fg-muted">{dict.common.notFoundBody}</p>
      <Link
        href={`/${defaultLocale}`}
        className="mt-2 inline-flex h-12 items-center rounded-full bg-accent px-7 text-sm font-bold text-accent-fg transition-colors hover:bg-accent-strong"
      >
        {dict.common.notFoundHome}
      </Link>
    </div>
  );
}
