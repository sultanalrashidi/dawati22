"use client";

import { useActionState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { updatePricingRateAction, type PricingFormState } from "@/lib/admin/actions";

/**
 * One row of the live price list. Each tier saves on its own so a typo in one
 * price cannot take the other down with it.
 */
export function PricingRateForm({
  locale,
  dict,
  tier,
  label,
  unitPrice,
}: {
  locale: string;
  dict: Dictionary;
  tier: "WITH_QR" | "NO_QR";
  label: string;
  /** Null when this tier has no row yet — the field renders empty. */
  unitPrice: number | null;
}) {
  const action = updatePricingRateAction.bind(null, locale);
  const [state, formAction, isPending] = useActionState<PricingFormState, FormData>(action, null);
  const a = dict.admin;

  return (
    <form action={formAction} className="rounded-xl border border-border bg-surface p-4">
      <input type="hidden" name="tier" value={tier} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-medium text-fg">{label}</p>
          <label className="mt-2 flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">{a.unitPrice}</span>
            <input
              name="unitPrice"
              type="number"
              step="0.25"
              min="0.25"
              max="100"
              required
              defaultValue={unitPrice ?? ""}
              dir="ltr"
              className="h-10 w-32 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="h-10 rounded-full bg-accent px-5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong disabled:opacity-50"
        >
          {isPending ? dict.common.loading : dict.common.save}
        </button>
      </div>

      {state?.error && <p className="mt-3 text-sm text-danger">{a.invalidForm}</p>}
      {state?.saved && !isPending && <p className="mt-3 text-sm text-success">{dict.common.success}</p>}
    </form>
  );
}
