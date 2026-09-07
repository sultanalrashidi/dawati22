"use client";

import Image from "next/image";
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
import { MusicFrame, useBackgroundMusic, type BackgroundMusic } from "@/components/guest/background-music";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { ThemeConfig } from "@/lib/themes/types";
import type { ScheduleItem } from "@/lib/events/types";
import { fontVarFor } from "@/lib/themes/fonts";
import { fontStackFor } from "@/lib/themes/font-registry";
import { ThemeStage } from "@/components/themes/builder/theme-stage";
import type { RsvpResponse, StageRsvp } from "@/components/themes/builder/layers/rsvp-layer";
import {
  closingText,
  composeHostLine,
  DEFAULT_MUSIC_YOUTUBE_ID,
  coupleLineFor,
  INSHALLAH,
  INVITE_VERB,
  openingText,
  resolveContent,
  type CoupleInput,
  type InvitationTextFields,
  type ResolvedContent,
} from "@/lib/themes/builder/content";
import type { LayoutOverrides } from "@/lib/themes/builder/resolve";
import {
  breakpointForWidth,
  type Breakpoint,
  type LayoutDoc,
  type SceneCanvas,
  type SceneDef,
  type SceneId,
  type SceneRequirement,
  type TypographyDoc,
  type VariantPalette,
} from "@/lib/themes/builder/types";
import { submitRsvpAction } from "@/lib/invitations/actions";
import { ThemeDecor } from "@/components/guest/theme-decor";
import { ShaderBackground } from "@/components/guest/shader-background";
import { FloatingParticles } from "@/components/guest/floating-particles";
import { SealedCard } from "@/components/guest/sealed-card";
import { PreviewWatermark } from "@/components/guest/preview-watermark";
import { RoseCandlelightBackground } from "@/components/guest/rose-candlelight-decor";
import { BuilderPageBackground, pageBackgroundUrl } from "@/components/guest/builder-page-background";
import { RoseCandlelightPass } from "@/components/guest/rose-candlelight-pass";
import { BridalFramePass } from "@/components/guest/bridal-frame-pass";
import { formatDualDate } from "@/lib/dates";

/**
 * Is a layer actually reachable by a guest?
 *
 * Used to decide whether a designed RSVP block can be trusted to take the
 * booking. A block at 0.4% width, at 250% off the stage, or at zero opacity
 * technically exists but no guest can fill it in, and treating it as present
 * would suppress the fallback form and silently break bookings for that theme.
 */
function isUsableLayer(layer: { visible: boolean; base: { width: number; height: number | null; x: number; y: number; opacity: number; scale: number } }): boolean {
  if (!layer.visible) return false;
  const { width, height, x, y, opacity, scale } = layer.base;
  if (opacity < 0.15 || scale < 0.2) return false;
  if (width < 15) return false;
  if (height !== null && height < 8) return false;
  // Centre must be on the stage, with a little slack for a deliberate bleed.
  return x > -10 && x < 110 && y > -10 && y < 110;
}

/**
 * The first letter for a seal monogram. The English names are optional now,
 * so an empty one falls back to the Arabic given name rather than leaving the
 * seal with a lone "&". Spread into code points, not `charAt`, so a name that
 * starts outside the BMP can never yield half a surrogate pair.
 */
function initialOf(nameEn: string, nameAr: string | null | undefined): string {
  const name = nameEn.trim() || (nameAr ?? "").trim();
  return [...name][0] ?? "";
}

type GuestFacingStatus = "DRAFT" | "SENT" | "VIEWED" | "ACCEPTED" | "DECLINED";

/**
 * A BUILDER-engine theme's stored design, already resolved for one color
 * variant (see lib/themes/builder/guest.ts). Present only for builder themes;
 * LEGACY themes never pass it and every branch below stays as it was.
 */
export interface BuilderTheme {
  layout: LayoutDoc;
  typography: TypographyDoc;
  palette: VariantPalette;
  /** slot → image url. */
  assets: Record<string, string>;
  overrides?: LayoutOverrides;
}

