import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { listPricingRates } from "@/lib/orders/service";
import { InvitationTier } from "@/generated/prisma/enums";
import { supportWhatsAppUrl } from "@/lib/support";
import { EnvelopeHero } from "@/components/home/envelope-hero";
import { ScanIcon } from "@/components/icons/scan-icon";
import { walletPassesConfigured } from "@/lib/wallet/availability";

/**
 * The landing page.
 *
 * Every claim on it is a feature that actually ships — the envelope, the
 * music, the countdown, the map button, RSVP with a party size, the agenda,
 * and the free-first journey (design, preview, then pay). The one claim that
 * depends on the environment — a guest saving her entry pass to Apple or
 * Google Wallet — is asked of the server first and left out wherever no pass
 * can be issued. Marketing copy that the product cannot honour is a support
 * ticket, not a headline.
 */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const h = dict.home;

  // Read from the same table /plans reads, so the landing page can never
  // advertise a price the pricing page contradicts.
  const rates = await listPricingRates();
  const priceOf = (tier: InvitationTier) => {
    const rate = rates.find((r) => r.tier === tier);
    return rate ? Number(rate.unitPrice) : null;
  };
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en-US");
  const noQr = priceOf(InvitationTier.NO_QR);
  const withQr = priceOf(InvitationTier.WITH_QR);

  const steps = [
    { n: "01", title: h.step1Title, body: h.step1Body },
    { n: "02", title: h.step2Title, body: h.step2Body },
    { n: "03", title: h.step3Title, body: h.step3Body },
  ];

  // The three steps above end when the links go out; this is the fourth thing
  // that happens, on the night itself, and it is the part nobody can picture
  // from a screenshot — so it gets its own explanation rather than a bullet.
  const doorSteps = [
    { title: h.door1Title, body: h.door1Body },
    { title: h.door2Title, body: h.door2Body },
    { title: h.door3Title, body: h.door3Body },
  ];

  const faqs = [
    { q: h.faq1Q, a: h.faq1A },
    { q: h.faq2Q, a: h.faq2A },
    { q: h.faq3Q, a: h.faq3A },
    { q: h.faq4Q, a: h.faq4A },
  ];

  // The wallet card is the one feature the copy may not promise on its own:
  // a pass exists only where the signing material does, so the server is
  // asked before the landing page claims it — see lib/wallet/availability.ts.
  const walletPasses = walletPassesConfigured();
  const features = [
    { title: h.f1Title, body: h.f1Body },
    { title: h.f2Title, body: h.f2Body },
    { title: h.f3Title, body: h.f3Body },
    { title: h.f4Title, body: h.f4Body },
    { title: h.f5Title, body: h.f5Body },
    { title: h.f6Title, body: h.f6Body },
    ...(walletPasses ? [{ title: h.f7Title, body: h.f7Body }] : []),
  ];

  return (
    <div className="flex flex-col">
      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div className="flex flex-col items-start gap-6">
          <Kicker>{h.heroKicker}</Kicker>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.25] text-fg sm:text-5xl lg:text-6xl">
            {h.heroTitle}
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-fg-muted sm:text-lg">{h.heroSubtitle}</p>

          {/* Starting is free and needs no account, so the hero says that
              plainly and goes straight to the designs — one button, so there
              is only one thing to press. Pricing stays one tap away as a plain
              link for someone who wants the number before the pretty part. */}
          <div className="mt-1 flex flex-col items-start gap-3">
            <Link
              href={`/${locale}/themes`}
              className="inline-flex h-12 items-center rounded-full bg-accent px-7 text-sm font-bold text-accent-fg transition-colors hover:bg-accent-strong"
            >
              {h.ctaStartFree}
            </Link>
            <p className="text-xs text-fg-muted">{h.ctaStartFreeNote}</p>
            <Link
              href={`/${locale}/plans`}
              className="text-sm font-bold text-accent underline-offset-4 hover:underline"
            >
              {h.ctaPlans} ←
            </Link>
          </div>

          <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
            {[h.heroPoint1, h.heroPoint2, h.heroPoint3].map((point) => (
              <li key={point} className="flex items-center gap-2 text-sm text-fg-muted">
                <Tick />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <EnvelopeHero locale={locale} dict={dict} />
      </section>

      {/* ── STEPS ──────────────────────────────────────────────────────── */}
      <Band id="how-it-works">
        <SectionHead kicker={h.stepsKicker} title={h.stepsTitle} />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.n}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-7"
            >
              <span className="text-3xl font-extrabold tabular-nums text-accent-soft">{step.n}</span>
              <h3 className="text-lg font-bold text-fg">{step.title}</h3>
              <p className="text-sm leading-relaxed text-fg-muted">{step.body}</p>
            </div>
          ))}
        </div>

        {/* ── AT THE DOOR ──────────────────────────────────────────────── */}
        <div className="mt-6 rounded-3xl border border-border bg-surface p-7 sm:p-9">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft/25 text-accent">
              <ScanIcon className="h-6 w-6" />
            </span>
            <div>
              <h3 className="text-2xl font-extrabold leading-snug text-fg">{h.doorTitle}</h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">{h.doorSubtitle}</p>
            </div>
          </div>

          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {doorSteps.map((step, index) => (
              <li key={step.title} className="flex gap-3 rounded-2xl border border-border bg-bg p-5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-fg">
                  {nf.format(index + 1)}
                </span>
                <div>
                  <h4 className="text-sm font-bold text-fg">{step.title}</h4>
                  <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-sm leading-relaxed text-fg-muted">{h.doorNote}</p>
            <Link
              href={`/${locale}/gate-access`}
              className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-accent underline-offset-4 hover:underline"
            >
              <ScanIcon className="h-4 w-4" />
              {h.doorLink} ←
            </Link>
          </div>
        </div>
      </Band>

      {/* ── GUEST EXPERIENCE ───────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-8">
        <SectionHead kicker={h.guestKicker} title={h.guestTitle} subtitle={h.guestSubtitle} />
        <div className="mt-4 flex justify-center">
          <Link
            href={`/${locale}/themes`}
            className="text-sm font-bold text-accent underline-offset-4 hover:underline"
          >
            {h.guestLink} ←
          </Link>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-border bg-surface p-6">
              <h3 className="text-base font-bold text-fg">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ────────────────────────────────────────────────────── */}
      <Band>
        <SectionHead kicker={h.pricingKicker} title={h.pricingTitle} subtitle={h.pricingSubtitle} />
        {noQr !== null && withQr !== null && (
          <div className="mx-auto mt-12 grid max-w-3xl gap-5 sm:grid-cols-2">
            <PriceCard
              name={dict.plans.tierNoQr}
              price={nf.format(noQr)}
              unit={`${dict.common.sar} ${dict.plans.perInvitation}`}
            />
            <PriceCard
              featured
              badge={dict.plans.mostPopular}
              name={dict.plans.tierQr}
              price={nf.format(withQr)}
              unit={`${dict.common.sar} ${dict.plans.perInvitation}`}
            />
          </div>
        )}
        <div className="mt-8 flex justify-center">
          <Link
            href={`/${locale}/plans`}
            className="inline-flex h-12 items-center rounded-full border border-accent px-7 text-sm font-bold text-accent transition-colors hover:bg-accent hover:text-accent-fg"
          >
            {h.pricingLink} ←
          </Link>
        </div>
      </Band>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section id="faq" className="mx-auto w-full max-w-3xl scroll-mt-20 px-4 py-20 sm:px-8">
        <SectionHead kicker={h.faqKicker} title={h.faqTitle} />
        <div className="mt-10 flex flex-col">
          {faqs.map((item) => (
            <details
              key={item.q}
              className="group border-b border-border py-5 first:border-t first:border-border"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-bold text-fg marker:hidden">
                {item.q}
                <span
                  aria-hidden="true"
                  className="shrink-0 text-xl font-normal text-accent transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-fg-muted">{item.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-fg-muted">
          {h.faqNote}{" "}
          <a
            href={supportWhatsAppUrl(h.ctaWhatsappMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-accent hover:text-accent-strong"
          >
            {h.ctaWhatsapp}
          </a>
        </p>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-8">
        <div className="flex flex-col items-center gap-6 rounded-3xl border border-accent-soft/50 bg-surface px-6 py-14 text-center">
          <h2 className="text-balance text-3xl font-extrabold leading-snug text-fg sm:text-4xl">
            {h.ctaTitle}
          </h2>
          <p className="max-w-xl text-base text-fg-muted">{h.ctaBody}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/${locale}/themes`}
              className="inline-flex h-12 items-center rounded-full bg-accent px-7 text-sm font-bold text-accent-fg transition-colors hover:bg-accent-strong"
            >
              {h.ctaStartFree}
            </Link>
            <a
              href={supportWhatsAppUrl(h.ctaWhatsappMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center rounded-full border border-border px-7 text-sm font-bold text-fg transition-colors hover:border-accent"
            >
              {h.ctaWhatsapp}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

/** A full-bleed tinted band — the design alternates these with the page ground. */
function Band({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-y border-border bg-surface-2/60">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-8">{children}</div>
    </section>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-3 text-xs font-bold tracking-[0.14em] text-accent">
      <span aria-hidden="true" className="h-px w-10 bg-accent-soft" />
      {children}
    </span>
  );
}

function SectionHead({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Kicker>{kicker}</Kicker>
      <h2 className="text-balance text-3xl font-extrabold leading-snug text-fg sm:text-4xl">{title}</h2>
      {subtitle && <p className="max-w-2xl text-base leading-relaxed text-fg-muted">{subtitle}</p>}
    </div>
  );
}

function PriceCard({
  name,
  price,
  unit,
  featured,
  badge,
}: {
  name: string;
  price: string;
  unit: string;
  featured?: boolean;
  badge?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-2xl border bg-surface p-7 ${
        featured ? "border-accent" : "border-border"
      }`}
    >
      {badge ? (
        <span className="w-fit rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-fg">
          {badge}
        </span>
      ) : (
        <span aria-hidden="true" className="h-[26px]" />
      )}
      <h3 className="text-lg font-bold text-fg">{name}</h3>
      <p className="flex items-baseline gap-2">
        <span className="text-4xl font-extrabold tabular-nums text-fg">{price}</span>
        <span className="text-sm text-fg-muted">{unit}</span>
      </p>
    </div>
  );
}

function Tick() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-accent"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}
