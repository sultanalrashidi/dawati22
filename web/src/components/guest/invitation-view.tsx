"use client";

import { useEffect, useMemo, useState, useTransition, type CSSProperties } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { ThemeConfig } from "@/lib/themes/types";
import { fontVarFor } from "@/lib/themes/fonts";
import { submitRsvpAction } from "@/lib/invitations/actions";

type GuestFacingStatus = "DRAFT" | "SENT" | "VIEWED" | "ACCEPTED" | "DECLINED";

interface Props {
  dict: Dictionary;
  /** Required in "live" mode (default); unused in "preview" mode. */
  linkToken?: string;
  theme: ThemeConfig;
  event: {
    name: string;
    groomNameEn: string;
    brideNameEn: string;
    invitationTextAr: string;
    eventDate: string;
    locationName: string;
    mapUrl: string | null;
    rsvpRequired: boolean;
  };
  guest: { nameAr: string; allowedCount: number };
  status: GuestFacingStatus;
  qrDataUrl: string | null;
  /**
   * "preview" is used by the admin theme editor and the customer theme
   * pickers to show the real interactive experience with sample content —
   * RSVP is simulated locally and never touches the server.
   */
  mode?: "live" | "preview";
}

const OPEN_ANIMATIONS: Record<ThemeConfig["motion"]["openStyle"], string> = {
  fade: "dawati-fade-in 0.9s ease-out",
  envelope: "dawati-envelope-content 0.9s ease-out",
  "arch-reveal": "dawati-arch-reveal 0.9s ease-out",
  curtain: "dawati-curtain 0.9s ease-out",
  "gate-swing": "dawati-gate-swing 0.9s ease-out",
  "seal-break": "dawati-seal-break 0.9s ease-out",
};

/** Deterministic decorative grid standing in for a real QR in preview mode. */
function FakeQr() {
  const cells = Array.from({ length: 100 }, (_, i) => (i * 37 + (i % 7) * 13) % 5 === 0);
  return (
    <div className="grid h-40 w-40 grid-cols-10 gap-[2px] bg-white p-2">
      {cells.map((filled, i) => (
        <div key={i} className={filled ? "bg-black" : "bg-white"} />
      ))}
    </div>
  );
}

