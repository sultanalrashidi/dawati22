"use client";

import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { setThemeStatusAction, duplicateThemeAction, deleteThemeAction } from "@/lib/admin/themes/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

type ThemeStatusValue = "DRAFT" | "PUBLISHED" | "HIDDEN" | "ARCHIVED";

export function ThemeStatusActions({
  themeId,
  locale,
  dict,
  status,
  isUsed,
}: {
  themeId: string;
  locale: string;
  dict: Dictionary;
  status: ThemeStatusValue;
  isUsed: boolean;
}) {
  const a = dict.admin;
  const boundDuplicate = duplicateThemeAction.bind(null, themeId, locale);
  const boundDelete = deleteThemeAction.bind(null, themeId, locale);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "PUBLISHED" && (
        <button
          type="button"
          onClick={() => setThemeStatusAction(themeId, locale, "PUBLISHED")}
          className="h-9 rounded-full bg-accent px-4 text-xs font-medium text-accent-fg hover:bg-accent-strong"
        >
          {a.publish}
        </button>
      )}
      {status === "PUBLISHED" && (
        <button
          type="button"
          onClick={() => setThemeStatusAction(themeId, locale, "HIDDEN")}
          className="h-9 rounded-full border border-border px-4 text-xs text-fg hover:bg-surface-2"
        >
          {a.hide}
        </button>
      )}
      {status !== "ARCHIVED" && (
        <button
          type="button"
          onClick={() => setThemeStatusAction(themeId, locale, "ARCHIVED")}
          className="h-9 rounded-full border border-danger/30 px-4 text-xs text-danger hover:bg-danger/10"
        >
          {a.archive}
        </button>
      )}
      {status === "ARCHIVED" && (
        <button
          type="button"
          onClick={() => setThemeStatusAction(themeId, locale, "DRAFT")}
          className="h-9 rounded-full border border-border px-4 text-xs text-fg hover:bg-surface-2"
        >
          {a.restore}
        </button>
      )}
      <form action={boundDuplicate}>
        <button type="submit" className="h-9 rounded-full border border-border px-4 text-xs text-fg hover:bg-surface-2">
          {a.duplicate}
        </button>
      </form>
      {!isUsed && (
        <form action={boundDelete}>
          <ConfirmSubmitButton
            confirmMessage={a.confirmDelete}
            className="h-9 rounded-full border border-danger/30 px-4 text-xs text-danger hover:bg-danger/10"
          >
            {a.delete}
          </ConfirmSubmitButton>
        </form>
      )}
    </div>
  );
}
