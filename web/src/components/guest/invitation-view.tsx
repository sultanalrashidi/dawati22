"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { ThemeConfig } from "@/lib/themes/types";
import { fontVarFor } from "@/lib/themes/fonts";
import { submitRsvpAction } from "@/lib/invitations/actions";
import { ThemeDecor } from "@/components/guest/theme-decor";
import { ShaderBackground } from "@/components/guest/shader-background";

type GuestFacingStatus = "DRAFT" | "SENT" | "VIEWED" | "ACCEPTED" | "DECLINED";

interface Props {
  dict: Dictionary;
  /** Required in "live" mode (default); unused in "preview" mode. */
  linkToken?: string;
  theme: ThemeConfig;
  /** Theme.category — drives which decorative motif kit renders (see theme-decor.tsx). */
  themeCategory?: string;
  event: {
    name: string;
    groomNameEn: string;
    brideNameEn: string;
    invitationTextAr: string;
    eventDate: string;
    locationName: string;
    mapUrl: string | null;
    musicYoutubeId?: string | null;
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

/** Opening-transition length in ms — kept in sync with the CSS animation durations below. */
const OPENING_TRANSITION_MS = 650;

const OPEN_ANIMATIONS: Record<ThemeConfig["motion"]["openStyle"], string> = {
  fade: "dawati-fade-in 0.9s ease-out",
  envelope: "dawati-envelope-content 0.9s ease-out",
  "arch-reveal": "dawati-arch-reveal 0.9s ease-out",
  curtain: "dawati-curtain 0.9s ease-out",
  "gate-swing": "dawati-gate-swing 0.9s ease-out",
  "seal-break": "dawati-seal-break 0.9s ease-out",
  doors: "dawati-doors-reveal 0.9s ease-out",
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

function VinylIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-6 w-6"
      style={{ animation: spinning ? "dawati-vinyl-spin 3s linear infinite" : "none" }}
    >
      <circle cx="16" cy="16" r="15" fill="#111" />
      <circle cx="16" cy="16" r="11" fill="none" stroke="#333" strokeWidth="1" />
      <circle cx="16" cy="16" r="7.5" fill="none" stroke="#333" strokeWidth="1" />
      <circle cx="16" cy="16" r="4" fill="var(--color-accent)" />
      <circle cx="16" cy="16" r="1.4" fill="#111" />
    </svg>
  );
}

/**
 * Silent-by-default YouTube background music. The iframe is visually
 * hidden and never autoplays — playback only starts from the explicit
 * click on the vinyl toggle button, per product requirement.
 */
function MusicToggle({ videoId, label, pauseLabel }: { videoId: string; label: string; pauseLabel: string }) {
  const [playing, setPlaying] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  function toggle() {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const next = !playing;
    win.postMessage(JSON.stringify({ event: "command", func: next ? "playVideo" : "pauseVideo", args: [] }), "*");
    setPlaying(next);
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? pauseLabel : label}
        title={playing ? pauseLabel : label}
        className="fixed start-4 top-4 z-20 flex h-12 w-12 items-center justify-center rounded-full border shadow-lg"
        style={{ borderColor: "var(--color-accent)", background: "var(--color-surface)" }}
      >
        <VinylIcon spinning={playing} />
      </button>
      <iframe
        ref={iframeRef}
        src={`https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&controls=0&modestbranding=1&rel=0&playsinline=1`}
        style={{ position: "fixed", width: 1, height: 1, opacity: 0, pointerEvents: "none", bottom: 0 }}
        allow="autoplay"
        title="background-music"
      />
    </>
  );
}

/** Fires once a scene first crosses into the viewport; stays true afterward. */
function useInView<T extends HTMLElement>(threshold = 0.3) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

