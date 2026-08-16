"use client";

import { useActionState, useEffect, useRef } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { createPlanAction, updatePlanAction, type PlanFormState } from "@/lib/admin/actions";

export function PlanForm({
  locale,
  dict,
  plan,
  onDone,
}: {
  locale: string;
  dict: Dictionary;
  plan?: { id: string; name: string; nameAr: string; invitationCount: number; price: number; sortOrder: number };
  onDone?: () => void;
}) {
  const action = plan ? updatePlanAction.bind(null, plan.id, locale) : createPlanAction.bind(null, locale);
  const [state, formAction, isPending] = useActionState<PlanFormState, FormData>(action, null);
  const a = dict.admin;

  // Only close/reset once the action has actually completed successfully —
  // closing on click alone would unmount the form before the submit lands.
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !isPending && !state?.error) onDone?.();
    wasPending.current = isPending;
  }, [isPending, state, onDone]);

  return (
    <form action={formAction} className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface p-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-fg-muted">{a.planNameAr}</span>
        <input
          name="nameAr"
          defaultValue={plan?.nameAr}
          required
          className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-fg-muted">{a.planNameEn}</span>
        <input
          name="name"
          dir="ltr"
          defaultValue={plan?.name}
          required
          className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-fg-muted">{a.planInvitations}</span>
        <input
          name="invitationCount"
          type="number"
          min={1}
          max={500}
          defaultValue={plan?.invitationCount}
          required
          className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-fg-muted">{a.planPrice}</span>
        <input
          name="price"
          type="number"
          min={1}
          step="0.01"
          defaultValue={plan?.price}
          required
          className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-fg-muted">{a.planSortOrder}</span>
        <input
          name="sortOrder"
          type="number"
          defaultValue={plan?.sortOrder ?? 0}
          className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
        />
      </label>
      <div className="col-span-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="h-10 rounded-full bg-accent px-5 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
        >
          {plan ? dict.common.save : a.addPlan}
        </button>
        {state?.error && <p className="text-sm text-danger">{a.invalidForm}</p>}
      </div>
    </form>
  );
}
