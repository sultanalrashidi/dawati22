import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { dirOf, type Locale } from "@/lib/i18n/locales";

export type DraftStep = "design" | "details" | "preview" | "activate";

/**
 * Where she is in the free-first journey, on one line:
 * التصميم ← البيانات ← المعاينة ← التفعيل.
 *
 * Every step except the current one is a link, because a draft is complete
 * from the moment it exists (startDraft writes the whole sample invitation),
 * so nothing ahead of her is unreachable. Rendered on the draft screens only —
 * the preview is full-bleed and carries its own toolbar.
 */
export function DraftSteps({
  locale,
  dict,
  eventId,
  current,
}: {
  locale: Locale;
  dict: Dictionary;
  eventId: string;
  current: DraftStep;
}) {
  const d = dict.draft;
  const steps: { key: DraftStep; label: string; href: string }[] = [
    // The gallery re-points THIS draft rather than starting a second one.
    { key: "design", label: d.stepDesign, href: `/${locale}/themes` },
    { key: "details", label: d.stepDetails, href: `/${locale}/draft/${eventId}/details` },
    { key: "preview", label: d.stepPreview, href: `/preview/${eventId}` },
    { key: "activate", label: d.stepActivate, href: `/${locale}/draft/${eventId}/activate` },
  ];
  // Points along the reading direction: forward is to the left in Arabic,
  // the same convention as «شاهد المعاينة مرة ثانية ←».
  const arrow = dirOf(locale) === "rtl" ? "←" : "→";

  return (
    <nav aria-label={d.stepsLabel} className="overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1 text-xs">
        {steps.map((step, index) => (
          <li key={step.key} className="flex items-center gap-1">
            {index > 0 && (
              <span aria-hidden="true" className="px-0.5 text-fg-muted/50">
                {arrow}
              </span>
            )}
            {step.key === current ? (
              <span
                aria-current="step"
                className="rounded-full bg-accent px-2.5 py-1 font-bold text-accent-fg"
              >
                {step.label}
              </span>
            ) : (
              <Link
                href={step.href}
                className="rounded-full px-2.5 py-1 font-medium text-fg-muted transition-colors hover:text-accent"
              >
                {step.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
