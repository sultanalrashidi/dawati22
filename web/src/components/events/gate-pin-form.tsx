"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { toWesternDigits } from "@/lib/arabic";
import { setGatePinAction, clearGatePinAction } from "@/lib/gatepin/actions";

export function GatePinForm({
  eventId,
  dict,
  hasPinSet,
}: {
  eventId: string;
  dict: Dictionary;
  hasPinSet: boolean;
}) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const f = dict.events.detail;

  function handleSet(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await setGatePinAction(eventId, pin);
      if (result.ok) {
        setPin("");
        router.refresh();
      } else {
        setError(result.error === "invalid_format" ? f.gatePinInvalidFormat : f.gatePinError);
      }
    });
  }

  function handleClear() {
    setError(null);
    startTransition(async () => {
      const result = await clearGatePinAction(eventId);
      if (result.ok) router.refresh();
      else setError(f.gatePinError);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm text-fg">{hasPinSet ? f.gatePinSetStatus : f.gatePinNotSetStatus}</p>
      <form onSubmit={handleSet} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg-muted">{hasPinSet ? f.gatePinChangeLabel : f.gatePinSetLabel}</span>
          <input
            value={pin}
            onChange={(e) => setPin(toWesternDigits(e.target.value).replace(/\D/g, ""))}
            type="password"
            inputMode="numeric"
            dir="ltr"
            placeholder={f.gatePinPlaceholder}
            className="h-10 w-32 rounded-lg border border-border bg-bg px-3 text-center tracking-widest text-fg outline-none focus:border-accent"
          />
        </label>
        <button
          type="submit"
          disabled={isPending || !pin.trim()}
          className="h-10 rounded-full bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
        >
          {hasPinSet ? f.gatePinChangeButton : f.gatePinSetButton}
        </button>
        {hasPinSet && (
          <button
            type="button"
            onClick={handleClear}
            disabled={isPending}
            className="h-10 rounded-full border border-border px-4 text-sm text-danger hover:bg-danger/10 disabled:opacity-50"
          >
            {f.gatePinClear}
          </button>
        )}
      </form>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
