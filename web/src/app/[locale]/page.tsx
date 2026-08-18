import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-4 py-24 text-center sm:px-8">
      <p className="font-display text-sm uppercase tracking-[0.3em] text-accent">
        {dict.brand.name}
      </p>
      <h1 className="text-balance text-4xl font-semibold leading-tight text-fg sm:text-5xl">
        {dict.home.heroTitle}
      </h1>
      <p className="text-balance text-lg text-fg-muted">{dict.home.heroSubtitle}</p>
      <div className="flex flex-col items-center gap-4">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`/${locale}/login`}
            className="h-11 items-center rounded-full bg-accent px-6 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong inline-flex"
          >
            {dict.home.ctaStart}
          </Link>
          <Link
            href={`/${locale}/plans`}
            className="h-11 items-center rounded-full border border-border px-6 text-sm font-medium text-fg transition-colors hover:bg-surface-2 inline-flex"
          >
            {dict.home.ctaPlans}
          </Link>
        </div>
        <Link href={`/${locale}/themes`} className="text-sm font-medium text-accent underline-offset-4 hover:underline">
          {dict.home.ctaThemes}
        </Link>
      </div>
    </div>
  );
}
