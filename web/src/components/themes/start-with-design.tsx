"use client";

import { useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { startDraftAction } from "@/lib/drafts/actions";

const subscribeNever = () => () => {};

/**
 * What she picked on the pricing page, if she came from there: its button
 * sends her here as `/themes?tier=…&count=…`. Read in the browser because the
 * gallery is a static file, the same for every visitor, and cannot see its own
 * query on the server. Read loosely on purpose — a mangled query costs her the
 * pre-filled numbers, not the page; the action validates both again.
 */
function useCarriedChoice() {
  const query = useSyncExternalStore(subscribeNever, () => window.location.search, () => "");
  const params = new URLSearchParams(query);
  const count = Number(params.get("count"));
  return {
    tier: params.get("tier"),
    count: Number.isFinite(count) && count > 0 ? count : null,
  };
}

/**
 * The gallery's primary action: turn the design being looked at into a real
 * invitation, free and without an account.
 *
 * It posts the design the visitor is ACTUALLY looking at — the colour on show,
 * not the family's default — because "choose the design and its colour" is one
 * decision to her, and the swatch she clicked is the answer.
 *
 * The count and tier chosen on the pricing page ride along (see
 * `useCarriedChoice`), so they are already filled in when she reaches payment.
 * It is pure convenience: the numbers that get charged come from the order.
 */
export function StartWithDesign({
  themeId,
  themeVariantId,
  locale,
  dict,
  variant = "primary",
}: {
  themeId: string;
  themeVariantId: string | null;
  locale: Locale;
  dict: Dictionary;
  variant?: "primary" | "onDark";
}) {
  const intent = useCarriedChoice();
  return (
    <form action={startDraftAction} className="contents">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="themeId" value={themeId} />
      {themeVariantId && <input type="hidden" name="themeVariantId" value={themeVariantId} />}
      {intent.tier && <input type="hidden" name="intendedTier" value={intent.tier} />}
      {intent.count != null && <input type="hidden" name="intendedCount" value={intent.count} />}
      <SubmitButton label={dict.themesGallery.startWithDesign} variant={variant} />
    </form>
  );
}

function SubmitButton({ label, variant }: { label: string; variant: "primary" | "onDark" }) {
  // The form navigates on success, so the pressed state has to survive until
  // the new page paints — without it a slow phone looks like nothing happened
  // and gets tapped twice.
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        variant === "onDark"
          ? "h-11 rounded-full bg-white px-5 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
          : "h-10 w-full rounded-full bg-fg text-sm font-bold text-bg transition-opacity hover:opacity-90 disabled:opacity-60"
      }
    >
      {label}
    </button>
  );
}
