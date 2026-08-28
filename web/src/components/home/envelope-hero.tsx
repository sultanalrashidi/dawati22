import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";

/**
 * The hero's phone mock.
 *
 * Deliberately NOT the real `InvitationView` — that component is ~1500 lines
 * and pulls the whole theme engine, the music player and the QR renderer onto
 * the landing page for a picture. This is one real product image in a frame.
 *
 * The RSVP toast sits INSIDE the phone frame on purpose. Floating outside it,
 * as the design draws it, it reads as a live activity feed of real guests —
 * which it is not, and there is no data behind it.
 */
export function EnvelopeHero({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const h = dict.home;

  return (
    <div className="relative mx-auto w-full max-w-sm lg:mx-0" aria-hidden="true">
      {/* The soft arch the design sets the phone against. */}
      <div
        className="absolute inset-x-6 bottom-6 top-0 rounded-t-full bg-surface-2"
        style={{ background: "linear-gradient(180deg, var(--color-surface-2), transparent 80%)" }}
      />

      <div className="relative mx-auto w-[16.5rem] rounded-[2.25rem] border border-border bg-surface p-2.5 shadow-[0_18px_40px_-18px_rgba(36,30,18,0.35)] sm:w-72">
        <div className="overflow-hidden rounded-[1.75rem] bg-bg">
          {/* A real published design, not an illustration of one. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/themes/ivory-bloom/envelope-closed.webp"
            alt=""
            className="block aspect-[3/4] w-full object-cover"
          />

          <div className="flex flex-col gap-2.5 px-4 py-4">
            <p className="text-center text-[11px] font-bold tracking-wide text-fg-muted">
              {h.heroPoint1}
            </p>

            {/* An illustrated example of what a reply looks like. */}
            <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                  <path d="M4 10.5l4 4 8-9" />
                </svg>
              </span>
              <span className="min-w-0 text-[11px] leading-tight text-fg-muted">
                {locale === "ar" ? "أم محمد أكّدت حضورها" : "Umm Mohammed accepted"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
