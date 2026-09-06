"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

/**
 * The door's error boundary — the whole of it, so both gate segments mount the
 * same screen.
 *
 * This app had no error boundary anywhere, which means any crash in the gate
 * subtree fell through to Next's default error page: a blank apology on a
 * phone at 10pm, with a queue behind it. `reset()` re-mounts the scanner in
 * place instead — fresh refs, camera restarted, PIN session untouched.
 *
 * It is NOT what catches a dropped scan. That failure is handled inside the
 * scanner, which owns its own fetch precisely because a server action's
 * transport error escapes as an uncaught window error that no React boundary
 * can see — verified in a browser by blocking the request.
 *
 * Scoped to the gate segments on purpose: an app-wide boundary would swallow
 * real bugs everywhere else and dress them up as a friendly button.
 *
 * The copy is inlined because a boundary renders exactly when a server round
 * trip may be what failed, so it cannot await `getDictionary`.
 */
const COPY = {
  ar: {
    title: "توقّف شي في الماسح",
    body: "صار خطأ غير متوقّع. اضغطي وواصلي — دخولك للباب باقٍ، وما يحتاج تعيدين الرمز السري.",
    button: "واصلي المسح",
  },
  en: {
    title: "The scanner hit a snag",
    body: "Something unexpected went wrong. Tap to carry on — your door session is still open, there is no need to enter the PIN again.",
    button: "Keep scanning",
  },
} as const;

export default function GateErrorRecovery({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ locale?: string }>();
  const copy = params?.locale === "en" ? COPY.en : COPY.ar;

  useEffect(() => {
    // The door runs on someone else's phone; this line is the only trace we
    // will ever get of what went wrong out there.
    console.error("gate.scan_failed", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-8">
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <h1 className="text-lg font-semibold text-fg">{copy.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">{copy.body}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 h-12 w-full rounded-full bg-accent text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong"
        >
          {copy.button}
        </button>
      </div>
    </div>
  );
}
