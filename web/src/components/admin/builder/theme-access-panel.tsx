"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  assignThemeToUserAction,
  unassignThemeFromUserAction,
  type BuilderFormState,
} from "@/lib/admin/themes/builder-actions";

/**
 * Who can see a PRIVATE theme. Public themes still list their grants — an admin
 * flipping visibility back to private should find the list intact rather than
 * discover it was silently discarded.
 */
export function ThemeAccessPanel({
  themeId,
  locale,
  visibility,
  assignments,
}: {
  themeId: string;
  locale: string;
  visibility: string;
  assignments: { userId: string; name: string; phone: string | null }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, formAction, isSaving] = useActionState<BuilderFormState, FormData>(
    assignThemeToUserAction.bind(null, themeId, locale),
    null,
  );

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-1 text-sm font-medium text-fg">العملاء المسموح لهم</h2>
      <p className="mb-3 text-xs text-fg-muted">
        {visibility === "PRIVATE"
          ? "التصميم خاص — يظهر فقط للعملاء في هذي القائمة."
          : "التصميم عام حاليًا ويظهر لكل العملاء. القائمة تنحفظ وتشتغل لو غيّرت الظهور إلى «خاص»."}
      </p>

      {assignments.length === 0 ? (
        <p className="text-xs text-fg-muted">ما فيه عملاء مضافين.</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-1">
          {assignments.map((assignment) => (
            <li
              key={assignment.userId}
              className="flex items-center justify-between gap-2 rounded-lg border border-border px-2 py-1.5"
            >
              <span className="text-xs text-fg">
                {assignment.name}
                {assignment.phone && (
                  <span className="ms-2 text-fg-muted" dir="ltr">
                    {assignment.phone}
                  </span>
                )}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await unassignThemeFromUserAction(themeId, assignment.userId, locale);
                    router.refresh();
                  })
                }
                className="text-xs text-danger hover:underline disabled:opacity-50"
              >
                إزالة
              </button>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="text-fg-muted">رقم جوال العميل</span>
          <input
            name="phone"
            dir="ltr"
            placeholder="+9665xxxxxxxx"
            required
            className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-accent"
          />
        </label>
        <button
          type="submit"
          disabled={isSaving}
          className="h-10 rounded-full bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
        >
          إضافة
        </button>
      </form>
      {state?.error && <p className="mt-2 text-sm text-danger">{state.error}</p>}
      {state?.ok && <p className="mt-2 text-sm text-success">تمت الإضافة ✓</p>}
    </section>
  );
}