function useCountdown(target: string) {
  // null on the server (avoids baking a stale timestamp into the HTML);
  // the lazy initializer computes the real value once we're on the client.
  const [now, setNow] = useState<number | null>(() => (typeof window === "undefined" ? null : Date.now()));
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return useMemo(() => {
    if (now === null) return null;
    const diff = Math.max(0, new Date(target).getTime() - now);
    return {
      days: Math.floor(diff / 86_400_000),
      hours: Math.floor((diff / 3_600_000) % 24),
      minutes: Math.floor((diff / 60_000) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    };
  }, [now, target]);
}

export function InvitationView({
  dict,
  linkToken,
  theme,
  event,
  guest,
  status,
  qrDataUrl,
  mode = "live",
}: Props) {
  const [opened, setOpened] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [currentQr, setCurrentQr] = useState(qrDataUrl);
  const [rsvpError, setRsvpError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const countdown = useCountdown(event.eventDate);
  const g = dict.guest;

  const vars: CSSProperties & Record<string, string> = {
    "--color-bg": theme.palette.bg,
    "--color-surface": theme.palette.surface,
    "--color-fg": theme.palette.fg,
    "--color-fg-muted": theme.palette.fgMuted,
    "--color-accent": theme.palette.accent,
    "--color-accent-fg": theme.palette.accentFg,
    "--font-ar-display": fontVarFor(theme.fonts.arabicDisplay),
    "--font-ar-body": fontVarFor(theme.fonts.arabicBody),
    "--font-en-display": fontVarFor(theme.fonts.latinDisplay),
  };

  function respond(response: "ACCEPTED" | "DECLINED") {
    if (mode === "preview") {
      setCurrentStatus(response);
      return;
    }
    setRsvpError(null);
    startTransition(async () => {
      const result = await submitRsvpAction(linkToken!, response);
      if (!result.ok) {
        setRsvpError(g.rsvpError);
        return;
      }
      setCurrentStatus(response);
      if (result.qrDataUrl) setCurrentQr(result.qrDataUrl);
    });
  }

  const isArch = theme.layout === "arch-frame";
  const isEnvelope = theme.layout === "envelope-reveal";
  const isSplit = theme.layout === "split-portrait";
  const openAnimation = OPEN_ANIMATIONS[theme.motion.openStyle] ?? OPEN_ANIMATIONS.fade;

  if (!opened) {
    return (
      <div
        style={vars}
        className={
          isSplit
            ? "flex min-h-screen flex-row-reverse text-[var(--color-fg)]"
            : "flex min-h-screen flex-col items-center justify-center gap-8 bg-[var(--color-bg)] px-6 text-center text-[var(--color-fg)]"
        }
      >
        {isSplit && <div className="w-3 shrink-0" style={{ background: "var(--color-accent)" }} />}
        <div
          className={
            isSplit
              ? "flex flex-1 flex-col items-start justify-center gap-8 bg-[var(--color-bg)] px-8 text-start"
              : "flex flex-col items-center gap-8"
          }
        >
          <div
            className={
              isEnvelope
                ? "flex flex-col items-center gap-8 border border-[var(--color-accent)]/50 bg-[var(--color-surface)] px-10 py-14 shadow-xl"
                : isArch
                  ? "flex flex-col items-center gap-8 rounded-t-[220px] border-2 border-[var(--color-accent)] px-10 pb-10 pt-24"
                  : isSplit
                    ? "flex flex-col items-start gap-8"
                    : "flex flex-col items-center gap-8"
            }
            style={
              isEnvelope
                ? { clipPath: "polygon(0 12%, 50% 0, 100% 12%, 100% 100%, 0 100%)" }
                : undefined
            }
          >
            <p
              className="text-sm uppercase tracking-[0.4em] text-[var(--color-accent)]"
              style={{ fontFamily: "var(--font-ar-body)" }}
            >
              {g.guestOf}
            </p>
            <h1 className="text-3xl leading-relaxed" style={{ fontFamily: "var(--font-ar-display)" }}>
              {guest.nameAr}
            </h1>
            <p className="text-lg" style={{ fontFamily: "var(--font-en-display)" }}>
              {event.groomNameEn} &amp; {event.brideNameEn}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpened(true)}
            className="mt-6 h-12 rounded-full border border-[var(--color-accent)] px-8 text-sm font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-fg)]"
            style={{ animation: "dawati-fade-in 1.2s ease-out" }}
          >
            {g.openInvitation}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ ...vars, animation: openAnimation }}
      className="min-h-screen bg-[var(--color-bg)] px-6 py-16 text-[var(--color-fg)]"
    >
      <div
        className={
          isArch
            ? "mx-auto flex max-w-md flex-col items-center gap-6 rounded-t-[160px] border-2 border-[var(--color-accent)] px-8 pb-10 pt-20 text-center"
            : isEnvelope
              ? "mx-auto flex max-w-md flex-col items-center gap-6 border border-[var(--color-accent)]/40 bg-[var(--color-surface)] px-8 py-12 text-center shadow-lg"
              : isSplit
                ? "mx-auto flex max-w-md flex-col items-start gap-6 border-e-4 px-6 text-start"
                : "mx-auto flex max-w-md flex-col items-center gap-6 text-center"
        }
        style={isSplit ? { borderColor: "var(--color-accent)" } : undefined}
      >
        <p className="text-lg" style={{ fontFamily: "var(--font-en-display)" }}>
          {event.groomNameEn} &amp; {event.brideNameEn}
        </p>
        <h1 className="text-2xl leading-relaxed" style={{ fontFamily: "var(--font-ar-display)" }}>
          {guest.nameAr}
        </h1>
        <p className="whitespace-pre-line leading-loose text-[var(--color-fg-muted)]">
          {event.invitationTextAr}
        </p>

        {theme.sections.showCountdown && countdown && (
          <div className="mt-4 flex gap-4 rounded-2xl border border-[var(--color-accent)]/30 px-6 py-4">
            {([
              [countdown.days, g.days],
              [countdown.hours, g.hours],
              [countdown.minutes, g.minutes],
              [countdown.seconds, g.seconds],
            ] as const).map(([value, label]) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <span className="text-xl font-semibold">{value}</span>
                <span className="text-xs text-[var(--color-fg-muted)]">{label}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 text-sm text-[var(--color-fg-muted)]">
          <p>{new Date(event.eventDate).toLocaleString("ar-SA", { dateStyle: "full", timeStyle: "short" })}</p>
          <p className="mt-1">{event.locationName}</p>
        </div>

        {theme.sections.showMap && event.mapUrl && (
          <a
            href={event.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-11 items-center rounded-full border border-[var(--color-accent)] px-6 text-sm font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-fg)] inline-flex"
          >
            {g.openMap}
          </a>
        )}

        <div className="mt-8 w-full">
          {currentStatus === "ACCEPTED" ? (
            currentQr || mode === "preview" ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--color-accent)]/40 bg-[var(--color-surface)] p-6">
                <p className="text-sm font-medium">{g.passTitle}</p>
                {currentQr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentQr} alt="QR" className="h-40 w-40" />
                ) : (
                  <FakeQr />
                )}
                <p className="text-sm text-[var(--color-fg-muted)]">{g.passName}: {guest.nameAr}</p>
                <p className="text-sm text-[var(--color-fg-muted)]">{g.passSeats}: {guest.allowedCount}</p>
              </div>
            ) : (
              <p className="text-[var(--color-accent)]">{g.thanksAccept}</p>
            )
          ) : currentStatus === "DECLINED" ? (
            <p className="text-[var(--color-fg-muted)]">{g.thanksDecline}</p>
          ) : event.rsvpRequired ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => respond("ACCEPTED")}
                  className="h-11 rounded-full px-6 text-sm font-medium disabled:opacity-50"
                  style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)" }}
                >
                  {g.accept}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => respond("DECLINED")}
                  className="h-11 rounded-full border border-[var(--color-fg-muted)] px-6 text-sm font-medium disabled:opacity-50"
                >
                  {g.decline}
                </button>
              </div>
              {rsvpError && <p className="text-sm text-red-400">{rsvpError}</p>}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
