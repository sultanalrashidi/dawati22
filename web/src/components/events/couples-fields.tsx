"use client";

import { useState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

/**
 * Mirrors MAX_COUPLES_PER_EVENT in lib/events/service.ts — kept as a literal
 * because that module is "server-only" and importing it here would pull the
 * Prisma client into the browser bundle. The server re-checks the cap anyway.
 */
const MAX_COUPLES = 6;

const FIELD =
  "h-11 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent";

/** What one bride+groom block starts out holding when the form is an edit. */
export interface CoupleValues {
  groomNameEn: string;
  brideNameEn: string;
  groomNameAr: string | null;
  groomFamilyAr: string | null;
  brideNameAr: string | null;
  brideFamilyAr: string | null;
}

interface Row {
  key: number;
  values: CoupleValues | null;
}

/**
 * The repeatable bride+groom block — bride first, because she is the star of
 * a women's-section invitation and the card prints her name first. Every pair
 * posts under the same six `couple*` names, so the server reads them with
 * `formData.getAll(...)` and the Nth value of each array is the Nth couple —
 * which is why the inputs stay uncontrolled and are keyed by a stable id:
 * removing the middle pair must drop that pair's values, not shift everyone
 * else's.
 *
 * The Arabic given names are required (they are what prints); the English
 * names are optional and only feed the Latin monogram and the link preview.
 */
export function CouplesFields({
  f,
  defaultCouples = [],
}: {
  f: Dictionary["events"]["form"];
  defaultCouples?: CoupleValues[];
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    defaultCouples.length > 0
      ? defaultCouples.map((values, index) => ({ key: index, values }))
      : [{ key: 0, values: null }],
  );

  function addRow() {
    setRows((current) =>
      current.length >= MAX_COUPLES
        ? current
        : [...current, { key: (current[current.length - 1]?.key ?? 0) + 1, values: null }],
    );
  }

  function removeRow(key: number) {
    setRows((current) => (current.length <= 1 ? current : current.filter((row) => row.key !== key)));
  }

  const atMax = rows.length >= MAX_COUPLES;

  return (
    <div className="flex flex-col gap-4">
      {rows.map((row, index) => (
        <fieldset key={row.key} className="flex flex-col gap-4 rounded-xl border border-border p-4">
          <legend className="px-1 text-xs text-fg-muted">
            {rows.length > 1 ? `${f.coupleHeading} ${index + 1}` : f.coupleHeading}
          </legend>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-fg">{f.brideHeading}</span>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-fg-muted">{f.brideNameArLabel}</span>
                <input
                  name="coupleBrideNameAr"
                  required
                  minLength={2}
                  defaultValue={row.values?.brideNameAr ?? ""}
                  className={FIELD}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-fg-muted">{f.brideFamilyArLabel}</span>
                <input
                  name="coupleBrideFamilyAr"
                  defaultValue={row.values?.brideFamilyAr ?? ""}
                  className={FIELD}
                />
              </label>
              <label className="col-span-2 flex flex-col gap-1.5 text-sm">
                <span className="text-fg-muted">{f.brideNameLabel}</span>
                <input
                  name="coupleBrideNameEn"
                  dir="ltr"
                  defaultValue={row.values?.brideNameEn ?? ""}
                  className={FIELD}
                />
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-fg">{f.groomHeading}</span>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-fg-muted">{f.groomNameArLabel}</span>
                <input
                  name="coupleGroomNameAr"
                  required
                  minLength={2}
                  defaultValue={row.values?.groomNameAr ?? ""}
                  className={FIELD}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-fg-muted">{f.groomFamilyArLabel}</span>
                <input
                  name="coupleGroomFamilyAr"
                  defaultValue={row.values?.groomFamilyAr ?? ""}
                  className={FIELD}
                />
              </label>
              <label className="col-span-2 flex flex-col gap-1.5 text-sm">
                <span className="text-fg-muted">{f.groomNameLabel}</span>
                <input
                  name="coupleGroomNameEn"
                  dir="ltr"
                  defaultValue={row.values?.groomNameEn ?? ""}
                  className={FIELD}
                />
              </label>
            </div>
          </div>

          {index > 0 && (
            <button
              type="button"
              onClick={() => removeRow(row.key)}
              className="h-9 self-start rounded-full border border-danger/30 px-3 text-xs font-medium text-danger transition-colors hover:bg-danger/10"
            >
              {f.coupleRemove}
            </button>
          )}
        </fieldset>
      ))}

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={addRow}
          disabled={atMax}
          className="h-10 self-start rounded-full border border-border px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2 disabled:opacity-50"
        >
          {f.coupleAdd}
        </button>
        <span className="text-xs text-fg-muted">{atMax ? f.coupleMaxHint : f.coupleHint}</span>
      </div>
    </div>
  );
}
