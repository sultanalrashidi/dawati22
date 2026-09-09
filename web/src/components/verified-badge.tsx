import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { BUSINESS, isAuthenticationValid } from "@/lib/business";

/**
 * «متجر إلكتروني موثّق» — the Saudi Business Center e-commerce authentication.
 *
 * The certificate ships as a plain PDF: no seal to embed, no QR, no permanent
 * link. What makes the claim real is the public register, which anyone can
 * search by certificate number without logging in. So this badge is the number
 * and a link to that search, not a picture of a government emblem — we have no
 * right to reproduce those, and a number a visitor can check is stronger.
 *
 * It renders nothing once the certificate expires; see `business.ts`.
 */
export function VerifiedBadge({ dict }: { dict: Dictionary }) {
  if (!isAuthenticationValid()) return null;
  const v = dict.verified;

  return (
    <a
      href={BUSINESS.authentication.inquiryUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={v.verifyHint}
      className="group inline-flex max-w-sm items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5 transition-colors hover:border-accent-soft"
    >
      <CheckSeal />
      <span className="min-w-0">
        <span className="block text-sm font-bold leading-tight text-fg">{v.title}</span>
        <span className="mt-0.5 block text-[11px] leading-tight text-fg-muted">{v.issuer}</span>
        <span className="mt-1 block text-[11px] leading-tight text-fg-muted">
          {v.numberLabel}{" "}
          <span dir="ltr" className="font-mono">
            {BUSINESS.authentication.number}
          </span>
        </span>
      </span>
    </a>
  );
}

/** A generic check-in-a-shield. Deliberately ours, not any official emblem. */
function CheckSeal() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-8 w-8 shrink-0 text-accent transition-colors group-hover:text-accent-strong"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2.75 4.75 5.5v6.06c0 4.2 2.9 8.13 7.25 9.69 4.35-1.56 7.25-5.49 7.25-9.69V5.5Z" />
      <path d="m8.75 12 2.25 2.25 4.25-4.5" />
    </svg>
  );
}
