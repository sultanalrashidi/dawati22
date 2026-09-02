"use client";

import { useState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { CLOSING_PRESETS, DEFAULT_CLOSING } from "@/lib/themes/builder/content";

const FIELD =
  "h-11 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent";

/**
 * The closing line (الخاتمة): a preset picker that fills an editable text
 * input. The INPUT is what posts (`closingAr`); the select has no name and is
 * only a shortcut for typing. It shows the matching preset while the text is
 * one of them and a blank "—" once the host has edited it into her own words.
 *
 * Starts on the first preset for a new event, and on the saved line when
 * editing — a saved null (an event from before the closing existed) shows the
 * default preset, because that is what the invitation actually prints.
 */
export function ClosingField({
  f,
  defaultValue,
}: {
  f: Dictionary["events"]["form"];
  defaultValue?: string | null;
}) {
  const [value, setValue] = useState<string>(() => defaultValue?.trim() || DEFAULT_CLOSING);
  const presets: readonly string[] = CLOSING_PRESETS;
  const preset = presets.includes(value) ? value : "";

  return (
    <div className="flex flex-col gap-2 text-sm">
      <span className="text-fg-muted">{f.closingLabel}</span>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-fg-muted">{f.closingPresetLabel}</span>
        <select
          value={preset}
          onChange={(e) => {
            if (e.target.value) setValue(e.target.value);
          }}
          className={FIELD}
        >
          <option value="">—</option>
          {CLOSING_PRESETS.map((line) => (
            <option key={line} value={line}>
              {line}
            </option>
          ))}
        </select>
      </label>
      <input
        name="closingAr"
        aria-label={f.closingLabel}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={FIELD}
      />
      <span className="text-xs text-fg-muted">{f.closingHint}</span>
    </div>
  );
}