interface Props {
  dict: Dictionary;
  /** Required in "live" mode (default); unused in "preview" mode. */
  linkToken?: string;
  theme: ThemeConfig;
  /** Theme.category — drives which decorative motif kit renders (see theme-decor.tsx). */
  themeCategory?: string;
  /**
   * The wording columns (`Partial<InvitationTextFields>`: opening, host mode
   * and mothers, couple format, closing) are all optional so every existing
   * caller compiles; an event that predates them renders with the defaults —
   * the verse, no host line, "فيصل على نورة", the default closing.
   */
  event: Partial<InvitationTextFields> & {
    name: string;
    /**
     * Every couple this invitation announces — a joint wedding names more than
     * one. Ordered, never empty, `couples[0]` primary; build it with
     * `couplesFor(event)` (lib/events/service.ts), which synthesises the single
     * entry for an event that predates the EventCouple table.
     */
    couples: CoupleInput[];
    /**
     * The primary couple's own Event columns. Still here because the legacy
     * cover screens (sealed card, doors, plain) read the initials straight off
     * them; they always mirror `couples[0]`. The English names may be "".
     */
    groomNameEn: string;
    brideNameEn: string;
    groomNameAr?: string | null;
    groomFamilyAr?: string | null;
    brideNameAr?: string | null;
    brideFamilyAr?: string | null;
    /** Legacy — no longer written by the form; only old builder docs print it. */
    familiesGreetingAr?: string | null;
    /** Optional extra text under the composed invitation line; "" when none. */
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
  /**
   * Whether this event was sold with a scannable entry pass. False events still
   * get the whole pass card — names, date, venue, seats — the printed frame on
   * the card art just carries the guest's name instead of a code. Defaults true
   * so the theme previews and every existing caller are unaffected.
   */
  hasQr?: boolean;
  qrDataUrl: string | null;
  /**
   * Whether the Google Wallet issuer credentials are live. Off by default, so
   * every existing caller — previews, tests, the theme gallery — renders
   * exactly as before, and the button appears only once the issuer account is
   * approved and configured in the environment.
   */
  walletEnabled?: boolean;
  /**
   * Set for BUILDER themes only. The whole invitation then comes from the
   * admin's own document: the cover, every post-open screen in the order the
   * scene list gives them, and the entry pass. LEGACY themes never pass it and
   * keep the hand-coded Scenes 1–7 below, unchanged.
   */
  builder?: BuilderTheme;
  /**
   * "preview" is used by the admin theme editor and the customer theme
   * pickers to show the real interactive experience with sample content —
   * RSVP is simulated locally and never touches the server.
   */
  mode?: "live" | "preview";
  /**
   * Stamps the whole invitation as an unpaid trial copy. Set for a draft's
   * preview and dropped the moment the invitation is activated — the customer
   * asked for exactly that: protected before payment, clean after it.
   */
  watermark?: { primary: string; secondary: string };
  /**
   * Says so, at the two places where this rendering would otherwise claim
   * something it cannot deliver: the reply form (which records nothing) and
   * the entry pass (whose code no scanner accepts).
   *
   * Set only by the owner's test invitation — the link she forwards to her
   * mother to see what a guest gets. Everything else on the screen stays
   * exactly as a guest receives it, which is the point of the link.
   */
  testCopy?: boolean;
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

/**
 * What goes in the printed frame on the card art when the event was sold
 * WITHOUT a scannable code.
 *
 * The frame is part of the artwork — a rounded square printed near the bottom
 * of every pass card — so leaving it empty looks like a printing fault rather
 * than a cheaper tier. It carries the two things a human on the door actually
 * needs off a paper-style pass: who this is, and how many they may bring in.
 */
function PassholderTag({
  nameLabel,
  name,
  seatsLabel,
  seats,
}: {
  nameLabel: string;
  name: string;
  seatsLabel: string;
  seats: number;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[0.15em] break-words px-[6%] text-center leading-tight">
      <span className="text-[7px] sm:text-[8px]" style={{ color: "var(--color-fg-muted)" }}>
        {nameLabel}
      </span>
      <span className="text-[10px] font-medium sm:text-xs" style={{ color: "var(--color-fg)" }}>
        {name}
      </span>
      <span className="text-[7px] sm:text-[8px]" style={{ color: "var(--color-fg-muted)" }}>
        {seatsLabel} · {seats}
      </span>
    </div>
  );
}

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
 * The Music pill. The player itself lives in <MusicFrame>, mounted once above
 * every screen — see background-music.tsx for why the two are separate.
 *
 * The toggle is a labeled pill (icon + text), not just an icon, so guests
 * immediately recognize it controls the music rather than missing it.
 */
function MusicToggle({
  label,
  pauseLabel,
  playing,
  onToggle,
}: {
  label: string;
  pauseLabel: string;
  /** The player's real state, so the pill can never announce silence as sound. */
  playing: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={playing ? pauseLabel : label}
      title={playing ? pauseLabel : label}
      className="fixed left-4 top-4 z-20 flex h-11 items-center gap-2 rounded-full border px-3 shadow-lg"
      style={{ borderColor: "var(--color-accent)", background: "var(--color-surface)" }}
    >
      <VinylIcon spinning={playing} />
      <span className="text-xs font-medium tracking-[0.06em]" style={{ color: "var(--color-fg)" }}>
        {playing ? pauseLabel : label}
      </span>
    </button>
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

/**
 * Which breakpoint's layer overrides a builder stage should use. Always "base"
 * for the first render — the server has no viewport — so the client's initial
 * markup matches the HTML it hydrates; the real value lands right after.
 */
function useStageBreakpoint(enabled: boolean): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("base");
  useEffect(() => {
    // Legacy themes have no stage to re-measure — don't make them listen.
    if (!enabled) return;
    const update = () => setBreakpoint(breakpointForWidth(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [enabled]);
  return breakpoint;
}

/**
 * A builder stage is a fixed-aspect box that fills the width it's given, so on
 * a short screen a tall scene would run off the bottom. Capping the *width* by
 * the space left after the surrounding chrome keeps the whole design visible
 * without touching the layout document's own proportions.
 */
function stageMaxWidth(canvas: SceneCanvas, reserve: string) {
  return `min(26rem, calc((100dvh - ${reserve}) * ${canvas.aspectW} / ${canvas.aspectH}))`;
}

/**
 * What a stage needs from the invitation beyond its text content.
 *
 * A builder scene can now carry a live countdown, action buttons, the event
 * schedule, the organiser's notes and the real RSVP form, so the renderer
 * needs the same event and guest data the hand-coded scenes read. It is
 * assembled once per render and handed to every stage, so a layer behaves
 * identically on whichever scene the admin dropped it.
 *
 * The nullable fields are deliberately never `undefined` here: `<ThemeStage>`
 * reads absent as "no event attached" and shows samples, which is right for the
 * editor and wrong for a guest — a guest must never read an invented schedule.
 */
interface StageData {
  eventDateIso: string;
  linkToken: string | null;
  mapUrl: string | null;
  scheduleItems: ScheduleItem[] | null;
  notesAr: string | null;
  rsvp: StageRsvp;
  /** Non-null once the guest answers; the RSVP block then thanks them in place. */
  rsvpResponded: "ACCEPTED" | "DECLINED" | null;
  onToggleMusic: (() => void) | null;
  musicPlaying: boolean;
}

/**
 * The post-open screens a builder theme shows THIS guest: its `flow` scenes in
 * the admin's own order, minus the ones hidden in the editor and the ones whose
 * required event data this event doesn't carry — the same "no schedule, no
 * schedule screen" rule the hand-coded flow has always applied, now declared in
 * the document instead of hard-coded here.
 *
 * Filtering into a list up front, rather than returning null per scene inside
 * the map, is what stops a skipped scene from leaving an empty scroll-snap slot
 * for the guest to swipe past.
 */
function visibleFlowScenes(layout: LayoutDoc, has: Record<SceneRequirement, boolean>): SceneDef[] {
  return layout.scenes.filter(
    (scene) => scene.role === "flow" && scene.visible && (scene.requires === null || has[scene.requires]),
  );
}

/** One builder scene, with the per-variant resolution already applied. */
function BuilderStage({
  builder,
  scene,
  content,
  breakpoint,
  qrDataUrl,
  hasQr = true,
  data,
}: {
  builder: BuilderTheme;
  scene: SceneId;
  content: ResolvedContent;
  breakpoint: Breakpoint;
  qrDataUrl?: string | null;
  /** False drops the scene's `qr` layers — see ThemeStage for why. */
  hasQr?: boolean;
  data: StageData;
}) {
  // `<ThemeStage>` paints `palette.bg` on the stage box. That is right for a
  // theme whose scenes stand on a flat colour, but with a page background in
  // play it would drop an opaque rectangle on top of the full-bleed art — the
  // exact "flat colour, no theme art" the customer reported. Its own `style`
  // prop is spread last, so handing it a transparent background wins.
  const overPageBackground = pageBackgroundUrl(builder.layout.page, builder.assets) !== null;

  return (
    <ThemeStage
      scene={scene}
      layout={builder.layout}
      typography={builder.typography}
      palette={builder.palette}
      assets={builder.assets}
      overrides={builder.overrides}
      content={content}
      breakpoint={breakpoint}
      qrDataUrl={qrDataUrl}
      hasQr={hasQr}
      eventDateIso={data.eventDateIso}
      linkToken={data.linkToken}
      mapUrl={data.mapUrl}
      scheduleItems={data.scheduleItems}
      notesAr={data.notesAr}
      rsvp={data.rsvp}
      rsvpResponded={data.rsvpResponded}
      onToggleMusic={data.onToggleMusic}
      musicPlaying={data.musicPlaying}
      style={overPageBackground ? { backgroundColor: "transparent" } : undefined}
    />
  );
}

/**
 * The player and the Music pill are mounted HERE, as siblings of the whole
 * screen tree, and nowhere else.
 *
 * `InvitationScreens` below returns five mutually exclusive screens through
 * early `return`s — four covers and the opened invitation. Rendering the
 * player inside those branches, as this used to, meant React tore the iframe
 * down and built a new one the instant the guest opened the invitation:
 * whatever was playing stopped dead at the reveal, and the replacement player
 * came up cold. Two of the four covers did not render it at all, so for those
 * themes the player did not exist until 650ms after the tap — long after the
 * gesture that could have started it was gone.
 *
 * Above the branches, the player is mounted once, on the first paint, and
 * survives every screen change for the life of the page.
 */
export function InvitationView(props: Props) {
  // Every invitation has a song. A customer who has not chosen one gets the
  // house track rather than silence, because an envelope that opens without
  // music is the single biggest difference between this and a printed card —
  // and "she did not paste a YouTube link" is not a request for silence.
  const videoId = props.event.musicYoutubeId ?? DEFAULT_MUSIC_YOUTUBE_ID;
  const music = useBackgroundMusic(videoId);
  const g = props.dict.guest;

  return (
    <>
      {music.enabled && <MusicFrame videoId={videoId} frameRef={music.frameRef} />}
      {music.enabled && (
        <MusicToggle
          label={g.playMusic}
          pauseLabel={g.pauseMusic}
          playing={music.playing}
          onToggle={music.toggle}
        />
      )}
      <InvitationScreens {...props} music={music} />
      {/* Above the screens, not inside them: the five screens are mutually
          exclusive, so one mount here covers every one of them — including the
          entry pass, which is the screen most worth stamping. */}
      {props.watermark && (
        <PreviewWatermark primary={props.watermark.primary} secondary={props.watermark.secondary} />
      )}
    </>
  );
}

function InvitationScreens({
  dict,
  linkToken,
  theme,
  themeCategory,
  event,
  guest,
  status,
  hasQr = true,
  qrDataUrl,
  walletEnabled = false,
  mode = "live",
  testCopy = false,
  builder,
  music,
}: Props & { music: BackgroundMusic }) {
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
  const breakpoint = useStageBreakpoint(Boolean(builder));
  const g = dict.guest;

  // Answering the RSVP appends the outcome — the entry pass, or the decline
  // note — as the LAST scene, below wherever the guest currently is. Without
  // help they are left staring at the form's thank-you state, with the pass
  // hidden somewhere further down; this pair scrolls them to it the moment
  // their answer lands. A ref (not state) because it must not survive a
  // re-render it didn't cause: only a fresh answer scrolls, never a reload of
  // an invitation that was answered days ago.
  const sceneContainerRef = useRef<HTMLDivElement>(null);
  const scrollToOutcomeRef = useRef(false);
  useEffect(() => {
    if (!scrollToOutcomeRef.current) return;
    if (currentStatus !== "ACCEPTED" && currentStatus !== "DECLINED") return;
    scrollToOutcomeRef.current = false;
    const el = sceneContainerRef.current;
    // The outcome scene is always the container's final screen, and every
    // scene is exactly one viewport tall — so "the end" IS the pass, whether
    // or not its artwork has loaded yet.
    el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [currentStatus]);

  // Server callers hand us a non-empty list; rebuilding one from the event's
  // own columns keeps a malformed caller from blanking the names out entirely.
  const couples = useMemo<CoupleInput[]>(
    () =>
      event.couples.length > 0
        ? event.couples
        : [
            {
              groomNameEn: event.groomNameEn,
              brideNameEn: event.brideNameEn,
              groomNameAr: event.groomNameAr ?? null,
              groomFamilyAr: event.groomFamilyAr ?? null,
              brideNameAr: event.brideNameAr ?? null,
              brideFamilyAr: event.brideFamilyAr ?? null,
            },
          ],
    [event],
  );

  // The stage prints real invitation data rather than baked-in text, so the
  // same design serves every couple.
  const builderContent = useMemo<ResolvedContent | null>(
    () =>
      builder
        ? resolveContent({
            guestName: guest.nameAr,
            couples,
            openingKind: event.openingKind,
            hostMode: event.hostMode,
            groomMotherAr: event.groomMotherAr ?? null,
            brideMotherAr: event.brideMotherAr ?? null,
            hostLineAr: event.hostLineAr ?? null,
            coupleFormat: event.coupleFormat,
            closingAr: event.closingAr ?? null,
            familiesGreetingAr: event.familiesGreetingAr ?? null,
            invitationTextAr: event.invitationTextAr,
            eventDate: event.eventDate,
            locationName: event.locationName,
            regionName: event.regionName ?? null,
          })
        : null,
    [builder, couples, event, guest],
  );

  // The composed wording the LEGACY screens print — the same helpers the
  // builder stage, the WhatsApp message and the ICS description use, so the
  // guest reads one sentence wherever she meets it.
  const hostLine = composeHostLine(event);
  const extraText = event.invitationTextAr.trim();
  // The hand-coded pass cards print the couple's names themselves, right under
  // this line, so it stops at the verb: repeating the names inside the text
  // would print them twice in a band with room for one.
  //
  // And it is ALWAYS this line, never the host's free text: that band is a
  // fixed slot in the printed card art at 9px, with the names positioned
  // under it, so it holds exactly one line — appending would push the names
  // into the artwork, and substituting used to delete both mothers from the
  // pass the moment she typed a word of her own. Her extra text still prints
  // on the invitation itself and in the WhatsApp message.
  const passInviteText = [hostLine, INVITE_VERB].filter(Boolean).join(" ").replace(/\s+/g, " ");

  /**
   * The one way the invitation opens. Every cover routes through here — the
   * plainest one used to call `setOpened` directly, which meant its guests got
   * no music at all no matter what the customer had chosen.
   *
   * `animate: false` is that plain cover, which reveals instantly instead of
   * playing the 650ms seal animation.
   */
  function openInvitation({ animate = true }: { animate?: boolean } = {}) {
    // FIRST, and synchronously: this call sits inside the guest's tap, which
    // is the only moment a mobile browser will let unmuted audio start.
    // Deferring it — even into the timeout just below — loses the gesture and
    // the song stays silent on every phone.
    // The house track always starts with the reveal; a customer who chose her
    // own song keeps her own autoplay preference. Called synchronously inside
    // the tap — see background-music.tsx for why that is the only thing phones
    // will let make a sound.
    if (event.musicAutoplay || !event.musicYoutubeId) music.start();

    if (!animate) {
      setOpened(true);
      return;
    }
    setIsOpening(true);
    setTimeout(() => setOpened(true), OPENING_TRANSITION_MS);
  }

  function handleOpenClick() {
    openInvitation();
  }

  // A builder theme's colors live on its variant, not in `config` — the chrome
  // around the three art screens follows the variant so the whole page matches.
  const palette = builder?.palette ?? theme.palette;
  const builderRoles = builder?.typography.roles;
  const vars: CSSProperties & Record<string, string> = {
    "--color-bg": palette.bg,
    "--color-surface": palette.surface,
    "--color-fg": palette.fg,
    "--color-fg-muted": palette.fgMuted,
    "--color-accent": palette.accent,
    "--color-accent-fg": palette.accentFg,
    "--font-ar-display": builderRoles
      ? fontStackFor(builderRoles.display.family)
      : fontVarFor(theme.fonts.arabicDisplay),
    "--font-ar-body": builderRoles
      ? fontStackFor(builderRoles.body.family)
      : fontVarFor(theme.fonts.arabicBody),
    "--font-en-display": builderRoles
      ? fontStackFor(builderRoles.latin.family)
      : fontVarFor(theme.fonts.latinDisplay),
  };

  function respond(
    response: "ACCEPTED" | "DECLINED",
    details: { guestNameAr?: string; guestPhone?: string; partySize?: number; messageAr?: string },
  ) {
    if (mode === "preview") {
      scrollToOutcomeRef.current = true;
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
      scrollToOutcomeRef.current = true;
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

  // An RSVP block on a builder scene posts through `submitRsvpAction` itself —
  // the same server action `respond` uses — and hands back the entry QR. All
  // this has to do is move the page on to the pass, exactly as `respond` does.

  function handleStageRsvp(response: RsvpResponse, qr: string | null) {
    scrollToOutcomeRef.current = true;
    setCurrentStatus(response);
    if (qr) setCurrentQr(qr);
  }

  // The music is driven by <useBackgroundMusic>: one player, mounted once
  // below, whose state comes from the player's own events. Kept as local names
  // because a designed `music` button layer drives the very same audio — two
  // independent play states would fight each other over one player.
  const musicPlaying = music.playing;
  const toggleMusic = music.toggle;



  // Assembled once and handed to every builder stage — see StageData.
  const stageData: StageData = {
    eventDateIso: event.eventDate,
    linkToken: linkToken ?? null,
    mapUrl: event.mapUrl,
    scheduleItems: event.scheduleItems ?? null,
    notesAr: event.notesAr ?? null,
    rsvpResponded:
      currentStatus === "ACCEPTED" || currentStatus === "DECLINED" ? currentStatus : null,
    onToggleMusic: event.musicYoutubeId ? toggleMusic : null,
    musicPlaying,
    rsvp: {
      guestName: guest.nameAr,
      allowedCount: guest.allowedCount,
      allowGuestPartySize: event.allowGuestPartySize,
      // The theme editor and the customer's gallery walk the real form; they
      // must not write a booking against a sample invitation.
      simulate: mode === "preview",
      onResponded: handleStageRsvp,
      // The block draws its own copy, so hand it this page's dictionary rather
      // than letting a second set of Arabic strings drift from `dict.guest`.
      labels: {
        name: g.rsvpNameLabel,
        phone: g.rsvpPhoneLabel,
        attending: g.attendingChoice,
        decline: g.decline,
        partySize: g.rsvpPartySizeLabel,
        message: g.rsvpMessageLabel,
        messagePlaceholder: g.rsvpMessagePlaceholder,
        submit: g.rsvpSubmit,
        error: g.rsvpError,
        thanksAccept: g.thanksAccept,
        thanksDecline: g.thanksDecline,
      },
    },
  };

  // The cover's overlay tap target covers the whole stage, so nothing on it can
  // be interacted with. Handing it a live RSVP would therefore render a real,
  // unreachable form; the inert one makes that explicit.
  const coverStageData: StageData = { ...stageData, rsvp: { ...stageData.rsvp, simulate: true } };

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

  // The tap-to-open screen is the scene the admin marked `cover`. It is picked
  // by role and not by `visible`, because unlike the scroll-snapped screens
  // after it this one is structural: a guest with no cover would have nothing
  // to tap. A document that carries no cover role at all falls through to the
  // hand-coded covers below rather than opening onto a blank page.
  const coverScene = builder?.layout.scenes.find((scene) => scene.role === "cover");

  // A builder theme's cover is its own authored artwork; the tap-to-open
  // interaction, the lift/shine reaction and the label are the same ones the
  // bespoke SealedCard themes use.
  if (!opened && builder && builderContent && coverScene) {
    // With the theme's own art behind the whole page, the cover stage is no
    // longer a card floating on a colour — the rounded corners and drop shadow
    // would outline a transparent rectangle over the artwork.
    const hasPageBackground = pageBackgroundUrl(builder.layout.page, builder.assets) !== null;
    return (
      <div
        style={vars}
        className="relative flex min-h-dvh flex-col items-center justify-center gap-8 bg-[var(--color-bg)] px-6 text-center text-[var(--color-fg)]"
      >
        <BuilderPageBackground page={builder.layout.page} assets={builder.assets} />
        {/*
          The tap target is an overlay, NOT a wrapper. A designer can drop any
          layer on the cover, and an RSVP block or a link button nested inside a
          <button> is invalid HTML: React refuses to hydrate it and every tap on
          the form would open the invitation instead. Overlaying keeps the cover
          one big tap target without ever nesting interactive elements.
        */}
        <div
          className="relative flex w-full flex-col items-center gap-6"
          style={{
            maxWidth: stageMaxWidth(coverScene.canvas, "9rem"),
            opacity: isOpening ? 0 : 1,
            transition: "opacity 0.35s ease 0.35s",
          }}
        >
          <div
            className={`relative w-full overflow-hidden${hasPageBackground ? "" : " rounded-md shadow-2xl"}`}
            style={{
              transition: "transform 550ms cubic-bezier(0.4,0,0.2,1), filter 550ms ease",
              transform: isOpening ? "scale(1.05) translateY(-8px)" : "scale(1)",
              filter: isOpening ? "brightness(1.15)" : "brightness(1)",
            }}
          >
            <BuilderStage
              builder={builder}
              scene={coverScene.id}
              hasQr={hasQr}
              content={builderContent}
              breakpoint={breakpoint}
              data={coverStageData}
            />
            {/* Makes the whole card tappable. Hidden from assistive tech and
                taken out of the tab order on purpose: it carries no name of its
                own, so keyboard and screen-reader users reach the identical
                labelled button below instead of being offered the same action
                twice. */}
            <button
              type="button"
              onClick={handleOpenClick}
              disabled={isOpening}
              aria-hidden="true"
              tabIndex={-1}
              className="absolute inset-0 z-10 h-full w-full"
            />
          </div>
          {/* Padded to a 44px-tall target — the text itself is only 16px, and
              this is the affordance a guest aims at. */}
          <button
            type="button"
            onClick={handleOpenClick}
            disabled={isOpening}
            className="px-6 py-3.5 text-xs font-medium uppercase tracking-[0.3em]"
            style={{ color: "var(--color-fg)" }}
          >
            {g.openInvitation}
          </button>
        </div>
      </div>
    );
  }

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
        <SealedCard
          style={theme.card.style}
          accent={theme.palette.accent}
          accentFg={theme.palette.accentFg}
          surface={theme.palette.surface}
          fg={theme.palette.fg}
          groomInitial={initialOf(event.groomNameEn, event.groomNameAr)}
          brideInitial={initialOf(event.brideNameEn, event.brideNameAr)}
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
              {initialOf(event.groomNameEn, event.groomNameAr)}&amp;{initialOf(event.brideNameEn, event.brideNameAr)}
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
            {/* The Latin names line. Both English names are optional: with
                neither given the line goes — the Arabic names follow on the
                next screen — and with one missing that side falls back to
                the Arabic given name. Groom first, as everywhere else. */}
            {(event.brideNameEn.trim() || event.groomNameEn.trim()) && (
              <p className="text-lg" style={{ fontFamily: "var(--font-en-display)" }}>
                {event.groomNameEn.trim() || event.groomNameAr} &amp; {event.brideNameEn.trim() || event.brideNameAr}
              </p>
            )}
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
              onClick={() => openInvitation({ animate: false })}
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

  // ---- Builder themes: the post-open flow is the theme's own scene list ----
  //
  // `flowScenes` is the exact sequence this guest scrolls through. Everything
  // below is empty for a LEGACY theme, which keeps Scenes 1–7 verbatim.
  const eligibleScenes = builder
    ? visibleFlowScenes(builder.layout, {
        schedule: hasSchedule,
        notes: hasNotes,
        map: Boolean(event.mapUrl),
        music: Boolean(event.musicYoutubeId),
      })
    : [];
  // Scenes holding a USABLE RSVP block. `visible` alone is not enough: a block
  // shrunk to nothing, dragged off the stage or faded out is invisible to the
  // guest but would still suppress the fallback below, leaving them with no way
  // to book at all. Anything short of usable falls back to the hand-coded form.
  const rsvpSceneIds = new Set(
    builder
      ? builder.layout.layers
          .filter((l) => l.type === "rsvp" && isUsableLayer(l))
          .map((l) => l.scene)
      : [],
  );
  // A theme that never designed an RSVP block — every builder theme authored
  // before the block existed — still has to be able to take a booking, so the
  // hand-coded form below stands in. Guests who already answered see neither.
  const designedRsvp = eligibleScenes.some((scene) => rsvpSceneIds.has(scene.id));
  // The scene STAYS once the guest answers — only the block inside it swaps to
  // its thank-you state. Dropping the whole screen would take every unrelated
  // layer on it (names, date, venue) with it and leave a hole mid-scroll.
  // Falling back to the hand-coded screens when this is empty is deliberate: a
  // theme whose only flow scene was deleted, hidden, or gated behind data this
  // event lacks would otherwise render an entirely blank invitation between the
  // cover and the pass.
  const flowScenes = eligibleScenes;
  const somethingFollowsFlow = (hasRsvpForm && !designedRsvp) || hasResponded;
  // Shown only to a guest who accepted, and only if the theme still has a pass
  // scene: hidden or deleted, the generic card below keeps the entry QR
  // reachable rather than handing them an empty stage.
  const passScene = builder?.layout.scenes.find((scene) => scene.role === "pass" && scene.visible);

  const somethingFollowsDetails = hasSchedule || hasNotes || hasRsvpForm || hasResponded;
  const somethingFollowsSchedule = hasNotes || hasRsvpForm || hasResponded;
  const somethingFollowsNotes = hasRsvpForm || hasResponded;
  const calendarUrl = linkToken ? `/i/${linkToken}/calendar` : undefined;
  // The entry-pass cards list EVERY couple. They used to print the primary
  // pair only, which meant a joint wedding's other couples never appeared on
  // the card the guest shows at the door.
  // What fills the printed frame on the pass card art. A no-QR event still gets
  // a filled frame — see PassholderTag — because the frame is part of the
  // artwork and an empty one reads as a fault. FakeQr stays preview-only: it is
  // convincing enough that showing it to a real guest would hand them something
  // that looks like a working pass and fails at the door.
  const passFrameNode = !hasQr ? (
    <PassholderTag
      nameLabel={g.passName}
      name={guest.nameAr}
      seatsLabel={g.passSeatsShort}
      seats={guest.allowedCount}
    />
  ) : currentQr ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={currentQr} alt="QR" className="h-full w-full object-contain" />
  ) : (
    <FakeQr className="h-full w-full" />
  );

  const passCouples = couples.map((couple) => ({
    groomLabel: couple.groomNameAr || couple.groomNameEn,
    brideLabel: couple.brideNameAr || couple.brideNameEn,
  }));

  return (
    <div
      style={{
        ...vars,
        // For a builder theme the entrance animation moves down onto the scene
        // container instead. Six of the seven open animations animate
        // `transform`, and a transformed ancestor becomes the containing block
        // for `position: fixed` descendants — which would stop the full-page
        // background being viewport-sized and let this wrapper's
        // `overflow-hidden` clip it. LEGACY themes keep the animation exactly
        // where it has always been.
        ...(builder ? null : { animation: openAnimation }),
      }}
      className="relative h-dvh overflow-hidden bg-[var(--color-bg)] text-[var(--color-fg)]"
    >
      {hasShaderBg && <ShaderBackground deep={theme.palette.bg} mid={theme.palette.surface} highlight={theme.palette.accent} />}
      {hasParticles && <FloatingParticles accent={theme.palette.accent} />}
      {/* A builder theme carries its own full-page art; painting a category
          decor kit over it would scatter someone else's motifs across the
          admin's design. LEGACY themes keep the exact branch they had. */}
      {builder ? (
        <BuilderPageBackground page={builder.layout.page} assets={builder.assets} />
      ) : theme.card?.style ? (
        <RoseCandlelightBackground assetFolder={roseAssetFolder} />
      ) : (
        themeCategory && <ThemeDecor category={themeCategory} accent={theme.palette.accent} fgMuted={theme.palette.fgMuted} />
      )}
      {isSplit && (
        <div className="pointer-events-none fixed inset-y-0 end-0 z-10 w-2" style={{ background: "var(--color-accent)" }} />
      )}

      {/* Universal post-open flow: a scroll-snapped sequence of scenes, same
          structure for every theme — only palette/fonts/decoration differ. */}
      <div
        ref={sceneContainerRef}
        className="dawati-scene-container"
        style={{
          ...(hasPhotoBg ? { textShadow: "0 1px 4px rgba(0,0,0,0.6)" } : null),
          // See the wrapper above: for builder themes the entrance runs here so
          // no transformed ancestor sits over the fixed page background.
          ...(builder ? { animation: openAnimation } : null),
        }}
      >
        {builder && builderContent && flowScenes.length > 0 ? (
          /* A builder theme brings its own post-open sequence: one screen per
             `flow` scene, in the admin's own order. It reuses the same <Scene>
             wrapper as the hand-coded screens below, so scroll-snap, the
             in-view reveal and the scroll hint behave identically. */
          flowScenes.map((scene, index) => (
            <Scene key={scene.id} showHint={index < flowScenes.length - 1 || somethingFollowsFlow}>
              <div className="w-full" style={{ maxWidth: stageMaxWidth(scene.canvas, "10rem") }}>
                <BuilderStage
                  builder={builder}
                  scene={scene.id}
                  content={builderContent}
                  breakpoint={breakpoint}
                  qrDataUrl={currentQr}
                  hasQr={hasQr}
                  data={stageData}
                />
              </div>
            </Scene>
          ))
        ) : (
          <>
            {/* Scene 1: the guest's own named card — same shared background as
                every other scene; the rose-emboss theme shows its opened-envelope
                card photo with the same text written across its blank paper. */}
            <Scene showHint>
              {isBridalFrame ? (
                <div className="relative w-[320px]">
                  {/* The box is a fixed 320px and the height follows the file's
                      own proportions, so `sizes` can name the width exactly.
                      Only the RATIO decides the height, and rescaling cannot
                      change a ratio — so a phone-sized file puts the guest's
                      name in precisely the place the full one did. The numbers
                      are the base ivory-bloom art: a variant with different
                      proportions still lays out from its own file, and these
                      only reserve the box while it loads, which the bare <img>
                      did not do at all. */}
                  <Image
                    src={`/themes/${roseAssetFolder}/envelope-open.webp`}
                    alt=""
                    width={781}
                    height={1108}
                    sizes="320px"
                    className="block h-auto w-full"
                  />
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
                  {/* Same reasoning as the bridal-frame card above, with this
                      family's own box and its own art — every rose variant's
                      opened envelope is 1404x1120. */}
                  <Image
                    src={`/themes/${roseAssetFolder}/envelope-open.webp`}
                    alt=""
                    width={1404}
                    height={1120}
                    sizes="370px"
                    className="block h-auto w-full"
                  />
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

            {/* Scene 2: the invitation itself, in the order it is read —
                opening (basmala / verse / dua), the host line (the two
                mothers), the fixed verb, the couple line in the host's chosen
                format, "وذلك بمشيئة الله تعالى", the date, then any extra text
                and the closing. All composed by content.ts, so this screen,
                the builder stage and the share texts print the same words. */}
            <Scene showHint>
              <div className="flex max-w-md flex-col items-center gap-3">
                {openingText(event.openingKind) && (
                  <p className="whitespace-pre-line text-lg leading-loose" style={{ fontFamily: "var(--font-ar-display)" }}>
                    {openingText(event.openingKind)}
                  </p>
                )}
                {hostLine && (
                  <p className="whitespace-pre-line leading-loose" style={{ fontFamily: "var(--font-ar-display)" }}>
                    {hostLine}
                  </p>
                )}
                <p className="leading-loose text-[var(--color-fg-muted)]">{INVITE_VERB}</p>
                {/* One row per couple — a joint wedding announces several. Groom
                    first, in the format the host picked (BRIDE_FOCUS breaks
                    after his name, hence `whitespace-pre-line`). */}
                <div className="flex flex-col items-center gap-3">
                  {couples.map((couple, i) => (
                    <p key={i} className="whitespace-pre-line text-2xl leading-snug" style={{ fontFamily: "var(--font-ar-display)" }}>
                      {coupleLineFor(couple, event.coupleFormat)}
                    </p>
                  ))}
                </div>
                <p className="leading-loose text-[var(--color-fg-muted)]">{INSHALLAH}</p>
                <div className="text-center">
                  <p className="text-lg text-[var(--color-fg)]">{dual.gregorian}</p>
                  <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{dual.hijri}</p>
                </div>
                {extraText && (
                  <p className="whitespace-pre-line leading-loose text-[var(--color-fg-muted)]">{extraText}</p>
                )}
                <p className="mt-1 text-lg leading-relaxed" style={{ fontFamily: "var(--font-ar-display)" }}>
                  {closingText(event.closingAr)}
                </p>
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
          </>
        )}

        {/* Scene 7: RSVP form. Every LEGACY theme lands here; a builder theme
            only does when its own scenes carry no RSVP block, so no design can
            end up unable to take a booking. */}
        {hasRsvpForm && !designedRsvp && (
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
              {/* Before she taps, not after: a reply from a test link reaches
                  nobody, and finding that out afterwards is the whole harm. */}
              {testCopy && (
                <p className="text-center text-xs text-[var(--color-fg-muted)]">{g.testRsvpNotice}</p>
              )}
              {rsvpError && <p className="text-sm text-red-400">{rsvpError}</p>}
            </form>
          </Scene>
        )}

        {currentStatus === "ACCEPTED" && (
          <Scene>
            {/* A no-QR event has no code to wait for, so it goes straight to the
                pass. With a QR the pass waits for the real one — or for the
                editor's preview — and otherwise shows the thank-you line. */}
            {!hasQr || currentQr || mode === "preview" ? (
              builder && builderContent && passScene ? (
                <div className="w-full" style={{ maxWidth: stageMaxWidth(passScene.canvas, "12rem") }}>
                  <BuilderStage
                    builder={builder}
                    scene={passScene.id}
                    content={builderContent}
                    breakpoint={breakpoint}
                    qrDataUrl={currentQr}
                    hasQr={hasQr}
                    data={stageData}
                  />
                </div>
              ) : theme.card?.style === "rose-emboss" ? (
                <RoseCandlelightPass
                  couples={passCouples}
                  invitationTextAr={passInviteText}
                  placeText={event.locationName + (event.regionName ? ` — ${event.regionName}` : "")}
                  dateText={dual.gregorian.split("، ").pop() ?? dual.gregorian}
                  timeText={dual.time}
                  qrNode={passFrameNode}
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
                  couples={passCouples}
                  invitationTextAr={passInviteText}
                  placeText={event.locationName + (event.regionName ? ` — ${event.regionName}` : "")}
                  dateText={dual.gregorian.split("، ").pop() ?? dual.gregorian}
                  timeText={dual.time}
                  qrNode={passFrameNode}
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
                  {/* This card is drawn in CSS, not printed art — with no code
                      there is no empty frame left behind, so it simply omits
                      the square and keeps the name and seat count below. */}
                  {!hasQr ? null : currentQr ? (
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
            {/* Offered only on a real, accepted, QR-bearing invitation. A test
                invitation is deliberately excluded: its code opens no door, and
                a ticket sitting in the host's own wallet would look like one
                that does. */}
            {walletEnabled && hasQr && currentQr && linkToken && !testCopy && mode !== "preview" && (
              <a
                href={`/i/${linkToken}/wallet/google`}
                className="mt-4 inline-flex h-11 items-center rounded-full border border-[var(--color-fg-muted)]/40 px-6 text-sm font-medium text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
              >
                {g.addToGoogleWallet}
              </a>
            )}
            {/* `testCopy` first: the other three are style branches, and on a
                plain legacy design none of them is true — which would mean the
                one screen that has to say "this card is not a door pass" said
                nothing at all, on exactly the designs where the pass renders
                as a convincing card. */}
            {(testCopy || builder || theme.card?.style === "rose-emboss" || isBridalFrame) &&
              (!hasQr || currentQr || mode === "preview") && (
                <p className="mt-3 text-xs text-[var(--color-fg-muted)]">
                  {testCopy ? g.testPassNotice : hasQr ? g.passShowAtEntry : g.passShowCardAtEntry}
                </p>
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
