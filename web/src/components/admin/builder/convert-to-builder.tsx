"use client";

import { useActionState, useState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { convertLegacyThemeAction, revertToLegacyAction } from "@/lib/admin/themes/builder-actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

/**
 * The one-way door that isn't.
 *
 * An artwork theme's images and hotspots are hand-coded, so this button is the
 * only way an admin can ever move them. It writes a builder document from the
 * theme's own numbers and leaves `Theme.config` untouched — which is what lets
 * the second button undo the whole thing.
 *
 * Only rendered for themes that actually carry `config.card` artwork; the other
 * 48 legacy themes are fully covered by the form below it.
 */
export function ConvertToBuilder({
  themeId,
  locale,
  dict,
  converted,
  colorCount,
}: {
  themeId: string;
  locale: string;
  dict: Dictionary;
  /** The theme is already on the builder engine and can be reverted. */
  converted: boolean;
  /** Colours in this design's family, this theme included. */
  colorCount: number;
}) {
  const a = dict.admin;
  const [mergeFamily, setMergeFamily] = useState(true);
  const [restoreColors, setRestoreColors] = useState(true);

  const [convertState, convert] = useActionState(
    convertLegacyThemeAction.bind(null, themeId, locale),
    null,
  );
  const [revertState, revert] = useActionState(
    revertToLegacyAction.bind(null, themeId, locale),
    null,
  );

  if (converted) {
    return (
      <section className="rounded-2xl border border-accent/30 bg-surface p-4">
        <form action={revert} className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-fg">{a.convertedBadge}</p>
            <p className="mt-1 text-xs text-fg-muted">{a.revertToLegacyHint}</p>
            {colorCount > 1 && (
              <label className="mt-2 flex items-center gap-2 text-xs text-fg">
                <input
                  type="checkbox"
                  name="restoreColors"
                  checked={restoreColors}
                  onChange={(event) => setRestoreColors(event.target.checked)}
                  className="h-4 w-4 accent-[var(--color-accent)]"
                />
                <span>{a.revertRestoreColors.replace("{count}", String(colorCount - 1))}</span>
              </label>
            )}
          </div>
          <ConfirmSubmitButton
            confirmMessage={a.revertConfirm}
            className="h-9 rounded-full border border-border px-4 text-xs text-fg hover:bg-surface-2"
          >
            {a.revertToLegacy}
          </ConfirmSubmitButton>
        </form>
        {revertState?.error && <p className="mt-2 text-xs text-danger">{revertState.error}</p>}
      </section>
    );
  }

  const merging = mergeFamily && colorCount > 1;
  const confirmMessage = merging
    ? a.convertConfirmMerge.replace("{count}", String(colorCount))
    : a.convertConfirm;

  return (
    <section className="rounded-2xl border border-accent/30 bg-surface p-4">
      <form action={convert} className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-fg">{a.convertToBuilder}</p>
          <p className="mt-1 text-xs text-fg-muted">{a.convertToBuilderHint}</p>
          {colorCount > 1 && (
            <label className="mt-2 flex items-center gap-2 text-xs text-fg">
              <input
                type="checkbox"
                name="mergeFamily"
                checked={mergeFamily}
                onChange={(event) => setMergeFamily(event.target.checked)}
                className="h-4 w-4 accent-[var(--color-accent)]"
              />
              <span>{a.convertMergeColors.replace("{count}", String(colorCount))}</span>
            </label>
          )}
        </div>
        <ConfirmSubmitButton
          confirmMessage={confirmMessage}
          className="h-9 rounded-full bg-accent px-5 text-xs font-medium text-accent-fg hover:bg-accent-strong"
        >
          {a.convertToBuilder}
        </ConfirmSubmitButton>
      </form>
      {convertState?.error && <p className="mt-2 text-xs text-danger">{convertState.error}</p>}
    </section>
  );
}
