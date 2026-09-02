"use client";

import { useState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { DEFAULT_HOST_MODE, type HostModeKind } from "@/lib/themes/builder/content";

const FIELD =
  "h-11 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent";
const AREA = "rounded-lg border border-border bg-bg px-3 py-2 text-fg outline-none focus:border-accent";

/** What the host block starts out holding when the form is an edit. */
export interface HostValues {
  hostMode: HostModeKind;
  groomMotherAr: string;
  brideMotherAr: string;
  hostLineAr: string;
}

/**
 * The host (الداعي) block. The host of a women's-section invitation is always
 * the two mothers, so the default mode asks only for their kunyas and the
 * server composes "تتشرف والدة العريس … ووالدة العروس …" from them; the free
 * mode is for a family that wants the line worded its own way.
 *
 * Both modes' inputs stay mounted and post together — a mother's name typed
 * before switching to free text is still there on switching back — and only
 * the visible mode's inputs carry `required` and `minLength`: a hidden
 * field that fails validation would block the whole form from submitting
 * with nothing on screen to explain why (the browser cannot focus it). The server keeps the chosen
 * mode's fields and nulls the other's (`readHost` in lib/events/form.ts).
 */
export function HostFields({
  f,
  defaults,
}: {
  f: Dictionary["events"]["form"];
  defaults?: HostValues;
}) {
  const [mode, setMode] = useState<HostModeKind>(defaults?.hostMode ?? DEFAULT_HOST_MODE);
  const template = mode === "TEMPLATE";

  return (
    <fieldset className="flex flex-col gap-4 rounded-xl border border-border p-4">
      <legend className="px-1 text-xs text-fg-muted">{f.hostHeading}</legend>

      <div className="flex flex-col gap-2 text-sm">
        <span className="text-fg-muted">{f.hostModeLabel}</span>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="hostMode"
            value="TEMPLATE"
            checked={template}
            onChange={() => setMode("TEMPLATE")}
          />
          {f.hostModeTemplate}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="hostMode"
            value="FREE"
            checked={!template}
            onChange={() => setMode("FREE")}
          />
          {f.hostModeFree}
        </label>
      </div>

      <div className={template ? "flex flex-col gap-2 text-sm" : "hidden"}>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-fg-muted">{f.groomMotherLabel}</span>
            <input
              name="groomMotherAr"
              required={template}
              minLength={template ? 2 : undefined}
              placeholder={f.groomMotherPlaceholder}
              defaultValue={defaults?.groomMotherAr ?? ""}
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-fg-muted">{f.brideMotherLabel}</span>
            <input
              name="brideMotherAr"
              required={template}
              minLength={template ? 2 : undefined}
              placeholder={f.brideMotherPlaceholder}
              defaultValue={defaults?.brideMotherAr ?? ""}
              className={FIELD}
            />
          </label>
        </div>
        <span className="text-xs text-fg-muted">{f.hostTemplateHint}</span>
      </div>

      <label className={template ? "hidden" : "flex flex-col gap-1.5 text-sm"}>
        <span className="text-fg-muted">{f.hostLineLabel}</span>
        <textarea
          name="hostLineAr"
          required={!template}
          minLength={template ? undefined : 5}
          rows={2}
          placeholder={f.hostLinePlaceholder}
          defaultValue={defaults?.hostLineAr ?? ""}
          className={AREA}
        />
        <span className="text-xs text-fg-muted">{f.hostLineHint}</span>
      </label>
    </fieldset>
  );
}
