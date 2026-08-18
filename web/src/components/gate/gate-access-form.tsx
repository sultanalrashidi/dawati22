"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { verifyGatePinAction } from "@/lib/gatepin/actions";

export function GateAccessForm({ dict }: { dict: Dictionary }) {
  const router = useRouter();
  const [referenceCode, setReferenceCode] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const g = dict.gateAccess;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await verifyGatePinAction(referenceCode, pin);
      if (result.ok) {
        router.refresh();
        return;
      }
      if (result.error === "locked") {
        const minutes = Math.ceil((result.retryAfterSeconds ?? 60) / 60);
        setError(g.lockedError.replace("{minutes}", String(minutes)));
      } else {
        setError(g.invalidError);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-fg-muted">{g.referenceCodeLabel}</span>
        <input
          value={referenceCode}
          onChange={(e) => setReferenceCode(e.target.value.toUpperCase())}
          dir="ltr"
          autoCapitalize="characters"
          placeholder={g.referenceCodePlaceholder}
          className="h-11 rounded-lg border border-border bg-bg px-3 text-center text-lg tracking-widest text-fg outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-fg-muted">{g.pinLabel}</span>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          type="password"
          inputMode="numeric"
          dir="ltr"
          placeholder={g.pinPlaceholder}
          className="h-11 rounded-lg border border-border bg-bg px-3 text-center text-lg tracking-widest text-fg outline-none focus:border-accent"
        />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={isPending || !referenceCode.trim() || !pin.trim()}
        className="h-11 rounded-full bg-accent text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
      >
        {g.submit}
      </button>
    </form>
  );
}
