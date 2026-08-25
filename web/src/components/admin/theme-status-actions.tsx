"use client";

import { useActionState, useState, useTransition } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import {
  setThemeStatusAction,
  duplicateThemeAction,
  deleteThemeAction,
  loadThemeDeletePromptAction,
  type ThemeDeletePrompt,
  type ThemeDeleteState,
} from "@/lib/admin/themes/actions";

type ThemeStatusValue = "DRAFT" | "PUBLISHED" | "HIDDEN" | "ARCHIVED";

const DANGER_BUTTON =
  "h-9 rounded-full border border-danger/30 px-4 text-xs text-danger hover:bg-danger/10 disabled:opacity-50";

const PANEL_SELECT =
  "h-9 w-full rounded-lg border border-border bg-bg px-3 text-xs text-fg outline-none focus:border-accent";

/**
 * Delete a theme, in use or not.
 *
 * The counts, the list of published replacements and every line of copy are
 * fetched from the server the moment the admin opens the panel, not passed in
 * as props: this control is mounted on the themes list (once per card, where
 * pre-loading every published theme per card would be absurd), on the legacy
 * theme page and inside the builder's meta form, which has no dictionary in
 * scope. One round trip on click is cheaper than all three plumbing routes.
 */
export function ThemeDeleteControl({
  themeId,
  locale,
  label,
  className,
}: {
  themeId: string;
  locale: string;
  /** Trigger copy — the only string the caller owns, everything else is loaded. */
  label: string;
  className?: string;
}) {
  const [prompt, setPrompt] = useState<ThemeDeletePrompt | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [state, formAction, deleting] = useActionState<ThemeDeleteState, FormData>(
    deleteThemeAction.bind(null, themeId, locale),
    null,
  );

  if (!prompt) {
    return (
      <div className={className}>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setLoadError(null);
            startLoading(async () => {
              const result = await loadThemeDeletePromptAction(themeId, locale);
              if (result.ok) setPrompt(result.prompt);
              else setLoadError(result.error);
            });
          }}
          className={DANGER_BUTTON}
        >
          {label}
        </button>
        {loadError && <p className="mt-1 text-xs text-danger">{loadError}</p>}
      </div>
    );
  }

  const { copy } = prompt;
  // Used by events with nothing published to move them onto: deleting would
  // orphan live invitations, so the confirm stays disabled and the copy points
  // at archiving instead.
  const blocked = Boolean(copy.noReplacement);

  return (
    <form action={formAction} className={`flex flex-col gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3 ${className ?? ""}`}>
      <p className="text-sm font-medium text-fg">{copy.title}</p>
      <p className="text-xs text-fg-muted">{copy.message}</p>
      {copy.unlinks && <p className="text-xs text-fg-muted">{copy.unlinks}</p>}

      {prompt.requiresReplacement && !blocked && (
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-fg-muted">{copy.replacementLabel}</span>
          <select name="reassignToThemeId" required defaultValue="" className={PANEL_SELECT}>
            <option value="" disabled>
              {copy.replacementPlaceholder}
            </option>
            {prompt.replacements.map((replacement) => (
              <option key={replacement.id} value={replacement.id}>
                {replacement.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {copy.noReplacement && <p className="text-xs text-danger">{copy.noReplacement}</p>}
      {copy.seededNote && <p className="text-xs text-warning">{copy.seededNote}</p>}
      <p className="text-xs text-fg-muted">{copy.archiveHint}</p>
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={deleting || blocked}
          className="h-9 rounded-full border border-danger bg-danger/10 px-4 text-xs font-medium text-danger hover:bg-danger/20 disabled:opacity-50"
        >
          {copy.confirm}
        </button>
        <button
          type="button"
          disabled={deleting}
          onClick={() => setPrompt(null)}
          className="h-9 rounded-full border border-border px-4 text-xs text-fg hover:bg-surface-2 disabled:opacity-50"
        >
          {copy.cancel}
        </button>
      </div>
    </form>
  );
}

export function ThemeStatusActions({
  themeId,
  locale,
  dict,
  status,
}: {
  themeId: string;
  locale: string;
  dict: Dictionary;
  status: ThemeStatusValue;
  /**
   * Still accepted so the theme page keeps compiling: delete is no longer
   * gated on it, the control loads the live usage count itself.
   */
  isUsed?: boolean;
}) {
  const a = dict.admin;
  const boundDuplicate = duplicateThemeAction.bind(null, themeId, locale);

  return (
    <div className="flex flex-wrap items-start gap-2">
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
      <ThemeDeleteControl themeId={themeId} locale={locale} label={a.delete} className="basis-full sm:basis-auto" />
    </div>
  );
}
