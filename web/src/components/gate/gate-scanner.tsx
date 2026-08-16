"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { scanQrAction } from "@/lib/checkin/actions";
import type { CheckInOutcome } from "@/lib/checkin/service";

const RESULT_STYLE: Record<string, { bg: string; fg: string }> = {
  SUCCESS: { bg: "bg-success/10", fg: "text-success" },
  DENIED_FULL: { bg: "bg-warning/10", fg: "text-warning" },
  DENIED_UNCONFIRMED: { bg: "bg-warning/10", fg: "text-warning" },
};

const RESULT_LABEL_KEY: Record<string, string> = {
  SUCCESS: "resultSuccess",
  DENIED_FULL: "resultDeniedFull",
  DENIED_BLOCKED: "resultDeniedBlocked",
  DENIED_CANCELLED: "resultDeniedCancelled",
  DENIED_EXPIRED: "resultDeniedExpired",
  DENIED_UNCONFIRMED: "resultDeniedUnconfirmed",
  DENIED_INVALID: "resultDeniedInvalid",
};

// Minimal ambient type — BarcodeDetector isn't in lib.dom.d.ts yet in all TS/lib versions.
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike;
  }
}

export function GateScanner({ eventId, dict }: { eventId: string; dict: Dictionary }) {
  const [manualToken, setManualToken] = useState("");
  const [outcome, setOutcome] = useState<CheckInOutcome | null>(null);
  const [isPending, startTransition] = useTransition();
  const [cameraAvailable, setCameraAvailable] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const g = dict.gate;

  useEffect(() => {
    let cancelled = false;
    let rafId: number;

    async function start() {
      if (typeof window === "undefined" || !window.BarcodeDetector || !navigator.mediaDevices) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraAvailable(true);

        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes[0]?.rawValue) {
              handleScan(codes[0].rawValue);
              return;
            }
          } catch {
            // transient decode errors are expected between frames
          }
          rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
      } catch {
        setCameraAvailable(false);
      }
    }

    start();
    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleScan(token: string) {
    if (isPending) return;
    startTransition(async () => {
      const result = await scanQrAction(eventId, token);
      setOutcome(result);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setCameraAvailable(false);
    });
  }

  function reset() {
    setOutcome(null);
    setManualToken("");
  }

  if (outcome) {
    const style = RESULT_STYLE[outcome.result] ?? { bg: "bg-danger/10", fg: "text-danger" };
    return (
      <div className={`mt-6 flex flex-col items-center gap-3 rounded-2xl p-8 text-center ${style.bg}`}>
        <p className={`text-xl font-semibold ${style.fg}`}>{g[RESULT_LABEL_KEY[outcome.result] as keyof typeof g]}</p>
        {outcome.guestName && <p className="text-fg">{outcome.guestName}</p>}
        {typeof outcome.seatsRemaining === "number" && (
          <p className="text-sm text-fg-muted">{g.seatsRemaining.replace("{count}", String(outcome.seatsRemaining))}</p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-4 h-11 rounded-full bg-accent px-6 text-sm font-medium text-accent-fg hover:bg-accent-strong"
        >
          {g.scanAnother}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      {cameraAvailable ? (
        <div className="overflow-hidden rounded-2xl border border-border">
          <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
          <p className="p-2 text-center text-xs text-fg-muted">{g.scanPrompt}</p>
        </div>
      ) : (
        <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-fg-muted">{g.cameraNotAvailable}</p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (manualToken.trim()) handleScan(manualToken.trim());
        }}
        className="flex flex-col gap-2"
      >
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg-muted">{g.manualEntryLabel}</span>
          <input
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            dir="ltr"
            placeholder={g.manualEntryPlaceholder}
            className="h-11 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
          />
        </label>
        <button
          type="submit"
          disabled={isPending || !manualToken.trim()}
          className="h-11 rounded-full bg-accent text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
        >
          {g.scanButton}
        </button>
      </form>
    </div>
  );
}
