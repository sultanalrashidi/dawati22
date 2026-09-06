import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { BUSINESS } from "@/lib/business";
import {
  SUPPORT_EMAIL,
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_E164,
  supportWhatsAppUrl,
} from "@/lib/support";

/**
 * A plain contact page.
 *
 * Saudi e-commerce rules want a reachable contact channel and the licence the
 * store trades under; the footer carries both on every page, and this page is
 * where a reviewer (or a customer who is about to enter her card) can read them
 * without hunting. Every value comes from `support.ts` / `business.ts` so the
 * page can never disagree with the footer or the legal documents.
 */
export async function generateMetadata({ params }: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { contact } = await getDictionary(locale);
  return { title: contact.title, description: contact.metaDescription };
}

export default async function ContactPage({ params }: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const c = dict.contact;

  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
      <h1 className="text-3xl font-semibold text-fg">{c.title}</h1>
      <p className="mt-4 leading-relaxed text-fg-muted">{c.intro}</p>
      <p className="mt-2 text-sm text-fg-muted">{c.hours}</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Channel
          label={c.whatsappLabel}
          value={SUPPORT_PHONE_DISPLAY}
          href={supportWhatsAppUrl(dict.nav.contactMessage)}
          external
        />
        <Channel label={c.emailLabel} value={SUPPORT_EMAIL} href={`mailto:${SUPPORT_EMAIL}`} />
        <Channel label={c.phoneLabel} value={SUPPORT_PHONE_DISPLAY} href={`tel:${SUPPORT_PHONE_E164}`} />
      </div>

      <section className="mt-12">
        <h2 className="text-lg font-semibold text-fg">{c.businessHeading}</h2>
        <dl className="mt-4 divide-y divide-border border-y border-border text-sm">
          <Detail label={c.licenceLabel}>
            <span dir="ltr" className="font-mono">
              {BUSINESS.licenceNumber}
            </span>
          </Detail>
          <Detail label={c.countryLabel}>{c.country}</Detail>
        </dl>
        <p className="mt-4 text-sm leading-relaxed text-fg-muted">{c.currencyNote}</p>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">{c.legalNote}</p>
      </section>
    </article>
  );
}

function Channel({
  label,
  value,
  href,
  external = false,
}: {
  label: string;
  value: string;
  href: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-accent-soft"
    >
      <span className="block text-xs font-bold tracking-[0.12em] text-accent">{label}</span>
      <span dir="ltr" className="mt-1 block truncate text-sm text-fg">
        {value}
      </span>
    </a>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 py-3">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="font-semibold text-fg">{children}</dd>
    </div>
  );
}
