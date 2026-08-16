"use client";

import { useState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { setPlanStatusAction } from "@/lib/admin/actions";
import { PlanForm } from "@/components/admin/plan-form";

type Plan = {
  id: string;
  name: string;
  nameAr: string;
  invitationCount: number;
  price: number;
  sortOrder: number;
  status: "ACTIVE" | "HIDDEN" | "ARCHIVED";
};

export function PlansManager({ locale, dict, plans }: { locale: string; dict: Dictionary; plans: Plan[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const a = dict.admin;

  return (
    <div className="flex flex-col gap-3">
      {plans.map((plan) => (
        <div key={plan.id} className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-fg">
                {plan.nameAr} <span className="text-fg-muted">({plan.name})</span>
              </p>
              <p className="text-sm text-fg-muted">
                {plan.invitationCount} · {plan.price} {dict.common.sar}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-fg-muted">{plan.status}</span>
              <button
                type="button"
                onClick={() => setEditingId(editingId === plan.id ? null : plan.id)}
                className="text-xs text-fg-muted hover:text-fg hover:underline"
              >
                {a.editPlan}
              </button>
              {plan.status !== "ACTIVE" && (
                <button
                  type="button"
                  onClick={() => setPlanStatusAction(plan.id, locale, "ACTIVE")}
                  className="text-xs text-success hover:underline"
                >
                  {a.activate}
                </button>
              )}
              {plan.status === "ACTIVE" && (
                <button
                  type="button"
                  onClick={() => setPlanStatusAction(plan.id, locale, "HIDDEN")}
                  className="text-xs text-fg-muted hover:underline"
                >
                  {a.hide}
                </button>
              )}
              {plan.status !== "ARCHIVED" && (
                <button
                  type="button"
                  onClick={() => setPlanStatusAction(plan.id, locale, "ARCHIVED")}
                  className="text-xs text-danger hover:underline"
                >
                  {a.archive}
                </button>
              )}
            </div>
          </div>
          {editingId === plan.id && (
            <div className="mt-3">
              <PlanForm locale={locale} dict={dict} plan={plan} onDone={() => setEditingId(null)} />
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={() => setShowAdd((s) => !s)}
        className="h-10 w-fit rounded-full border border-dashed border-border px-4 text-sm text-fg-muted transition-colors hover:bg-surface-2"
      >
        {a.addPlan}
      </button>
      {showAdd && <PlanForm locale={locale} dict={dict} onDone={() => setShowAdd(false)} />}
    </div>
  );
}
