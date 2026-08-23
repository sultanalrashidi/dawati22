"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { ThemeConfig } from "@/lib/themes/types";
import type { ScheduleItem } from "@/lib/events/types";
import { fontVarFor } from "@/lib/themes/fonts";
import { submitRsvpAction } from "@/lib/invitations/actions";
import { ThemeDecor } from "@/components/guest/theme-decor";
import { ShaderBackground } from "@/components/guest/shader-background";
import { FloatingParticles } from "@/components/guest/floating-particles";
import { SealedCard } from "@/components/guest/sealed-card";
import { RoseCandlelightBackground } from "@/components/guest/rose-candlelight-decor";
import { RoseCandlelightPass } from "@/components/guest/rose-candlelight-pass";
import { BridalFramePass } from "@/components/guest/bridal-frame-pass";
import { formatDualDate } from "@/lib/dates";

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
    groomNameAr?: string | null;
    groomFamilyAr?: string | null;
    brideNameAr?: string | null;
    brideFamilyAr?: string | null;
    familiesGreetingAr?: string | null;
    invitationTextAr: string;
    eventDate: string;
    locationName: string;
    regionName?: string | null;
    mapUrl: string | null;
    musicYoutubeId?: string | null;
    musicAutoplay?: boolean;
    scheduleItems?: ScheduleItem[] | null;
    notesAr?: string | null;
    rsvpRequired: boolean;
    allowGuestPartySize: boolean;
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

/** Deterministic grid standing in for a real QR in preview mode — styled like an
 * actual QR code (corner finder patterns + pseudo-random data modules) so it
 * reads unmistakably as "a QR code goes here" rather than an abstract pattern. */
function FakeQr({ className = "h-40 w-40" }: { className?: string }) {
  const SIZE = 21;
  const isFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= SIZE - 7) || (r >= SIZE - 7 && c < 7);
  const finderValue = (r: number, c: number) => {
    const localR = r < 7 ? r : r - (SIZE - 7);
    const localC = c < 7 ? c : c - (SIZE - 7);
    const onOuterRing = localR === 0 || localR === 6 || localC === 0 || localC === 6;
    const onInnerBlock = localR >= 2 && localR <= 4 && localC >= 2 && localC <= 4;
    return onOuterRing || onInnerBlock;
  };
  const cells = Array.from({ length: SIZE * SIZE }, (_, i) => {
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;
    if (isFinder(r, c)) return finderValue(r, c);
    return (r * 31 + c * 17 + r * c * 7) % 5 === 0;
  });
  return (
    <div className={`grid gap-[1px] bg-white p-2 ${className}`} style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}>
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
 * Background music via a visually hidden YouTube iframe. By default playback
 * only starts from an explicit click on the toggle button; when `autoplay`
 * is set (customer's choice) it starts immediately, riding the same user
 * gesture that opened the invitation so the browser allows unmuted audio.
 * The toggle itself is a labeled pill (icon + text), not just an icon, so
 * guests immediately recognize it controls the music rather than missing it.
 */
function MusicToggle({
  videoId,
  autoplay,
  label,
  pauseLabel,
}: {
  videoId: string;
  autoplay: boolean;
  label: string;
  pauseLabel: string;
}) {
  const [playing, setPlaying] = useState(autoplay);
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
        className="fixed left-4 top-4 z-20 flex h-11 items-center gap-2 rounded-full border px-3 shadow-lg"
        style={{ borderColor: "var(--color-accent)", background: "var(--color-surface)" }}
      >
        <VinylIcon spinning={playing} />
        <span className="text-xs font-medium uppercase tracking-[0.15em]" style={{ color: "var(--color-fg)" }}>
          Music
        </span>
      </button>
      <iframe
        ref={iframeRef}
        src={`https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&controls=0&modestbranding=1&rel=0&playsinline=1${autoplay ? "&autoplay=1" : ""}`}
        style={{ position: "fixed", width: 1, height: 1, opacity: 0, pointerEvents: "none", bottom: 0 }}
        allow="autoplay"
        title="background-music"
      />
    </>
  );
}

