"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps the attendance report actually live during the event.
 *
 * The section says, in Arabic, that it updates as the night happens. It did
 * not: a server-rendered page freezes at whatever it said when it loaded, so
 * a host watching the door from her table saw the same number for an hour
 * while women walked in. A number that does not move reads as a product that
 * is broken, not as a page that is old — which is the worse of the two.
 *
 * `router.refresh()` re-runs the page's own queries and swaps in new markup
 * without losing scroll position or client state, so no polling endpoint and
 * no duplicate query layer.
 *
 * It stops while the tab is hidden — a phone in a handbag must not refresh a
 * heavy page every half minute all night — and resumes, with an immediate
 * refresh, the moment she looks again. The caller decides when to mount it at
 * all, so an event from last spring polls nothing.
 */
export function LiveAttendance({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer !== null) return;
      timer = setInterval(() => router.refresh(), intervalMs);
    };
    const stop = () => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        // She just came back, and the last thing she wants is to wait out the
        // interval before the screen tells the truth.
        router.refresh();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, intervalMs]);

  return null;
}
