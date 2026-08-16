"use client";

import { useActionState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { uploadThemeAssetAction, removeThemeAssetAction, type AssetUploadState } from "@/lib/admin/themes/actions";
import { THEME_ASSET_KINDS } from "@/lib/themes/types";

interface Asset {
  id: string;
  kind: string;
  url: string;
}

export function ThemeAssetManager({
  themeId,
  locale,
  dict,
  assets,
}: {
  themeId: string;
  locale: string;
  dict: Dictionary;
  assets: Asset[];
}) {
  const [state, formAction, isPending] = useActionState<AssetUploadState, FormData>(
    uploadThemeAssetAction.bind(null, themeId, locale),
    null
  );
  const a = dict.admin;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        {assets.map((asset) => {
          const boundRemove = removeThemeAssetAction.bind(null, asset.id, themeId, locale);
          return (
            <div key={asset.id} className="flex flex-col items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.url} alt={asset.kind} className="h-20 w-20 rounded-lg object-cover" />
              <span className="text-xs text-fg-muted">{asset.kind}</span>
              <form action={boundRemove}>
                <button type="submit" className="text-xs text-danger hover:underline">
                  {dict.admin.delete}
                </button>
              </form>
            </div>
          );
        })}
      </div>

      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-fg-muted">{a.assetKind}</span>
          <select name="kind" className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent">
            {THEME_ASSET_KINDS.map((kind) => (
              <option key={kind} value={kind}>{kind}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-fg-muted">{a.uploadAsset}</span>
          <input type="file" name="file" accept="image/png,image/jpeg,image/webp" required className="text-sm text-fg" />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="h-10 rounded-full bg-accent px-5 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
        >
          {a.uploadAsset}
        </button>
      </form>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
    </div>
  );
}
