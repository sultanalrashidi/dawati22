"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import {
  createDiscountCodeAction,
  updateDiscountCodeAction,
  type DiscountCodeFormState,
} from "@/lib/admin/actions";

const FIELD =
  "h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent";

/**
 * One discount code: what it takes off, how many paid orders may use it, and
 * when. Creates a new code, or — given `editing` — changes an existing one,
 * whose code text then stays as customers were given it.
 */
export function DiscountCodeForm({
  locale,
  dict,
  editing,
  defaults,
}: {
  locale: string;
  dict: Dictionary;
  editing: { id: string; code: string } | null;
  /** Dates as Riyadh `datetime-local` values, empty for an open end. */
  defaults: {
    kind: "PERCENT" | "FIXED";
    value: number | null;
    maxUses: number | null;
    startsAt: string;
    endsAt: string;
  };
}) {
  const action = editing
    ? updateDiscountCodeAction.bind(null, editing.id, locale)
    : createDiscountCodeAction.bind(null, locale);
  const [state, formAction, isPending] = useActionState<DiscountCodeFormState, FormData>(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const a = dict.admin;

  // A new code saved clears the form for the next one; a refused one keeps
  // everything typed, which is why the form is not submitted through `action`.
  useEffect(() => {
    if (state?.saved && !editing) formRef.current?.reset();
  }, [state, editing]);

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="text-lg font-semibold text-fg">
        {editing ? (
          <>
            {a.discountEdit}{" "}
            <span dir="ltr" className="font-mono">
              {editing.code}
            </span>
          </>
        ) : (
          a.discountNew
        )}
      </h2>

      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(() => formAction(data));
        }}
        className="mt-4 flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {!editing && (
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-fg-muted">{a.discountCode}</span>
              <input
                name="code"
                required
                maxLength={20}
                dir="ltr"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="WATANI96"
                className={`${FIELD} w-full max-w-xs font-mono uppercase`}
              />
              <span className="text-xs text-fg-muted">{a.discountCodeHint}</span>
            </label>
          )}

          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="mb-1 text-fg-muted">{a.discountKind}</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="kind" value="PERCENT" defaultChecked={defaults.kind === "PERCENT"} />
              {a.discountPercent}
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="kind" value="FIXED" defaultChecked={defaults.kind === "FIXED"} />
              {a.discountFixed}
            </label>
          </fieldset>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">{a.discountValue}</span>
            <input
              name="value"
              type="number"
              step="0.01"
              min="1"
              required
              dir="ltr"
              defaultValue={defaults.value ?? ""}
              className={`${FIELD} w-32`}
            />
            <span className="text-xs text-fg-muted">{a.discountValueHint}</span>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">{a.discountMaxUses}</span>
            <input
              name="maxUses"
              type="number"
              step="1"
              min="1"
              dir="ltr"
              defaultValue={defaults.maxUses ?? ""}
              className={`${FIELD} w-32`}
            />
            <span className="text-xs text-fg-muted">{a.discountMaxUsesHint}</span>
          </label>

          <div />

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">{a.discountStartsAt}</span>
            <input
              name="startsAt"
              type="datetime-local"
              dir="ltr"
              defaultValue={defaults.startsAt}
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">{a.discountEndsAt}</span>
            <input
              name="endsAt"
              type="datetime-local"
              dir="ltr"
              defaultValue={defaults.endsAt}
              className={FIELD}
            />
          </label>
        </div>
        <p className="text-xs text-fg-muted">{a.discountTimeNote}</p>

        {state?.error && <p className="text-sm text-danger">{a.discountErrors[state.error]}</p>}
        {state?.saved && !isPending && <p className="text-sm text-success">{a.discountSaved}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="h-10 rounded-full bg-accent px-5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            {isPending ? dict.common.loading : editing ? a.discountSave : a.discountCreate}
          </button>
          {editing && (
            <Link href={`/${locale}/admin/discounts`} className="text-sm text-fg-muted hover:text-fg">
              {a.discountCancelEdit}
            </Link>
          )}
        </div>
      </form>
    </section>
  );
}