/**
 * Fires once a scene first crosses into the viewport; stays true afterward.
 * Low threshold on purpose — it should trigger early, while the scene is
 * still scrolling into place, so the CSS reveal transition (globals.css
 * `.dawati-scene`) finishes close to when the scroll-snap itself settles
 * instead of visibly continuing after the swipe has already stopped.
 */
function useInView<T extends HTMLElement>(threshold = 0.05) {
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
  const [rsvpName, setRsvpName] = useState(guest.nameAr);
  const [rsvpPhone, setRsvpPhone] = useState("");
  const [attending, setAttending] = useState<boolean | null>(null);
  const [rsvpPartySize, setRsvpPartySize] = useState(guest.allowedCount);
  const [rsvpMessage, setRsvpMessage] = useState("");
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

  function respond(
    response: "ACCEPTED" | "DECLINED",
    details: { guestNameAr?: string; guestPhone?: string; partySize?: number; messageAr?: string },
  ) {
    if (mode === "preview") {
      setCurrentStatus(response);
      return;
    }
    setRsvpError(null);
    startTransition(async () => {
      const result = await submitRsvpAction(linkToken!, response, details);
      if (!result.ok) {
        setRsvpError(g.rsvpError);
        return;
      }
      setCurrentStatus(response);
      if (result.qrDataUrl) setCurrentQr(result.qrDataUrl);
    });
  }

  function handleRsvpSubmit(e: FormEvent) {
    e.preventDefault();
    if (attending === null) return;
    respond(attending ? "ACCEPTED" : "DECLINED", {
      guestNameAr: rsvpName.trim() || undefined,
      guestPhone: rsvpPhone.trim() || undefined,
      partySize: attending ? rsvpPartySize : undefined,
      messageAr: rsvpMessage.trim() || undefined,
    });
  }

  const isArch = theme.layout === "arch-frame";
  const isEnvelope = theme.layout === "envelope-reveal";
  const isSplit = theme.layout === "split-portrait";
  const openAnimation = OPEN_ANIMATIONS[theme.motion.openStyle] ?? OPEN_ANIMATIONS.fade;
  const hasSealOpen = theme.motion.openStyle === "envelope" || theme.motion.openStyle === "seal-break";
  const hasDoors = theme.motion.openStyle === "doors";
  const hasShaderBg = theme.background?.effect === "shader-silk";
  const hasParticles = theme.particles?.effect === "floating-hearts";
  // The photographed background (lamp glow, candle flames) varies in
  // brightness behind the text in a way a flat theme color can't predict —
  // a soft dark shadow keeps every scene's text readable regardless of what's
  // behind it, without having to touch each text color individually. Only
  // rose-emboss sits on a photo background this way; bridal-frame's flat
  // illustrated scenes already have theme-tuned text colors and don't need it.
  const hasPhotoBg = theme.card?.style === "rose-emboss";
  // Color variants of a bespoke-card theme share this file's layout/logic —
  // only their asset subfolder (and the theme's own palette) differs.
  const roseAssetFolder = theme.card?.assetFolder ?? "rose-candlelight";
  const isBridalFrame = theme.card?.style === "bridal-frame";
  const openTextZone = theme.card?.layout?.openTextZone ?? { insetX: "24%", top: "15%", bottom: "30%" };

  // Themes with a bespoke ThemeConfig.card design get the newer SealedCard
  // opening screen; every other theme keeps its original cover UI below
  // untouched.
  if (!opened && theme.card?.style) {
    return (
      <div
        style={vars}
        className="relative flex min-h-dvh flex-col items-center justify-center gap-8 bg-[var(--color-bg)] px-6 text-center text-[var(--color-fg)]"
      >
        {hasShaderBg && <ShaderBackground deep={theme.palette.bg} mid={theme.palette.surface} highlight={theme.palette.accent} />}
        {hasParticles && <FloatingParticles accent={theme.palette.accent} />}
        <RoseCandlelightBackground assetFolder={roseAssetFolder} />
        {event.musicYoutubeId && (
          <MusicToggle videoId={event.musicYoutubeId} autoplay={Boolean(event.musicAutoplay)} label={g.playMusic} pauseLabel={g.pauseMusic} />
        )}
        <SealedCard
          style={theme.card.style}
          accent={theme.palette.accent}
          accentFg={theme.palette.accentFg}
          surface={theme.palette.surface}
          fg={theme.palette.fg}
          groomInitial={event.groomNameEn.charAt(0)}
          brideInitial={event.brideNameEn.charAt(0)}
          label={g.openInvitation}
          isOpening={isOpening}
          onOpen={handleOpenClick}
          assetFolder={roseAssetFolder}
          closedAspect={theme.card.layout?.closedAspect}
          sealPosition={theme.card.layout?.sealPosition}
          sealFontSize={theme.card.layout?.sealFontSize}
        />
      </div>
    );
  }

  if (!opened && hasDoors) {
    return (
      <div
        style={vars}
        className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[var(--color-bg)] text-[var(--color-fg)]"
      >
        {hasShaderBg && <ShaderBackground deep={theme.palette.bg} mid={theme.palette.surface} highlight={theme.palette.accent} />}
        {hasParticles && <FloatingParticles accent={theme.palette.accent} />}
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
            ? "relative flex min-h-dvh flex-row-reverse text-[var(--color-fg)]"
            : "relative flex min-h-dvh flex-col items-center justify-center gap-8 bg-[var(--color-bg)] px-6 text-center text-[var(--color-fg)]"
        }
      >
        {hasShaderBg && <ShaderBackground deep={theme.palette.bg} mid={theme.palette.surface} highlight={theme.palette.accent} />}
        {hasParticles && <FloatingParticles accent={theme.palette.accent} />}
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

  const dual = formatDualDate(new Date(event.eventDate));
  const hasSchedule = Boolean(event.scheduleItems && event.scheduleItems.length > 0);
  const notesList = (event.notesAr ?? "").split("\n").map((n) => n.trim()).filter(Boolean);
  const hasNotes = notesList.length > 0;
  const hasResponded = currentStatus === "ACCEPTED" || currentStatus === "DECLINED";
  const hasRsvpForm = !hasResponded && event.rsvpRequired;
  const somethingFollowsDetails = hasSchedule || hasNotes || hasRsvpForm || hasResponded;
  const somethingFollowsSchedule = hasNotes || hasRsvpForm || hasResponded;
  const somethingFollowsNotes = hasRsvpForm || hasResponded;
  const calendarUrl = linkToken ? `/i/${linkToken}/calendar` : undefined;
  const groomLabel = event.groomNameAr || event.groomNameEn;
  const brideLabel = event.brideNameAr || event.brideNameEn;

  return (
    <div
      style={{ ...vars, animation: openAnimation }}
      className="relative h-dvh overflow-hidden bg-[var(--color-bg)] text-[var(--color-fg)]"
    >
      {hasShaderBg && <ShaderBackground deep={theme.palette.bg} mid={theme.palette.surface} highlight={theme.palette.accent} />}
      {hasParticles && <FloatingParticles accent={theme.palette.accent} />}
      {theme.card?.style ? (
        <RoseCandlelightBackground assetFolder={roseAssetFolder} />
      ) : (
        themeCategory && <ThemeDecor category={themeCategory} accent={theme.palette.accent} fgMuted={theme.palette.fgMuted} />
      )}
      {event.musicYoutubeId && (
        <MusicToggle
          videoId={event.musicYoutubeId}
          autoplay={Boolean(event.musicAutoplay)}
          label={g.playMusic}
          pauseLabel={g.pauseMusic}
        />
      )}
      {isSplit && (
        <div className="pointer-events-none fixed inset-y-0 end-0 z-10 w-2" style={{ background: "var(--color-accent)" }} />
      )}

      {/* Universal post-open flow: a scroll-snapped sequence of scenes, same
          structure for every theme — only palette/fonts/decoration differ. */}
      <div className="dawati-scene-container" style={hasPhotoBg ? { textShadow: "0 1px 4px rgba(0,0,0,0.6)" } : undefined}>
        {/* Scene 1: the guest's own named card — same shared background as
            every other scene; the rose-emboss theme shows its opened-envelope
            card photo with the same text written across its blank paper. */}
        <Scene showHint>
          {isBridalFrame ? (
            <div className="relative w-[320px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/themes/${roseAssetFolder}/envelope-open.webp`} alt="" className="block w-full" />
              {/* ink color follows the theme's own fg/fgMuted so it reads on both the
                  light ivory-bloom card and the dark (navy/burgundy/mocha/noir) variants;
                  no drop shadow needed here — cancel the scene-wide one */}
              <div
                className="absolute flex flex-col items-center justify-center gap-1.5 text-center"
                style={{
                  insetInlineStart: openTextZone.insetX,
                  insetInlineEnd: openTextZone.insetX,
                  top: openTextZone.top,
                  bottom: openTextZone.bottom,
                  textShadow: "none",
                }}
              >
                <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "var(--color-fg-muted)", fontFamily: "var(--font-ar-body)" }}>
                  {g.guestOf}
                </p>
                <h1 className="text-lg leading-snug sm:text-xl" style={{ color: "var(--color-fg)", fontFamily: "var(--font-ar-display)" }}>
                  {guest.nameAr}
                </h1>
                <p className="text-[11px] leading-relaxed sm:text-xs" style={{ color: "var(--color-fg-muted)", fontFamily: "var(--font-ar-body)" }}>
                  {g.guestWelcome}
                </p>
              </div>
            </div>
          ) : theme.card?.style === "rose-emboss" ? (
            <div className="relative w-[370px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/themes/${roseAssetFolder}/envelope-open.webp`} alt="" className="block w-full" />
              {/* dark ink on light paper needs no drop shadow — cancel the scene-wide one */}
              <div className="absolute inset-x-[18%] top-[37%] flex flex-col items-center gap-1.5 text-center" style={{ textShadow: "none" }}>
                <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "#8a5a3a", fontFamily: "var(--font-ar-body)" }}>
                  {g.guestOf}
                </p>
                <h1 className="text-lg leading-snug sm:text-xl" style={{ color: "#3d2417", fontFamily: "var(--font-ar-display)" }}>
                  {guest.nameAr}
                </h1>
                <p className="text-[11px] leading-relaxed sm:text-xs" style={{ color: "#6b4530", fontFamily: "var(--font-ar-body)" }}>
                  {g.guestWelcome}
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm uppercase tracking-[0.4em] text-[var(--color-accent)]" style={{ fontFamily: "var(--font-ar-body)" }}>
                {g.guestOf}
              </p>
              <h1 className="text-3xl leading-relaxed" style={{ fontFamily: "var(--font-ar-display)" }}>
                {guest.nameAr}
              </h1>
            </>
          )}
        </Scene>

        {/* Scene 2: blessing, invitation text, couple names, date */}
        <Scene showHint>
          {event.familiesGreetingAr && (
            <p className="max-w-md text-2xl leading-relaxed" style={{ fontFamily: "var(--font-ar-display)" }}>
              {event.familiesGreetingAr}
            </p>
          )}
          <p className="max-w-md whitespace-pre-line leading-loose text-[var(--color-fg-muted)]">
            {event.invitationTextAr}
          </p>
          <div className="flex items-center justify-center gap-4">
            <p className="text-2xl" style={{ fontFamily: "var(--font-ar-display)" }}>{brideLabel}</p>
            <div className="h-8 w-px" style={{ background: "var(--color-accent)", opacity: 0.5 }} />
            <p className="text-2xl" style={{ fontFamily: "var(--font-ar-display)" }}>{groomLabel}</p>
          </div>
          <div className="mt-2 text-center">
            <p className="text-lg text-[var(--color-fg)]">{dual.gregorian}</p>
            <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{dual.hijri}</p>
          </div>
        </Scene>

        {/* Scene 3: countdown */}
        <Scene showHint>
          <h2 className="text-xl text-[var(--color-fg-muted)]">{g.countdownTitle}</h2>
          {countdown && (
            <div className="flex gap-4 rounded-2xl border border-[var(--color-accent)]/30 px-6 py-4">
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

        {/* Scene 4: everything you need to know */}
        <Scene showHint={somethingFollowsDetails}>
          <h2 className="text-2xl" style={{ fontFamily: "var(--font-ar-display)" }}>{g.detailsHeading}</h2>
          <div className="text-sm text-[var(--color-fg-muted)]">
            <p className="text-lg text-[var(--color-fg)]">{dual.gregorian} — {dual.time}</p>
            <p className="mt-2">
              {event.locationName}
              {event.regionName ? ` — ${event.regionName}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
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
            {(calendarUrl || mode === "preview") && (
              <a
                href={calendarUrl ?? "#"}
                onClick={calendarUrl ? undefined : (e) => e.preventDefault()}
                className="h-11 items-center rounded-full border border-[var(--color-fg-muted)]/40 px-6 text-sm font-medium text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] inline-flex"
              >
                {g.addToCalendar}
              </a>
            )}
          </div>
        </Scene>

        {/* Scene 5: event schedule (only if the organizer set one) */}
        {hasSchedule && (
          <Scene showHint={somethingFollowsSchedule}>
            <h2 className="text-2xl" style={{ fontFamily: "var(--font-ar-display)" }}>{g.scheduleHeading}</h2>
            <div className="flex w-full max-w-xs flex-col gap-3">
              {event.scheduleItems!.map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-6 border-b border-[var(--color-accent)]/20 pb-2">
                  <span>{item.labelAr}</span>
                  <span className="text-[var(--color-fg-muted)]">{item.time}</span>
                </div>
              ))}
            </div>
          </Scene>
        )}

        {/* Scene 6: notes for guests (only if the organizer set any) */}
        {hasNotes && (
          <Scene showHint={somethingFollowsNotes}>
            <h2 className="text-2xl" style={{ fontFamily: "var(--font-ar-display)" }}>{g.notesHeading}</h2>
            <ul className="flex flex-col gap-2 text-[var(--color-fg-muted)]">
              {notesList.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </Scene>
        )}

        {/* Scene 7: RSVP form */}
        {hasRsvpForm && (
          <Scene>
            <h2 className="text-2xl" style={{ fontFamily: "var(--font-ar-display)" }}>{g.rsvpHeading}</h2>
            <form onSubmit={handleRsvpSubmit} className="flex w-full max-w-sm flex-col gap-4 text-start">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-[var(--color-fg-muted)]">{g.rsvpNameLabel}</span>
                <input
                  value={rsvpName}
                  onChange={(e) => setRsvpName(e.target.value)}
                  required
                  className="h-11 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-surface)] px-3 text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-[var(--color-fg-muted)]">{g.rsvpPhoneLabel}</span>
                <input
                  type="tel"
                  dir="ltr"
                  value={rsvpPhone}
                  onChange={(e) => setRsvpPhone(e.target.value)}
                  className="h-11 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-surface)] px-3 text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]"
                />
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setAttending(true)}
                  aria-pressed={attending === true}
                  className="h-11 flex-1 rounded-full text-sm font-medium transition-colors"
                  style={
                    attending === true
                      ? { background: "var(--color-accent)", color: "var(--color-accent-fg)" }
                      : { border: "1px solid var(--color-accent)", color: "var(--color-accent)" }
                  }
                >
                  {g.attendingChoice}
                </button>
                <button
                  type="button"
                  onClick={() => setAttending(false)}
                  aria-pressed={attending === false}
                  className="h-11 flex-1 rounded-full text-sm font-medium transition-colors"
                  style={
                    attending === false
                      ? { background: "var(--color-fg-muted)", color: "var(--color-bg)" }
                      : { border: "1px solid var(--color-fg-muted)", color: "var(--color-fg-muted)" }
                  }
                >
                  {g.decline}
                </button>
              </div>
              {attending === true && guest.allowedCount > 1 && event.allowGuestPartySize && (
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-[var(--color-fg-muted)]">{g.rsvpPartySizeLabel}</span>
                  <select
                    value={rsvpPartySize}
                    onChange={(e) => setRsvpPartySize(Number(e.target.value))}
                    className="h-11 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-surface)] px-3 text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]"
                  >
                    {Array.from({ length: guest.allowedCount }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-[var(--color-fg-muted)]">{g.rsvpMessageLabel}</span>
                <textarea
                  value={rsvpMessage}
                  onChange={(e) => setRsvpMessage(e.target.value)}
                  rows={3}
                  placeholder={g.rsvpMessagePlaceholder}
                  className="rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-surface)] px-3 py-2 text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]"
                />
              </label>
              <button
                type="submit"
                disabled={attending === null || isPending}
                className="h-11 rounded-full text-sm font-medium disabled:opacity-50"
                style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)" }}
              >
                {g.rsvpSubmit}
              </button>
              {rsvpError && <p className="text-sm text-red-400">{rsvpError}</p>}
            </form>
          </Scene>
        )}

        {currentStatus === "ACCEPTED" && (
          <Scene>
            {currentQr || mode === "preview" ? (
              theme.card?.style === "rose-emboss" ? (
                <RoseCandlelightPass
                  groomLabel={groomLabel}
                  brideLabel={brideLabel}
                  invitationTextAr={event.invitationTextAr}
                  placeText={event.locationName + (event.regionName ? ` — ${event.regionName}` : "")}
                  dateText={dual.gregorian.split("، ").pop() ?? dual.gregorian}
                  timeText={dual.time}
                  qrNode={currentQr ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentQr} alt="QR" className="h-full w-full object-contain" />
                  ) : (
                    <FakeQr className="h-full w-full" />
                  )}
                  fontAr="var(--font-ar-body)"
                  nameFont="var(--font-ar-display)"
                  godWillingLabel={g.passGodWilling}
                  placeLabel={g.passPlaceLabel}
                  dateLabel={g.passDateLabel}
                  timeLabel={g.passTimeLabel}
                  assetFolder={roseAssetFolder}
                />
              ) : isBridalFrame ? (
                <BridalFramePass
                  groomLabel={groomLabel}
                  brideLabel={brideLabel}
                  invitationTextAr={event.invitationTextAr}
                  placeText={event.locationName + (event.regionName ? ` — ${event.regionName}` : "")}
                  dateText={dual.gregorian.split("، ").pop() ?? dual.gregorian}
                  timeText={dual.time}
                  qrNode={currentQr ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentQr} alt="QR" className="h-full w-full object-contain" />
                  ) : (
                    <FakeQr className="h-full w-full" />
                  )}
                  fontAr="var(--font-ar-body)"
                  nameFont="var(--font-ar-display)"
                  godWillingLabel={g.passGodWilling}
                  placeLabel={g.passPlaceLabel}
                  dateLabel={g.passDateLabel}
                  timeLabel={g.passTimeLabel}
                  assetFolder={roseAssetFolder}
                  layout={theme.card?.layout?.pass}
                />
              ) : (
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
              )
            ) : (
              <p className="text-[var(--color-accent)]">{g.thanksAccept}</p>
            )}
            {(theme.card?.style === "rose-emboss" || isBridalFrame) && (currentQr || mode === "preview") && (
              <p className="mt-3 text-xs text-[var(--color-fg-muted)]">{g.passShowAtEntry}</p>
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
