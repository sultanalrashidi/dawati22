"use client";

import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { ThemeConfig } from "@/lib/themes/types";
import { ThemePreviewDialog } from "@/components/themes/theme-preview-dialog";

export function ThemeGalleryCard({
  name,
  category,
  config,
  dict,
}: {
  name: string;
  category: string;
  config: ThemeConfig;
  dict: Dictionary;
}) {
  return (
    <div
      className="flex flex-col items-center gap-4 rounded-2xl p-8 text-center shadow-sm"
      style={{ background: config.palette.bg, color: config.palette.fg }}
    >
      <p className="text-xs uppercase tracking-[0.3em]" style={{ color: config.palette.accent }}>
        {dict.guest.guestOf}
      </p>
      <p className="text-lg">{name}</p>
      <p className="text-sm" style={{ color: config.palette.fgMuted }}>
        Sultan &amp; Noura
      </p>
      <span
        className="rounded-full border px-4 py-1.5 text-xs"
        style={{ borderColor: config.palette.accent, color: config.palette.accent }}
      >
        {category}
      </span>
      <ThemePreviewDialog
        theme={config}
        dict={dict}
        trigger={
          <button
            type="button"
            className="h-9 rounded-full border px-5 text-xs font-medium transition-colors"
            style={{ borderColor: config.palette.accent, color: config.palette.accent }}
          >
            {dict.admin.preview}
          </button>
        }
      />
    </div>
  );
}
