"use client";

import { useActionState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import type { DesignRequestStatus } from "@/generated/prisma/enums";
import {
  cancelDesignRequestAction,
  markDesignReadyAction,
  startDesignWorkAction,
  type DesignRequestState,
} from "@/lib/design-requests/actions";

export interface AdminDesignRequestView {
  id: string;
  reference: string;
  status: DesignRequestStatus;
  createdAt: string;
  customerName: string;
  customerPhone: string | null;
  eventId: string;
  eventName: string;
  colorLabels: string[];
  styleLabel: string | null;
  inspirationName: string | null;
  notes: string | null;
  revisionCount: number;
  revisionNote: string | null;
  adminNote: string | null;
  deliveredThemeId: string | null;
  deliveredThemeName: string | null;
  priceSar: number;
}

/**
 * One request in the team's queue, with the three moves that exist: start it,
 * hand it over, drop it.
 *
 * Handing it over takes a theme id rather than a picker because the design is
 * built in the Theme Builder, which is where its id is already on screen —
 * a second copy of the theme list here would only be a way to pick the wrong
 * one.
 */
export function DesignRequestRow({
  locale,
  dict,
  request,
}: {
  locale: Locale;
  dict: Dictionary;
  request: AdminDesignRequestView;
}) {
  const d = dict.designRequest;
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en-US");

  const boundStart = startDesignWorkAction.bind(null, request.id, locale);
  const boundReady = markDesignReadyAction.bind(null, request.id, locale);
  const boundCancel = cancelDesignRequestAction.bind(null, request.id, locale);
  const [, submitStart, startPending] = useActionState<DesignRequestState, FormData>(boundStart, null);
  const [readyState, submitReady, readyPending] = useActionState<DesignRequestState, FormData>(
    boundReady,
    null,
  );
  const [, submitCancel, cancelPending] = useActionState<DesignRequestState, FormData>(boundCancel, null);

  const closed = request.status === "PAID" || request.status === "CANCELLED";

  return (
    <li className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span dir="ltr" className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-bold text-fg">
          {request.reference}
        </span>
        <span className="text-xs font-bold text-accent">
          {d[`status${request.status}` as keyof typeof d] as string}
        </span>
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <Field label={d.adminCustomer}>
          {request.customerName}
          {request.customerPhone && (
            <span dir="ltr" className="ms-2 text-xs text-fg-muted">
              {request.customerPhone}
            </span>
          )}
        </Field>
        <Field label={d.adminEvent}>
          <a
            href={`/${locale}/admin/events/${request.eventId}`}
            className="text-accent underline-offset-4 hover:underline"
          >
            {request.eventName}
          </a>
        </Field>
        {request.colorLabels.length > 0 && (
          <Field label={d.adminColors}>{request.colorLabels.join("، ")}</Field>
        )}
        {request.styleLabel && <Field label={d.adminStyle}>{request.styleLabel}</Field>}
        {request.inspirationName && (
          <Field label={d.adminInspiration}>{request.inspirationName}</Field>
        )}
        <Field label={d.priceLabel}>
          {nf.format(request.priceSar)} {dict.common.sar}
        </Field>
      </dl>

      {request.notes && (
        <div className="mt-3 rounded-xl bg-surface-2 px-4 py-3">
          <p className="text-xs font-medium text-fg-muted">{d.adminBrief}</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-fg">{request.notes}</p>
        </div>
      )}

      {request.revisionNote && (
        <div className="mt-3 rounded-xl border border-warning/40 bg-warning/5 px-4 py-3">
          <p className="text-xs font-medium text-fg-muted">
            {d.adminRevisionNote} ({nf.format(request.revisionCount)})
          </p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-fg">
            {request.revisionNote}
          </p>
        </div>
      )}

      {request.deliveredThemeId && (
        <p className="mt-3 text-xs text-fg-muted">
          {d.adminDelivered}:{" "}
          <a
            href={`/theme-preview/${request.deliveredThemeId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline-offset-4 hover:underline"
          >
            {request.deliveredThemeName ?? request.deliveredThemeId}
          </a>
        </p>
      )}

      {request.adminNote && <p className="mt-2 text-xs text-fg-muted">{request.adminNote}</p>}

      {!closed && (
        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
          {request.status === "NEW" && (
            <form action={submitStart}>
              <input type="hidden" name="adminNote" value="" />
              <button
                type="submit"
                disabled={startPending}
                className="h-10 rounded-full border border-accent px-5 text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-accent-fg disabled:opacity-50"
              >
                {d.adminStart}
              </button>
            </form>
          )}

          <form action={submitReady} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex flex-1 flex-col gap-1.5 text-sm">
              <span className="text-xs text-fg-muted">{d.adminThemeIdLabel}</span>
              <input
                name="themeId"
                required
                dir="ltr"
                defaultValue={request.deliveredThemeId ?? ""}
                className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-accent"
              />
            </label>
            <button
              type="submit"
              disabled={readyPending}
              className="h-10 shrink-0 rounded-full bg-accent px-5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong disabled:opacity-50"
            >
              {d.adminReady}
            </button>
          </form>
          {readyState?.error && <p className="text-xs text-danger">{dict.common.error}</p>}

          <form action={submitCancel}>
            <input type="hidden" name="adminNote" value="" />
            <button
              type="submit"
              disabled={cancelPending}
              className="text-xs text-danger underline-offset-4 hover:underline disabled:opacity-50"
            >
              {d.adminCancel}
            </button>
          </form>
        </div>
      )}
    </li>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="mt-0.5 text-fg">{children}</dd>
    </div>
  );
}
