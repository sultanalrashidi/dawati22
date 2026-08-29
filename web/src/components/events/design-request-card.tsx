"use client";

import { useActionState, useState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import type { DesignRequestStatus } from "@/generated/prisma/enums";
import { supportWhatsAppUrl } from "@/lib/support";
import {
  CUSTOM_DESIGN_PRICE_SAR,
  CUSTOM_DESIGN_REVISIONS_INCLUDED,
} from "@/lib/design-requests/pricing";
import {
  approveDesignAction,
  requestDesignChangesAction,
  type DesignRequestState,
} from "@/lib/design-requests/actions";

export interface DesignRequestView {
  id: string;
  reference: string;
  status: DesignRequestStatus;
  priceSar: number;
  revisionCount: number;
  deliveredThemeId: string | null;
}

/**
 * Where a custom design lives once it has been asked for.
 *
 * This card is what makes "pay after you like it" possible at all: without a
 * place to come back to, approve and pay, the promise has nowhere to land. It
 * is deliberately the only screen that moves the request forward on the
 * customer's side.
 */
export function DesignRequestCard({
  locale,
  dict,
  eventId,
  request,
}: {
  locale: Locale;
  dict: Dictionary;
  eventId: string;
  request: DesignRequestView;
}) {
  const d = dict.designRequest;
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en-US");
  const [changesOpen, setChangesOpen] = useState(false);

  const boundChanges = requestDesignChangesAction.bind(null, request.id, eventId, locale);
  const [changesState, submitChanges, changesPending] = useActionState<DesignRequestState, FormData>(
    boundChanges,
    null,
  );
  const boundApprove = approveDesignAction.bind(null, request.id, locale);

  const title = d[`status${request.status}` as keyof typeof d] as string;
  const body = d[`status${request.status}Body` as keyof typeof d] as string;

  const revisionsLeft = CUSTOM_DESIGN_REVISIONS_INCLUDED - request.revisionCount;
  const canPreview = Boolean(request.deliveredThemeId);
  const isReady = request.status === "READY";
  const isWaitingOnUs =
    request.status === "NEW" ||
    request.status === "IN_PROGRESS" ||
    request.status === "CHANGES_REQUESTED";
  const isAwaitingPayment = request.status === "APPROVED";

  return (
    <section className="rounded-2xl border border-accent-soft/60 bg-accent-soft/10 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold text-fg">{d.eventCardTitle}</h2>
        <span dir="ltr" className="rounded-full bg-bg px-2.5 py-0.5 text-[11px] font-bold text-fg-muted">
          {request.reference}
        </span>
      </div>

      <p className="mt-3 text-sm font-bold text-accent">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-fg-muted">{body}</p>
      {/* Only while the ball is in our court. Repeating the turnaround next to
          "your design is live" would read as a promise about something that has
          already happened. */}
      {isWaitingOnUs && <p className="mt-2 text-xs font-medium text-fg">{d.slaNote}</p>}

      <div className="mt-4 flex items-baseline justify-between border-t border-accent-soft/50 pt-3 text-xs">
        <span className="text-fg-muted">{d.priceLabel}</span>
        <span className="font-bold text-fg">
          {nf.format(request.priceSar)} {dict.common.sar}
        </span>
      </div>

      {canPreview && (
        <a
          href={`/theme-preview/${request.deliveredThemeId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex h-11 items-center justify-center rounded-full border border-accent text-sm font-bold text-accent transition-colors hover:bg-accent hover:text-accent-fg"
        >
          {d.previewCta}
        </a>
      )}

      {(isReady || isAwaitingPayment) && (
        <form action={boundApprove} className="mt-3">
          <button
            type="submit"
            className="h-11 w-full rounded-full bg-accent text-sm font-bold text-accent-fg transition-colors hover:bg-accent-strong"
          >
            {d.approveCta}
          </button>
        </form>
      )}

      {isReady && (
        <div className="mt-3">
          {revisionsLeft > 0 ? (
            <>
              <button
                type="button"
                onClick={() => setChangesOpen((v) => !v)}
                aria-expanded={changesOpen}
                className="h-9 w-full rounded-full border border-border text-xs font-medium text-fg-muted transition-colors hover:border-accent hover:text-accent"
              >
                {d.changesCta}
              </button>

              {changesOpen && (
                <form action={submitChanges} className="mt-3 flex flex-col gap-2">
                  <label className="text-xs text-fg-muted" htmlFor="revisionNote">
                    {d.changesLabel}
                  </label>
                  <textarea
                    id="revisionNote"
                    name="revisionNote"
                    rows={3}
                    required
                    minLength={3}
                    className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-accent"
                  />
                  {changesState?.error && (
                    <p className="text-xs text-danger">{dict.common.error}</p>
                  )}
                  <button
                    type="submit"
                    disabled={changesPending}
                    className="h-9 rounded-full border border-accent text-xs font-bold text-accent transition-colors hover:bg-accent hover:text-accent-fg disabled:opacity-50"
                  >
                    {changesPending ? dict.common.loading : d.changesSubmit}
                  </button>
                </form>
              )}

              <p className="mt-2 text-center text-[11px] text-fg-muted">
                {d.revisionsUsed
                  .replace("{used}", nf.format(request.revisionCount))
                  .replace("{total}", nf.format(CUSTOM_DESIGN_REVISIONS_INCLUDED))}
              </p>
            </>
          ) : (
            <p className="text-center text-[11px] leading-relaxed text-fg-muted">{d.revisionsOver}</p>
          )}
        </div>
      )}

      {/* Inspiration images go over WhatsApp, quoting the request number — it is
          the only thing that ties a photo to a brief. */}
      <a
        href={supportWhatsAppUrl(d.whatsappMessage.replace("{reference}", request.reference))}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block text-center text-xs font-medium text-accent underline-offset-4 hover:underline"
      >
        {d.whatsappCta}
      </a>
    </section>
  );
}

/** The price a card that has no request yet should quote. */
export const CUSTOM_DESIGN_PRICE = CUSTOM_DESIGN_PRICE_SAR;
