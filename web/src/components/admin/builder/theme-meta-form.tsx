"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  duplicateBuilderThemeAction,
  setBuilderThemeStatusAction,
  updateBuilderThemeMetaAction,
  type BuilderFormState,
} from "@/lib/admin/themes/builder-actions";
import { ThemeDeleteControl } from "@/components/admin/theme-status-actions";

const OCCASIONS = [
  { value: "WEDDING", label: "زواج" },
  { value: "ENGAGEMENT", label: "خطوبة" },
  { value: "BIRTHDAY", label: "عيد ميلاد" },
  { value: "BACHELORETTE", label: "توديع عزوبية" },
];

const CATEGORIES = [
  "classic",
  "luxury",
  "romantic",
  "botanical",
  "minimal",
  "modern",
  "soft",
  "dark",
  "saudi",
  "experimental",
];

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة",
  PUBLISHED: "منشور",
  HIDDEN: "مخفي",
  ARCHIVED: "مؤرشف",
};

const INPUT =
  "h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-accent";

export function ThemeMetaForm({
  themeId,
  locale,
  theme,
}: {
  themeId: string;
  locale: string;
  theme: {
    name: string;
    nameAr: string;
    category: string;
    occasion: string;
    visibility: string;
    descriptionAr: string | null;
    status: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, formAction, isSaving] = useActionState<BuilderFormState, FormData>(
    updateBuilderThemeMetaAction.bind(null, themeId, locale),
    null,
  );

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-medium text-fg">بيانات التصميم</h2>

      <form action={formAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-fg-muted">الاسم بالعربي</span>
          <input name="nameAr" defaultValue={theme.nameAr} required className={INPUT} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-fg-muted">الاسم بالإنجليزي</span>
          <input name="name" dir="ltr" defaultValue={theme.name} required className={INPUT} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">المناسبة</span>
            <select name="occasion" defaultValue={theme.occasion} className={INPUT}>
              {OCCASIONS.map((occasion) => (
                <option key={occasion.value} value={occasion.value}>
                  {occasion.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">التصنيف</span>
            <select name="category" defaultValue={theme.category} className={INPUT}>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-fg-muted">الظهور</span>
          <select name="visibility" defaultValue={theme.visibility} className={INPUT}>
            <option value="PUBLIC">عام — يظهر لكل العملاء</option>
            <option value="PRIVATE">خاص — لعملاء محددين فقط</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-fg-muted">وصف مختصر</span>
          <textarea
            name="descriptionAr"
            rows={2}
            defaultValue={theme.descriptionAr ?? ""}
            className="w-full rounded-lg border border-border bg-bg p-3 text-sm text-fg outline-none focus:border-accent"
          />
        </label>

        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        {state?.ok && <p className="text-sm text-success">تم الحفظ ✓</p>}

        <button
          type="submit"
          disabled={isSaving}
          className="h-10 rounded-full bg-accent px-5 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
        >
          حفظ البيانات
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="text-xs text-fg-muted">الحالة: {STATUS_LABELS[theme.status] ?? theme.status}</span>
        {(["DRAFT", "HIDDEN", "ARCHIVED"] as const)
          .filter((status) => status !== theme.status)
          .map((status) => (
            <button
              key={status}
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await setBuilderThemeStatusAction(themeId, locale, status);
                  router.refresh();
                })
              }
              className="rounded-full border border-border px-3 py-1 text-xs text-fg hover:border-accent disabled:opacity-50"
            >
              {STATUS_LABELS[status]}
            </button>
          ))}
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => duplicateBuilderThemeAction(themeId, locale))}
          className="ms-auto rounded-full border border-border px-3 py-1 text-xs text-fg hover:border-accent disabled:opacity-50"
        >
          نسخ التصميم كامل
        </button>
      </div>

      {/* Deleting takes the layout, the typography, every color and every
          uploaded image with it — the panel loads the live event count and
          asks for a replacement design before it lets that happen. */}
      <div className="mt-3 border-t border-border pt-3">
        <ThemeDeleteControl themeId={themeId} locale={locale} label="حذف التصميم" />
      </div>
    </section>
  );
}