/** One full-height, scroll-snapped beat of the post-open guest experience. */
function Scene({ children, showHint = false }: { children: ReactNode; showHint?: boolean }) {
  const [ref, inView] = useInView<HTMLElement>();
  return (
    <section ref={ref} className={`dawati-scene${inView ? " dawati-scene-in-view" : ""}`}>
      {children}
      {showHint && (
        <span className="dawati-scroll-hint" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="var(--color-accent)" strokeWidth="1.5">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      )}
    </section>
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
  themeCategory,
  event,
  guest,
  status,
  qrDataUrl,
  mode = "live",
}: Props) {
  const [opened, setOpened] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [currentQr, setCurrentQr] = useState(qrDataUrl);
  const [rsvpError, setRsvpError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const countdown = useCountdown(event.eventDate);
  const g = dict.guest;

  function handleOpenClick() {
    setIsOpening(true);
    setTimeout(() => setOpened(true), OPENING_TRANSITION_MS);
  }

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
  const hasSealOpen = theme.motion.openStyle === "envelope" || theme.motion.openStyle === "seal-break";
  const hasDoors = theme.motion.openStyle === "doors";
  const hasShaderBg = theme.background?.effect === "shader-silk";

  if (!opened && hasDoors) {
    return (
      <div
        style={vars}
        className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--color-bg)] text-[var(--color-fg)]"
      >
        {hasShaderBg && <ShaderBackground deep={theme.palette.bg} mid={theme.palette.surface} highlight={theme.palette.accent} />}
        {themeCategory && (
          <ThemeDecor category={themeCategory} accent={theme.palette.accent} fgMuted={theme.palette.fgMuted} />
        )}
        <div className="absolute inset-0 flex">
          <div
            className="h-full w-1/2 border-e border-[var(--color-accent)]/30 bg-[var(--color-surface)]"
            style={{
              transformOrigin: "left center",
              animation: isOpening ? `dawati-door-left-open ${OPENING_TRANSITION_MS}ms cubic-bezier(0.4,0,0.2,1) forwards` : undefined,
            }}
          />
          <div
            className="h-full w-1/2 border-s border-[var(--color-accent)]/30 bg-[var(--color-surface)]"
            style={{
              transformOrigin: "right center",
              animation: isOpening ? `dawati-door-right-open ${OPENING_TRANSITION_MS}ms cubic-bezier(0.4,0,0.2,1) forwards` : undefined,
            }}
          />
        </div>
        <button
          type="button"
          onClick={handleOpenClick}
          disabled={isOpening}
          className="relative z-10 flex flex-col items-center gap-4"
          style={{ opacity: isOpening ? 0 : 1, transition: "opacity 0.4s ease" }}
        >
          <span
            className="flex h-24 w-24 items-center justify-center rounded-full border-2 bg-[var(--color-surface)]"
            style={{ borderColor: "var(--color-accent)" }}
          >
            <span className="text-sm font-medium tracking-widest text-[var(--color-accent)]" style={{ fontFamily: "var(--font-en-display)" }}>
              {event.groomNameEn.charAt(0)}&amp;{event.brideNameEn.charAt(0)}
            </span>
          </span>
          <span className="text-xs uppercase tracking-[0.3em] text-[var(--color-accent)]">{g.openInvitation}</span>
        </button>
      </div>
    );
  }

  if (!opened) {
    return (
      <div
        style={vars}
        className={
          isSplit
            ? "relative flex min-h-screen flex-row-reverse text-[var(--color-fg)]"
            : "relative flex min-h-screen flex-col items-center justify-center gap-8 bg-[var(--color-bg)] px-6 text-center text-[var(--color-fg)]"
        }
      >
        {hasShaderBg && <ShaderBackground deep={theme.palette.bg} mid={theme.palette.surface} highlight={theme.palette.accent} />}
        {themeCategory && (
          <ThemeDecor category={themeCategory} accent={theme.palette.accent} fgMuted={theme.palette.fgMuted} />
        )}
        {isSplit && <div className="w-3 shrink-0" style={{ background: "var(--color-accent)" }} />}
        <div
          className={
            isSplit
              ? "relative flex flex-1 flex-col items-start justify-center gap-8 bg-[var(--color-bg)] px-8 text-start"
              : "relative flex flex-col items-center gap-8"
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
          {hasSealOpen ? (
            <button
              type="button"
              onClick={handleOpenClick}
              disabled={isOpening}
              className="mt-6 flex flex-col items-center gap-3"
              style={{ animation: "dawati-fade-in 1.2s ease-out" }}
            >
              <span
                className="flex h-14 w-14 items-center justify-center rounded-full border-2"
                style={{
                  borderColor: "var(--color-accent)",
                  background: "var(--color-surface)",
                  animation: isOpening ? `dawati-seal-crack ${OPENING_TRANSITION_MS}ms ease-in forwards` : undefined,
                }}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="var(--color-accent)" strokeWidth="1.2">
                  <path d="M12 3 L14.5 9 L21 9.5 L16 14 L17.5 20.5 L12 17 L6.5 20.5 L8 14 L3 9.5 L9.5 9 Z" />
                </svg>
              </span>
              <span className="text-sm font-medium text-[var(--color-accent)]">{g.openInvitation}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setOpened(true)}
              className="mt-6 flex flex-col items-center gap-3"
              style={{ animation: "dawati-fade-in 1.2s ease-out" }}
            >
              <span className="text-xs font-medium uppercase tracking-[0.3em] text-[var(--color-accent)]">{g.openInvitation}</span>
              <span className="relative h-12 w-px overflow-hidden bg-[var(--color-accent)]/30">
                <span
                  className="absolute inset-x-0 top-0 h-3 w-full bg-[var(--color-accent)]"
                  style={{ animation: "dawati-open-scan 2s ease-in-out infinite" }}
                />
              </span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const hasMoreAfterDetails = currentStatus !== "ACCEPTED" && currentStatus !== "DECLINED";

  return (
    <div
      style={{ ...vars, animation: openAnimation }}
      className="relative h-screen overflow-hidden bg-[var(--color-bg)] text-[var(--color-fg)]"
    >
      {hasShaderBg && <ShaderBackground deep={theme.palette.bg} mid={theme.palette.surface} highlight={theme.palette.accent} />}
      {themeCategory && (
        <ThemeDecor category={themeCategory} accent={theme.palette.accent} fgMuted={theme.palette.fgMuted} />
      )}
      {event.musicYoutubeId && (
        <MusicToggle videoId={event.musicYoutubeId} label={g.playMusic} pauseLabel={g.pauseMusic} />
      )}
      {isSplit && (
        <div className="pointer-events-none fixed inset-y-0 end-0 z-10 w-2" style={{ background: "var(--color-accent)" }} />
      )}

      {/* Universal post-open flow: a scroll-snapped sequence of scenes, same
          structure for every theme — only palette/fonts/decoration differ. */}
      <div className="dawati-scene-container">
        <Scene showHint>
          <p className="text-lg" style={{ fontFamily: "var(--font-en-display)" }}>
            {event.groomNameEn} &amp; {event.brideNameEn}
          </p>
          <div className="h-px w-16" style={{ background: "var(--color-accent)" }} />
          <p className="max-w-md whitespace-pre-line leading-loose text-[var(--color-fg-muted)]">
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
        </Scene>

        <Scene showHint>
          <p className="text-sm uppercase tracking-[0.4em] text-[var(--color-accent)]" style={{ fontFamily: "var(--font-ar-body)" }}>
            {g.guestOf}
          </p>
          <div className="relative px-10 py-6">
            <span className="absolute start-0 top-0 h-4 w-4 border-s border-t" style={{ borderColor: "var(--color-accent)" }} />
            <span className="absolute end-0 top-0 h-4 w-4 border-e border-t" style={{ borderColor: "var(--color-accent)" }} />
            <span className="absolute start-0 bottom-0 h-4 w-4 border-s border-b" style={{ borderColor: "var(--color-accent)" }} />
            <span className="absolute end-0 bottom-0 h-4 w-4 border-e border-b" style={{ borderColor: "var(--color-accent)" }} />
            <h1 className="text-3xl leading-relaxed" style={{ fontFamily: "var(--font-ar-display)" }}>
              {guest.nameAr}
            </h1>
          </div>
        </Scene>

        <Scene showHint={hasMoreAfterDetails}>
          <div className="text-sm text-[var(--color-fg-muted)]">
            <p className="text-lg text-[var(--color-fg)]">
              {new Date(event.eventDate).toLocaleString("ar-SA", { dateStyle: "full", timeStyle: "short" })}
            </p>
            <p className="mt-2">{event.locationName}</p>
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
        </Scene>

        {hasMoreAfterDetails && (
          <Scene>
            {event.rsvpRequired ? (
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
          </Scene>
        )}

        {currentStatus === "ACCEPTED" && (
          <Scene>
            {currentQr || mode === "preview" ? (
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
            )}
          </Scene>
        )}

        {currentStatus === "DECLINED" && (
          <Scene>
            <p className="text-[var(--color-fg-muted)]">{g.thanksDecline}</p>
          </Scene>
        )}
      </div>
    </div>
  );
}
