"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import jsQR from "jsqr";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { CheckInOutcome, DoorSearchResult } from "@/lib/checkin/service";

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

/** Long enough for a slow hall connection, short enough that a queue notices nothing. */
const SCAN_TIMEOUT_MS = 12_000;

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
export function GateScanner({ eventId, dict }: { eventId: string; dict: Dictionary }) {
  const [outcome, setOutcome] = useState<CheckInOutcome | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DoorSearchResult[] | null>(null);
  const [searchState, setSearchState] = useState<"idle" | "searching" | "failed">("idle");
  const [partyState, setPartyState] = useState<"idle" | "saving" | "failed">("idle");
  const [isPending, startTransition] = useTransition();
  const [camera, setCamera] = useState<CameraState>("starting");
  const [attempt, setAttempt] = useState(0);
  /** The last send never reached the server — a hall-wifi problem, not a code problem. */
  const [sendFailed, setSendFailed] = useState(false);

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

  /**
   * Send one code, and never strand the scanner.
   *
   * A plain fetch, not the server action this used to call: an action whose
   * POST never lands does not reject the promise the caller awaited — it
   * escapes as an uncaught window error, past every try/catch and past React
   * error boundaries too. That left the camera stopped, `busyRef` stuck true,
   * and every later scan and manual entry swallowed by the guard at the top,
   * with the retry button hidden because the component still believed it was
   * scanning. The only way out was a page reload, and nothing said so.
   *
   * The stream stops for the round trip so a second frame cannot submit the
   * same code twice, which is exactly why a failure has to hand the camera
   * back: she is standing at a door with a queue, and the next thing she does
   * is scan again.
   */
  const submit = useCallback(
    (token: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setSendFailed(false);
      stopStream();
      startTransition(async () => {
        try {
          const response = await fetch("/api/gate/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId, qrToken: token }),
            // A door queue does not wait half a minute for a hung request.
            signal: AbortSignal.timeout(SCAN_TIMEOUT_MS),
          });
          if (!response.ok) throw new Error(`scan failed: ${response.status}`);
          const outcome = (await response.json()) as CheckInOutcome;
          if (!outcome?.result) throw new Error("scan returned no result");
          setOutcome(outcome);
        } catch {
          setSendFailed(true);
          setCamera("starting");
          setAttempt((n) => n + 1);
        } finally {
          busyRef.current = false;
        }
      });
    },
    [eventId, stopStream],
  );

  /**
   * Find her without her code.
   *
   * Every phone at a wedding is a code that might not open: a screen that will
   * not brighten, a screenshot that will not focus, a message forwarded to a
   * sister. The box this replaced asked for a 43-character random string that
   * no screen in the product ever shows, so it answered none of that.
   */
  const runSearch = useCallback(async () => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearchState("idle");
      return;
    }
    setSearchState("searching");
    try {
      const response = await fetch("/api/gate/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, query: term }),
        signal: AbortSignal.timeout(SCAN_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`search failed: ${response.status}`);
      const data = (await response.json()) as { guests?: DoorSearchResult[] };
      setResults(data.guests ?? []);
      setSearchState("idle");
    } catch {
      setResults(null);
      setSearchState("failed");
    }
  }, [eventId, query]);

  /**
   * How many of her seats are used — set outright, never nudged by one.
   *
   * The same call lets in a guest found by search (from zero) and corrects a
   * scan that admitted the wrong number. Absolute, so a tap that lands twice
   * on a bad connection cannot admit two more women.
   */
  const admit = useCallback(
    (guestId: string, seats: number) => {
      setPartyState("saving");
      stopStream();
      startTransition(async () => {
        try {
          const response = await fetch("/api/gate/admit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId, guestId, seats }),
            signal: AbortSignal.timeout(SCAN_TIMEOUT_MS),
          });
          if (!response.ok) throw new Error(`admit failed: ${response.status}`);
          const next = (await response.json()) as CheckInOutcome;
          if (!next?.result) throw new Error("admit returned no result");
          setOutcome(next);
          setPartyState("idle");
        } catch {
          setPartyState("failed");
        }
      });
    },
    [eventId, stopStream],
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
    setQuery("");
    setResults(null);
    setSearchState("idle");
    setPartyState("idle");
    setSendFailed(false);
    setCamera("starting");
    setAttempt((n) => n + 1);
  }

  if (outcome) {
    const style = RESULT_STYLE[outcome.result] ?? { bg: "bg-danger/10", fg: "text-danger" };
    const canSetParty =
      outcome.guestId !== undefined &&
      typeof outcome.seatsAllowed === "number" &&
      outcome.result === "SUCCESS";

    return (
      <div className="mt-6 flex flex-col gap-4">
        <div className={`flex flex-col items-center gap-2 rounded-2xl p-8 text-center ${style.bg}`}>
          <p className={`text-xl font-semibold ${style.fg}`}>
            {g[RESULT_LABEL_KEY[outcome.result] as keyof typeof g]}
          </p>
          {outcome.guestName && <p className="text-lg text-fg">{outcome.guestName}</p>}
          {typeof outcome.seatsAllowed === "number" && typeof outcome.seatsUsed === "number" && (
            <p className="text-sm text-fg-muted">
              {g.searchSeats
                .replace("{used}", String(outcome.seatsUsed))
                .replace("{allowed}", String(outcome.seatsAllowed))}
            </p>
          )}
        </div>

        {/* "How many came in?" — one tap per woman, and never past her seats.
            A guest who arrives alone must not have her invitation closed
            behind her while the rest are still parking, which is why the
            numbers below her total stay live after a successful scan. */}
        {canSetParty && (
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="text-sm font-semibold text-fg">{g.partyQuestion}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {Array.from({ length: outcome.seatsAllowed! }, (_, i) => i + 1).map((n) => {
                const active = outcome.seatsUsed === n;
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={partyState === "saving"}
                    onClick={() => admit(outcome.guestId!, n)}
                    aria-pressed={active}
                    className={`h-12 min-w-12 rounded-xl border px-4 text-base font-semibold transition-colors disabled:opacity-50 ${
                      active
                        ? "border-accent bg-accent text-accent-fg"
                        : "border-border bg-bg text-fg hover:border-accent-soft"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
              <span className="self-center text-xs text-fg-muted">
                {g.partyOf.replace("{allowed}", String(outcome.seatsAllowed))}
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-fg-muted">{g.partyHint}</p>
            {partyState === "saving" && <p className="mt-2 text-xs text-fg-muted">{g.partySaving}</p>}
            {partyState === "failed" && (
              <p className="mt-2 text-xs text-danger" role="alert">
                {g.partyFailed}
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={reset}
          className="h-12 rounded-full bg-accent px-6 text-sm font-medium text-accent-fg hover:bg-accent-strong"
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
      {sendFailed && (
        <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {g.scanSendFailed}
        </p>
      )}

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

      {/* Search, where a 43-character token box used to be.
          That box asked for `qrToken` — a random string no screen in the
          product ever displays — so the one interface meant for "the code
          will not scan" could not be used by anyone. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch();
        }}
        className="flex flex-col gap-2"
      >
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg-muted">{g.searchLabel}</span>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchState("idle");
            }}
            enterKeyHint="search"
            placeholder={g.searchPlaceholder}
            className="h-12 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
          />
        </label>
        <button
          type="submit"
          disabled={searchState === "searching" || isPending || query.trim().length < 2}
          className="h-12 rounded-full bg-accent text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
        >
          {g.searchButton}
        </button>
      </form>

      {searchState === "failed" && (
        <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {g.searchFailed}
        </p>
      )}

      {results !== null && results.length === 0 && searchState === "idle" && (
        <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-fg-muted">
          {query.trim().length < 2 ? g.searchTooShort : g.searchNoResults}
        </p>
      )}

      {results !== null && results.length > 0 && (
        <ul className="flex flex-col gap-2">
          {results.map((guest) => {
            const full = guest.checkedInCount >= guest.allowedCount;
            return (
              <li key={guest.id} className="rounded-xl border border-border bg-surface p-4">
                <p className="text-base font-semibold text-fg">{guest.nameAr}</p>
                {/* The number in full, and on purpose: two women called أم فهد
                    are told apart by nothing else, and the organiser is
                    reading it off the guest's own phone. */}
                <p dir="ltr" className="mt-0.5 text-start text-sm text-fg-muted">
                  {guest.phone ?? g.searchNoPhone}
                </p>
                <p className="mt-1 text-xs text-fg-muted">
                  {g.searchSeats
                    .replace("{used}", String(guest.checkedInCount))
                    .replace("{allowed}", String(guest.allowedCount))}
                  {" · "}
                  {guest.rsvp === "ACCEPTED" ? g.searchRsvpAccepted : g.searchRsvpNone}
                  {guest.partySize !== null && ` · ${g.searchPartySize.replace("{count}", String(guest.partySize))}`}
                </p>
                <button
                  type="button"
                  disabled={full || partyState === "saving"}
                  onClick={() =>
                    admit(
                      guest.id,
                      // What she declared, else one more than are already in —
                      // never her whole allowance, which would close the
                      // invitation on the ones still parking.
                      Math.min(guest.allowedCount, guest.partySize ?? guest.checkedInCount + 1),
                    )
                  }
                  className="mt-3 h-11 w-full rounded-full bg-accent text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong disabled:opacity-50"
                >
                  {full ? g.searchFull : g.searchAdmit}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
