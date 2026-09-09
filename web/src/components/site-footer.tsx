import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { VerifiedBadge } from "@/components/verified-badge";
import {
  SUPPORT_EMAIL,
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_E164,
  supportWhatsAppUrl,
} from "@/lib/support";

/**
 * The site footer. Every link here points at a route that exists. The legal
 * pages (terms, privacy, refunds) are required for the payment provider and now
 * ship, so they get their own column instead of being left out.
 *
 * The identity block under the brand — email, phone, country — and the
 * authentication badge directly beneath it are a regulatory requirement, not a
 * design flourish: a Saudi online store has to show who it is and how to reach
 * it where a visitor can find it, and the Saudi Business Center's e-commerce
 * authentication (the badge: certificate number plus a link to the public
 * register) is the reference the store trades under in public. Because the
 * footer renders on every page it also satisfies "on the home page". Keep it
 * visible; do not fold it into a link.
 *
 * The wordmark is the one place outside the header that keeps `font-display`
 * (Aref Ruqaa) — it is the brand's face, not a heading style.
 */
export function SiteFooter({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const h = dict.home;
  const c = dict.contact;

  const site = [
    { href: `/${locale}/themes`, label: dict.nav.themes },
    { href: `/${locale}/plans`, label: dict.nav.plans },
    { href: `/${locale}/gate-access`, label: dict.nav.scan },
    { href: `/${locale}/contact`, label: dict.nav.contact },
  ];
  const account = [
    { href: `/${locale}/login`, label: dict.nav.login },
    { href: `/${locale}/events`, label: dict.events.title },
  ];
  const legal = [
    { href: `/${locale}/terms`, label: dict.legal.terms },
    { href: `/${locale}/privacy`, label: dict.legal.privacy },
    { href: `/${locale}/refunds`, label: dict.legal.refunds },
  ];

  return (
    <footer className="border-t border-border bg-surface-2/40">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-8 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <p className="font-display text-2xl text-fg">{dict.brand.name}</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-fg-muted">{h.footerTagline}</p>

          <dl className="mt-6 grid gap-1.5 text-xs leading-relaxed text-fg-muted">
            <IdentityRow label={c.emailLabel}>
              <a href={`mailto:${SUPPORT_EMAIL}`} dir="ltr" className="transition-colors hover:text-fg">
                {SUPPORT_EMAIL}
              </a>
            </IdentityRow>
            <IdentityRow label={c.phoneLabel}>
              <a href={`tel:${SUPPORT_PHONE_E164}`} dir="ltr" className="transition-colors hover:text-fg">
                {SUPPORT_PHONE_DISPLAY}
              </a>
            </IdentityRow>
            <IdentityRow label={c.countryLabel}>{c.country}</IdentityRow>
          </dl>

          <div className="mt-6">
            <VerifiedBadge dict={dict} />
          </div>
        </div>

        <FooterColumn title={h.footerSite} links={site} />
        <FooterColumn title={h.footerAccount} links={account} />
        <FooterColumn title={h.footerLegal} links={legal} />
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-fg-muted sm:px-8">
          <span>
            © {new Date().getFullYear()} {dict.brand.name} — {h.footerRights}
          </span>
          <a
            href={supportWhatsAppUrl(h.ctaWhatsappMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-accent hover:text-accent-strong"
          >
            {h.ctaWhatsapp}
          </a>
        </div>
      </div>
    </footer>
  );
}

/** One label/value pair in the identity block. */
function IdentityRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <dt className="font-bold text-fg">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <p className="text-xs font-bold tracking-[0.12em] text-accent">{title}</p>
      <ul className="mt-4 flex flex-col gap-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-sm text-fg-muted transition-colors hover:text-fg">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
