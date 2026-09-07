"use client";

import { useActionState, useState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { grantExtraInvitationsAction, type GrantActionState } from "@/lib/admin/actions";
import { riyadhDateFormat } from "@/lib/dates";

export interface GrantHistoryRow {
  id: string;
  createdAt: Date;
  before: number;
  after: number;
  reason: string;
  actorName: string;
}

const ERROR_KEY: Record<string, keyof Dictionary["admin"]> = {
  invalid_count: "grantErrorInvalidCount",
  too_many: "grantErrorTooMany",
  reason_required: "grantErrorReasonRequired",
  not_activated: "grantErrorNotActivated",
  below_current_guests: "grantErrorBelowGuests",
  not_found: "grantErrorNotFound",
  stale: "grantErrorStale",
  generic: "grantErrorGeneric",
};

/**
 * Giving an event more invitations than were paid for.
 *
 * Three numbers are on the panel before any control, because the grant only
 * makes sense against them: what she PAID for, what has already been GRANTED,
 * and how many slots are IN USE right now. The last one is the floor — a
 * reduction below it is refused, and the panel says so before the server has
 * to.
 *
 * The field is the TOTAL grant, not an increment. An admin form that gets
 * double-submitted must not hand out twice, and "set it to 50" is also the
 * only phrasing that lets a mistake be taken back.
 *
 * The entry-pass warning is not decoration: on an event sold WITH_QR every
 * granted invitation is a working entry pass, and each one admits a party. The
 * owner should see what he is actually giving before he gives it.
 */
export function GrantInvitationsPanel({
  eventId,
  locale,
  dict,
  paid,
  granted,
  occupied,
  hasQr,
  maxExtra,
  history,
}: {
  eventId: string;
  locale: string;
  dict: Dictionary;
  paid: number;
  granted: number;
  occupied: number;
  hasQr: boolean;
  maxExtra: number;
  history: GrantHistoryRow[];
}) {
  const a = dict.admin;
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en-US");
  const [state, formAction, isPending] = useActionState<GrantActionState, FormData>(
    grantExtraInvitationsAction.bind(null, eventId, locale),
    null,
  );
  const [value, setValue] = useState(String(granted));

  const parsed = Number(value);
  const nextTotal = Number.isFinite(parsed) ? paid + Math.max(0, parsed) : paid;
  const belowFloor = Number.isFinite(parsed) && nextTotal < occupied;

  return (
    <section className="mt-4 rounded-xl border border-border bg-surface px-4 py-3">
      <h2 className="text-sm font-bold text-fg">{a.grantTitle}</h2>
      <p className="mt-1 text-sm leading-relaxed text-fg-muted">{a.grantIntro}</p>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4">
        <Figure label={a.grantPaid} value={nf.format(paid)} />
        <Figure label={a.grantGranted} value={nf.format(granted)} />
        <Figure label={a.grantTotal} value={nf.format(paid + granted)} strong />
        <Figure label={a.grantOccupied} value={nf.format(occupied)} />
      </dl>

      {hasQr && (
        <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning">
          {a.grantQrWarning}
        </p>
      )}

      <form action={formAction} className="mt-4 flex flex-col gap-3">
        {/* What this render was showing. The server refuses the write if the
            column has moved since — otherwise a tab left open at "0" would
            silently undo a grant someone else made in the meantime. */}
        <input type="hidden" name="expectedBefore" value={granted} />
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg-muted">{a.grantCountLabel}</span>
          <input
            name="extraInvitationCount"
            type="number"
            min={0}
            max={maxExtra}
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            dir="ltr"
            className="h-10 w-40 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg-muted">{a.grantReasonLabel}</span>
          <input
            name="reason"
            required
            minLength={3}
            placeholder={a.grantReasonPlaceholder}
            className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
          />
        </label>

        {belowFloor && (
          <p className="text-sm text-danger" role="alert">
            {a.grantErrorBelowGuests}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending || belowFloor}
          onClick={(e) => {
            if (!window.confirm(a.grantConfirm.replace("{count}", nf.format(Math.max(0, parsed || 0))))) {
              e.preventDefault();
            }
          }}
          className="h-10 w-fit rounded-full bg-accent px-5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong disabled:opacity-50"
        >
          {a.grantSubmit}
        </button>

        {state?.error && (
          <p className="text-sm text-danger" role="alert">
            {(a[ERROR_KEY[state.error] ?? "grantErrorGeneric"] as string).replace(
              "{max}",
              nf.format(maxExtra),
            )}
          </p>
        )}
        {state?.saved && (
          <p className="text-sm text-success" role="status">
            {a.grantSaved.replace("{total}", nf.format(state.saved.total))}
          </p>
        )}
      </form>

      <div className="mt-5 border-t border-border pt-3">
        <p className="text-xs font-bold text-fg-muted">{a.grantHistoryTitle}</p>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-fg-muted">{a.grantHistoryEmpty}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {history.map((row) => (
              <li key={row.id} className="text-xs text-fg-muted">
                <span className="text-fg">
                  {a.grantHistoryRow
                    .replace("{before}", nf.format(row.before))
                    .replace("{after}", nf.format(row.after))
                    .replace("{actor}", row.actorName)}
                </span>
                {" · "}
                {riyadhDateFormat(locale === "ar" ? "ar-SA-u-ca-gregory" : "en-US", {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                }).format(row.createdAt)}
                {row.reason && ` · ${row.reason}`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Figure({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className={strong ? "text-base font-bold text-fg" : "text-base text-fg"}>{value}</dd>
    </div>
  );
}
