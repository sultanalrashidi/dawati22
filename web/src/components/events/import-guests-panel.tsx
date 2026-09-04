"use client";

import { useActionState, useMemo, useState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import {
  importGuestsAction,
  undoImportAction,
  type ImportActionState,
} from "@/lib/guests/actions";
import {
  parseGuestList,
  isCommittable,
  type ParsedRow,
  type RowStatus,
} from "@/lib/guests/import-parse";

/**
 * Pasting a guest list.
 *
 * Paste, not upload. A Saudi bride's list arrives as a WhatsApp message, a
 * note on her phone or a column out of Excel — and all three paste. A file
 * picker would be the one shape none of them has, and would put a parser
 * dependency in the way of the ordinary case.
 *
 * Nothing is written until she has looked at it. The review table is the same
 * `parseGuestList` the server runs, over the same text, so what she checks is
 * what gets saved — the table is a preview of the server's reading, not a
 * separate one.
 */

const STATUS_TONE: Record<RowStatus, string> = {
  ok: "text-fg-muted",
  noName: "text-danger",
  nameShort: "text-danger",
  unreadableField: "text-danger",
  badPhone: "text-warning",
  dupInList: "text-warning",
  dupExisting: "text-warning",
};

/**
 * A batch id that works on a phone over plain HTTP too.
 *
 * `crypto.randomUUID` is only defined in a secure context, and this app is
 * deliberately reachable from a phone on the LAN over http:// during
 * development, where it is simply absent.
 */
function makeBatchId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = c?.getRandomValues?.(new Uint8Array(16));
  if (bytes) return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function ImportGuestsPanel({
  eventId,
  locale,
  dict,
  seatsRemaining,
  existingNames,
  existingPhones,
}: {
  eventId: string;
  locale: string;
  dict: Dictionary;
  seatsRemaining: number;
  existingNames: string[];
  existingPhones: string[];
}) {
  const d = dict.events.detail;
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en-US");

  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [undoState, setUndoState] = useState<ImportActionState>(null);

  /**
   * Minted once, and deliberately KEPT across "back to the text".
   *
   * The failure it guards is: the import succeeds, the phone loses the
   * response, she goes back and confirms again. A fresh id at that moment
   * would add three hundred guests a second time; the same id finds its own
   * batch already there and says so. It is replaced only when she closes the
   * panel on a finished import, which is where one list ends and the next
   * begins.
   */
  const [batchId, setBatchId] = useState(makeBatchId);

  const [state, formAction, isPending] = useActionState<ImportActionState, FormData>(
    importGuestsAction.bind(null, eventId, locale),
    null,
  );

  const existing = useMemo(
    () => ({ names: new Set(existingNames), phones: new Set(existingPhones) }),
    [existingNames, existingPhones],
  );
  const rows: ParsedRow[] = useMemo(
    () => (reviewing ? parseGuestList(text, existing) : []),
    [reviewing, text, existing],
  );
  const committable = rows.filter(isCommittable);
  const blocked = rows.length - committable.length;
  const overBy = committable.length - seatsRemaining;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 text-sm font-bold text-accent hover:underline"
      >
        {d.importOpen}
      </button>
    );
  }

  return (
    <section className="mt-4 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-fg">{d.importTitle}</h2>
          <p className="mt-1 text-sm leading-relaxed text-fg-muted">{d.importHint}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            // Closing a finished import ends it: the next paste is its own
            // list and must not inherit this one's identity.
            if (state?.created) {
              setBatchId(makeBatchId());
              setText("");
              setReviewing(false);
              setUndoState(null);
            }
          }}
          aria-label={dict.common.close}
          className="-m-1 shrink-0 p-1 text-fg-muted"
        >
          ✕
        </button>
      </div>

      {state?.created && state.created > 0 ? (
        <div className="mt-4 rounded-xl bg-success/10 px-4 py-3">
          <p className="text-sm text-success">
            {d.importDone.replace("{count}", nf.format(state.created))}
          </p>
          {/* The undo, offered where the confirmation is — not buried on a
              settings screen she would have to go looking for. */}
          {state.batchId && !undoState && (
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm(d.importUndoConfirm)) return;
                setUndoState(await undoImportAction(eventId, locale, state.batchId!));
              }}
              className="mt-2 text-xs font-bold text-danger hover:underline"
            >
              {d.importUndo}
            </button>
          )}
          {undoState && (
            <p className="mt-2 text-xs text-fg-muted">
              {(undoState.kept ?? 0) > 0
                ? d.importUndoPartial
                    .replace("{count}", nf.format(undoState.deleted ?? 0))
                    .replace("{kept}", nf.format(undoState.kept ?? 0))
                : d.importUndoDone.replace("{count}", nf.format(undoState.deleted ?? 0))}
            </p>
          )}
        </div>
      ) : (
        <form action={formAction} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="batchId" value={batchId} />

          {!reviewing ? (
            <>
              <textarea
                name="guestList"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                dir="rtl"
                placeholder={d.importPlaceholder}
                className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent"
              />
              <button
                type="button"
                disabled={text.trim().length === 0}
                onClick={() => setReviewing(true)}
                className="h-11 rounded-full bg-accent text-sm font-bold text-accent-fg transition-colors hover:bg-accent-strong disabled:opacity-50"
              >
                {d.importReview}
              </button>
            </>
          ) : (
            <>
              {/* Kept in the form so the SERVER parses the text she reviewed,
                  never the rows this table happens to be showing. */}
              <input type="hidden" name="guestList" value={text} />

              <div className="max-h-80 overflow-y-auto rounded-xl border border-border">
                {rows.map((row) => (
                  <div
                    key={row.line}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border px-3 py-2 last:border-b-0"
                  >
                    <span className="text-sm text-fg">{row.nameAr || `— ${row.raw.trim()}`}</span>
                    <span dir="ltr" className="text-xs text-fg-muted">
                      {row.phone ?? "—"}
                    </span>
                    <span className="text-xs tabular-nums text-fg-muted">
                      {nf.format(row.allowedCount)}
                    </span>
                    <span className={`w-full text-xs ${STATUS_TONE[row.status]}`}>
                      {row.status === "ok" ? "" : d.importRowStatus[row.status]}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-fg-muted">
                {d.importSummary
                  .replace("{count}", nf.format(committable.length))
                  .replace("{blocked}", nf.format(blocked))}
              </p>

              {overBy > 0 && (
                <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
                  {d.importOverCapacity
                    .replace("{over}", nf.format(overBy))
                    .replace("{remaining}", nf.format(seatsRemaining))}
                </p>
              )}
              {state?.capacityShortBy ? (
                <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
                  {d.importOverCapacity
                    .replace("{over}", nf.format(state.capacityShortBy))
                    .replace("{remaining}", nf.format(seatsRemaining))}
                </p>
              ) : null}
              {state?.alreadyApplied && (
                <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-fg-muted">
                  {d.importAlreadyDone}
                </p>
              )}
              {state?.error && (
                <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
                  {d.importFailed}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={isPending || committable.length === 0 || overBy > 0}
                  className="h-11 flex-1 rounded-full bg-accent px-5 text-sm font-bold text-accent-fg transition-colors hover:bg-accent-strong disabled:opacity-50"
                >
                  {isPending
                    ? dict.common.loading
                    : d.importConfirm.replace("{count}", nf.format(committable.length))}
                </button>
                <button
                  type="button"
                  onClick={() => setReviewing(false)}
                  className="h-11 rounded-full border border-border px-5 text-sm font-medium text-fg"
                >
                  {d.importBack}
                </button>
              </div>
            </>
          )}
        </form>
      )}
    </section>
  );
}
