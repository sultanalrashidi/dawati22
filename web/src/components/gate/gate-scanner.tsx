"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import jsQR from "jsqr";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
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

/** Why the camera isn't running — each one gets its own sentence, not one catch-all. */
type CameraState = "starting" | "scanning" | "denied" | "noDevice" | "insecure" | "error";

/**
 * The door scanner.
 *
 * Two things about this are easy to get wrong and were both wrong before:
 *
 * 1. The <video> element is ALWAYS mounted, just hidden until the stream is
 *    attached. It used to be rendered only once `cameraAvailable` flipped true
 *    — which happens after the stream arrives — so `videoRef.current` was null
 *    at the exact moment the stream needed attaching. The camera light came on
 *    and the preview stayed blank forever.
 *
 * 2. `BarcodeDetector` does not exist in Safari or Firefox, i.e. on every
 *    iPhone. It is used when present because it is native and fast, and jsQR
 *    decodes the same frames everywhere else. A door scanner that only works
 *    on Android is not a door scanner.
 */
export function GateScanner({
  eventId,
  dict,
  scanAction,
}: {
  eventId: string;
  dict: Dictionary;
  scanAction: (eventId: string, token: string) => Promise<CheckInOutcome>;
}) {
  const [manualToken, setManualToken] = useState("");
  const [outcome, setOutcome] = useState<CheckInOutcome | null>(null);
  const [isPending, startTransition] = useTransition();
  const [camera, setCamera] = useState<CameraState>("starting");
  const [attempt, setAttempt] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // The detection loop lives outside React, so it reads "am I already
  // submitting?" through a ref — a captured `isPending` would be frozen at
  // whatever it was on the render that started the loop.
  const busyRef = useRef(false);
  const g = dict.gate;

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const submit = useCallback(
    (token: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      stopStream();
      startTransition(async () => {
        const result = await scanAction(eventId, token);
        setOutcome(result);
        busyRef.current = false;
      });
    },
    [eventId, scanAction, stopStream],
  );

  useEffect(() => {
    if (outcome) return;

    let cancelled = false;
    let rafId = 0;

    async function start() {
      // getUserMedia only exists on a secure origin. Saying so beats "camera
      // not available", which sends someone hunting for a hardware fault.
      if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setCamera(window.isSecureContext === false ? "insecure" : "noDevice");
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
      } catch (err) {
        if (cancelled) return;
        const name = (err as DOMException)?.name;
        setCamera(
          name === "NotAllowedError" || name === "SecurityError"
            ? "denied"
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "noDevice"
              : "error",
        );
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        setCamera("error");
        return;
      }

      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // Some browsers reject play() until the element is visible; the frame
        // loop below still works once it starts producing frames.
      }
      if (cancelled) return;
      setCamera("scanning");

      const native = window.BarcodeDetector
        ? new window.BarcodeDetector({ formats: ["qr_code"] })
        : null;

      const readFrame = async (): Promise<string | null> => {
        if (!video.videoWidth || !video.videoHeight) return null;

        if (native) {
          const codes = await native.detect(video);
          return codes[0]?.rawValue ?? null;
        }

        // Safari / Firefox path: pull the frame into a canvas and decode it.
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d", { willReadFrequently: true });
        if (!canvas || !ctx) return null;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" })?.data ?? null;
      };

      const tick = async () => {
        if (cancelled || busyRef.current) return;
        try {
          const value = await readFrame();
          if (value) {
            submit(value);
            return;
          }
        } catch {
          // Transient decode errors between frames are normal.
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    }

    void start();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      stopStream();
    };
  }, [attempt, outcome, stopStream, submit]);

  function retry() {
    setCamera("starting");
    setAttempt((n) => n + 1);
  }

  function reset() {
    setOutcome(null);
    setManualToken("");
    setCamera("starting");
    setAttempt((n) => n + 1);
  }

  if (outcome) {
    const style = RESULT_STYLE[outcome.result] ?? { bg: "bg-danger/10", fg: "text-danger" };
    return (
      <div className={`mt-6 flex flex-col items-center gap-3 rounded-2xl p-8 text-center ${style.bg}`}>
        <p className={`text-xl font-semibold ${style.fg}`}>
          {g[RESULT_LABEL_KEY[outcome.result] as keyof typeof g]}
        </p>
        {outcome.guestName && <p className="text-fg">{outcome.guestName}</p>}
        {typeof outcome.seatsRemaining === "number" && (
          <p className="text-sm text-fg-muted">
            {g.seatsRemaining.replace("{count}", String(outcome.seatsRemaining))}
          </p>
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

  const message: Partial<Record<CameraState, string>> = {
    starting: g.cameraStarting,
    denied: g.cameraDenied,
    noDevice: g.cameraNoDevice,
    insecure: g.cameraInsecure,
    error: g.cameraError,
  };
  const canRetry = camera === "denied" || camera === "error";

  return (
    <div className="mt-6 flex flex-col gap-4">
      {/* Always mounted — the stream needs this element to exist the moment
          getUserMedia resolves, not one render later. */}
      <div
        className={`overflow-hidden rounded-2xl border border-border ${
          camera === "scanning" ? "" : "hidden"
        }`}
      >
        <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline autoPlay />
        <p className="p-2 text-center text-xs text-fg-muted">{g.scanPrompt}</p>
      </div>
      <canvas ref={canvasRef} className="hidden" />

      {camera !== "scanning" && (
        <div className="rounded-xl bg-surface-2 px-4 py-3">
          <p className="text-sm text-fg-muted">{message[camera]}</p>
          {camera === "starting" && (
            <p className="mt-1 text-xs text-fg-muted">{g.cameraPermissionHint}</p>
          )}
          {canRetry && (
            <button
              type="button"
              onClick={retry}
              className="mt-3 h-9 rounded-full border border-accent px-4 text-xs font-medium text-accent transition-colors hover:bg-accent hover:text-accent-fg"
            >
              {g.cameraRetry}
            </button>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (manualToken.trim()) submit(manualToken.trim());
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
