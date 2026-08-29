"use client";

import { useState, type ReactNode } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { supportWhatsAppUrl } from "@/lib/support";

const EVENT_TYPE_OPTIONS = [
  ["WEDDING", "typeWedding"],
  ["ENGAGEMENT", "typeEngagement"],
  ["GRADUATION", "typeGraduation"],
  ["BIRTHDAY", "typeBirthday"],
  ["ANNIVERSARY", "typeAnniversary"],
  ["CORPORATE", "typeCorporate"],
  ["OTHER", "typeOther"],
] as const;

/**
 * The event-type select, plus everything the rest of the form depends on it.
 *
 * Only weddings are actually supported: the fields below ask for a groom and a
 * bride, the designs are wedding art, and the invitation copy is written for a
 * wedding. Letting someone fill all of that in for a graduation and only find
 * out at the end would be the worst version of this. So picking anything else
 * replaces the form with a plain "not yet" — and, because a select is just a
 * value the browser posts, `createEventAction` refuses it server-side too.
 *
 * `enabled` is false on the admin's edit screen: support must still be able to
 * open and correct an event whatever its type says.
 */
export function EventTypeGate({
  dict,
  defaultType = "WEDDING",
  enabled = true,
  children,
}: {
  dict: Dictionary;
  defaultType?: string;
  enabled?: boolean;
  children: ReactNode;
}) {
  const [type, setType] = useState(defaultType);
  const f = dict.events.form;
  const blocked = enabled && type !== "WEDDING";

  return (
    <>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-fg-muted">{f.typeLabel}</span>
        <select
          name="type"
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="h-11 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
        >
          {EVENT_TYPE_OPTIONS.map(([value, key]) => (
            <option key={value} value={value}>
              {f[key]}
            </option>
          ))}
        </select>
        {enabled && <span className="text-xs text-fg-muted">{f.weddingOnly}</span>}
      </label>

      {blocked ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-accent-soft/50 bg-surface-2/50 p-6">
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-fg">
            {f.comingSoonTitle}
          </span>
          <p className="text-sm leading-relaxed text-fg-muted">{f.comingSoonBody}</p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setType("WEDDING")}
              className="inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-bold text-accent-fg transition-colors hover:bg-accent-strong"
            >
              {f.comingSoonAction}
            </button>
            <a
              href={supportWhatsAppUrl(f.comingSoonMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-bold text-accent underline-offset-4 hover:underline"
            >
              {f.comingSoonWhatsapp}
            </a>
          </div>
        </div>
      ) : (
        children
      )}
    </>
  );
}
