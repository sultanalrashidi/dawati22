"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MusicTrack } from "@/lib/music/track";

/**
 * Background music for an invitation — a YouTube video or a TikTok clip, of
 * which the guest only ever hears the sound.
 *
 * ## Why this is not just `<iframe src="...&autoplay=1">`
 *
 * Every mobile browser refuses to start UNMUTED audio that no one asked for.
 * On iOS this is absolute — WebKit blocks it in every browser on the platform,
 * because they are all WebKit — and `allow="autoplay"` does not change it:
 * that attribute is Permissions-Policy delegation, which decides whether the
 * frame is *allowed to be asked*, not whether the media engine will start
 * without a gesture. So a player mounted at page load with `autoplay=1` is
 * silent on a phone, always, no matter how the URL is spelled.
 *
 * What DOES work — and is already proven to work in this app, because the
 * Music pill has always started the song on a phone — is a play command
 * posted while the page holds a real user gesture. The invitation has exactly
 * such a gesture, and it is the perfect one: the guest tapping the cover to
 * open the invitation. So the customer's "play automatically" option is
 * implemented as *start on open* rather than *start on load*. As a bonus that
 * is better behaviour everywhere: the music begins with the reveal instead of
 * blaring while the envelope is still closed.
 *
 * ## Why the state comes from the player, never from the setting
 *
 * The previous version seeded its play state from the customer's autoplay
 * preference. When the browser then refused, the pill spun and announced
 * "pause" while the page was silent — and because it believed it was playing,
 * the guest's first tap sent a pause. With autoplay on there was no single tap
 * anywhere in the invitation that would start the song. Here the state is only
 * ever set from the player's own events, so the pill cannot claim to be
 * playing when it is not, and one tap always does the thing the pill says it
 * will.
 *
 * ## TikTok
 *
 * TikTok's embedded player (`/player/v1/<id>`) takes the same kind of posted
 * commands, with one twist that decides everything: loaded with `autoplay=0`
 * it shows a cover picture and builds no video at all, and until the video
 * exists it ignores every command. So it is loaded with `autoplay=1`, which it
 * obeys MUTED — the one kind of autoplay browsers allow — and the first time
 * it reports playing, before the guest has asked for anything, it is paused
 * and rewound. The guest's tap then unmutes and plays it from the start,
 * inside the gesture, exactly as with YouTube. Verified on an iPhone simulator
 * (Safari, iOS 26.5) and in Chrome.
 *
 * Its player is heavy — megabytes of script before the clip itself — so its
 * frame waits for the page to finish loading, and the envelope's artwork
 * comes first.
 */

const YOUTUBE_ORIGIN = "https://www.youtube-nocookie.com";
const TIKTOK_ORIGIN = "https://www.tiktok.com";

/** The one play-state number both players share, and the only one the pill reads. */
const PLAYING = 1;
const PAUSED = 2;

/** What the page asks of either player; translated per player in `message`. */
type Command = "play" | "pause" | "unMute" | "rewind";

function message(provider: MusicTrack["provider"], command: Command): unknown {
  if (provider === "tiktok") {
    const type = command === "rewind" ? "seekTo" : command;
    return { "x-tiktok-player": true, type, value: command === "rewind" ? 0 : undefined };
  }
  const func = { play: "playVideo", pause: "pauseVideo", unMute: "unMute", rewind: "seekTo" }[command];
  return JSON.stringify({ event: "command", func, args: command === "rewind" ? [0, true] : [] });
}

/** The shape the YouTube embed reports its state in. */
interface Info {
  playerState?: number;
  muted?: boolean;
}

/** What one message from either player says, once read. */
interface Heard {
  /** The channel is live and the player takes commands. */
  ready: boolean;
  state?: number;
  muted?: boolean;
}

function hearYoutube(raw: unknown): Heard | null {
  let data: unknown;
  try {
    data = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const msg = data as { event?: string; info?: unknown };

  // Any of these proves the channel is live and the player is listening.
  // `alreadyInitialized` matters as much as `onReady`: the embed answers
  // that instead of `onReady` when it has seen a handshake before, so
  // treating only `onReady` as readiness leaves commands queued forever.
  const ready =
    msg.event === "onReady" ||
    msg.event === "alreadyInitialized" ||
    msg.event === "initialDelivery" ||
    msg.event === "infoDelivery" ||
    msg.event === "onStateChange";

  // State arrives on BOTH channels, and in practice almost always on
  // `infoDelivery` rather than `onStateChange` — watching only the latter
  // is why an earlier version of this file left the pill dark while the
  // song was audibly playing. `info` is a bare number on `onStateChange`
  // and an object on `infoDelivery`, and the object reports `playerState`
  // and `muted` in SEPARATE messages, so each is remembered as it comes.
  const info = msg.info;
  const state = typeof info === "number" ? info : (info as Info | null)?.playerState;
  const muted = typeof info === "object" ? (info as Info | null)?.muted : undefined;
  return { ready, state: typeof state === "number" ? state : undefined, muted: typeof muted === "boolean" ? muted : undefined };
}

function hearTiktok(raw: unknown): Heard | null {
  if (!raw || typeof raw !== "object") return null;
  const msg = raw as { "x-tiktok-player"?: unknown; type?: unknown; value?: unknown };
  if (msg["x-tiktok-player"] !== true) return null;
  // Its handlers exist only once the video does, and every one of these is
  // sent after that — so any of them means commands will now be obeyed.
  const ready = msg.type === "onPlayerReady" || msg.type === "onStateChange" || msg.type === "onMute";
  return {
    ready,
    state: msg.type === "onStateChange" && typeof msg.value === "number" ? msg.value : undefined,
    muted: msg.type === "onMute" && typeof msg.value === "boolean" ? msg.value : undefined,
  };
}

export interface BackgroundMusic {
  /** True only when the player itself has reported that it is playing. */
  playing: boolean;
  /** Play if paused, pause if playing. Safe before the player has loaded. */
  toggle: () => void;
  /**
   * Ask the music to start. Call this SYNCHRONOUSLY from a user-gesture
   * handler — that is the whole reason mobile lets the sound through.
   */
  start: () => void;
  /** Attach to the hidden player iframe. */
  frameRef: React.RefObject<HTMLIFrameElement | null>;
  /** Nothing to render or control when the event carries no track. */
  enabled: boolean;
}

export function useBackgroundMusic(track: MusicTrack | null): BackgroundMusic {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const provider = track?.provider ?? null;
  const trackId = track?.id ?? null;

  // Commands sent before the player finishes loading are dropped on the floor
  // by the embed — no error, no retry. That is worst on phones, where the
  // embed is heaviest and the network slowest, so a guest who taps early gets
  // silence. Anything sent too early waits here and is flushed on ready.
  const readyRef = useRef(false);
  const pendingRef = useRef<Command[]>([]);
  const stateRef = useRef<number | null>(null);
  const mutedRef = useRef(false);
  /** The guest has asked for the music at least once; TikTok's hold is over. */
  const startedRef = useRef(false);

  const post = useCallback(
    (command: Command) => {
      const win = frameRef.current?.contentWindow;
      if (!win || !provider) return;
      win.postMessage(message(provider, command), provider === "tiktok" ? TIKTOK_ORIGIN : YOUTUBE_ORIGIN);
    },
    [provider],
  );

  const send = useCallback(
    (command: Command) => {
      if (!readyRef.current) {
        // A guest jabbing the pill should end up in the state of their LAST
        // tap, so a new play/pause supersedes an earlier one — but `unMute`
        // must survive, because `start()` queues it alongside `play` and
        // dropping it would flush a play command to a muted player.
        const supersedesPlayback = command === "play" || command === "pause";
        const queue = pendingRef.current.filter((queued) =>
          supersedesPlayback ? queued !== "play" && queued !== "pause" : queued !== command,
        );
        queue.push(command);
        pendingRef.current = queue;
        return;
      }
      post(command);
    },
    [post],
  );

  useEffect(() => {
    if (!provider || !trackId) return;

    readyRef.current = false;
    pendingRef.current = [];
    stateRef.current = null;
    mutedRef.current = false;
    startedRef.current = false;
    const origin = provider === "tiktok" ? TIKTOK_ORIGIN : YOUTUBE_ORIGIN;

    function handleMessage(event: MessageEvent) {
      if (event.origin !== origin) return;
      if (event.source !== frameRef.current?.contentWindow) return;

      const heard = provider === "tiktok" ? hearTiktok(event.data) : hearYoutube(event.data);
      if (!heard) return;

      if (heard.ready && !readyRef.current) {
        readyRef.current = true;
        const queued = pendingRef.current;
        pendingRef.current = [];
        for (const command of queued) post(command);
      }

      if (heard.muted !== undefined) mutedRef.current = heard.muted;
      if (heard.state !== undefined) stateRef.current = heard.state;

      // TikTok's muted autoplay — the only way to make it build its video —
      // is held at the start until the guest asks. See the note at the top.
      if (provider === "tiktok" && heard.state === PLAYING && !startedRef.current) {
        post("pause");
        post("rewind");
        return;
      }

      // Audible, not merely "playing": a player that some browser started
      // muted is silence as far as the guest is concerned, and a pill that
      // spins for it is the same lie in a new costume.
      setPlaying(stateRef.current === PLAYING && !mutedRef.current);
    }

    window.addEventListener("message", handleMessage);
    if (provider === "tiktok") {
      return () => window.removeEventListener("message", handleMessage);
    }

    // The YouTube embed only starts talking after the page introduces itself.
    // Without this handshake there are no state events at all, which is why
    // the old code could never tell whether the music was actually playing.
    function introduce() {
      const win = frameRef.current?.contentWindow;
      if (!win) return;
      win.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), YOUTUBE_ORIGIN);
    }

    const frame = frameRef.current;
    frame?.addEventListener("load", introduce);
    // The frame may already have loaded before this effect ran, in which case
    // no `load` event is coming. Introducing twice is harmless — the embed
    // answers `alreadyInitialized`, which is handled above as readiness — but
    // introducing on a TIMER is not: a repeated handshake makes the player
    // answer `alreadyInitialized` in place of `onReady` every time, and the
    // ready signal never arrives at all.
    introduce();

    return () => {
      window.removeEventListener("message", handleMessage);
      frame?.removeEventListener("load", introduce);
    };
  }, [provider, trackId, post]);

  const start = useCallback(() => {
    // A TikTok clip may have run a moment, muted, before its hold caught it;
    // her guest hears it from the beginning. Only the first time — after
    // that, play resumes where a pause left it.
    if (provider === "tiktok" && !startedRef.current) send("rewind");
    startedRef.current = true;
    // `unMute` first: a player that some browser started muted would otherwise
    // "play" in silence, and the pill would report success for nothing.
    send("unMute");
    send("play");
  }, [provider, send]);

  const toggle = useCallback(() => {
    if (playing) {
      send("pause");
      // Reflect the intent immediately; the player's own report confirms it a
      // moment later. Pausing is never refused, so this cannot lie.
      stateRef.current = PAUSED;
      setPlaying(false);
      return;
    }
    start();
  }, [playing, send, start]);

  return { playing, toggle, start, frameRef, enabled: Boolean(track) };
}

/** Everything TikTok's player would otherwise draw over a clip nobody sees. */
const TIKTOK_PARAMS = new URLSearchParams({
  autoplay: "1",
  loop: "1",
  controls: "0",
  progress_bar: "0",
  play_button: "0",
  volume_control: "0",
  fullscreen_button: "0",
  timestamp: "0",
  music_info: "0",
  description: "0",
  rel: "0",
  native_context_menu: "0",
  closed_caption: "0",
}).toString();

/** The hidden player. Rendered once, above every screen, so it never remounts. */
export function MusicFrame({
  track,
  frameRef,
}: {
  track: MusicTrack;
  frameRef: React.RefObject<HTMLIFrameElement | null>;
}) {
  // TikTok's frame waits for the page's own load — see the note at the top.
  // Two seconds at most, so a slow image elsewhere cannot hold the music back
  // past the moment a guest might tap.
  const [mounted, setMounted] = useState(track.provider !== "tiktok");
  useEffect(() => {
    if (track.provider !== "tiktok") return;
    const mount = () => setMounted(true);
    const timer = window.setTimeout(mount, document.readyState === "complete" ? 0 : 2000);
    window.addEventListener("load", mount, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("load", mount);
    };
  }, [track.provider]);

  if (!mounted) return null;

  const src =
    track.provider === "tiktok"
      ? `${TIKTOK_ORIGIN}/player/v1/${track.id}?${TIKTOK_PARAMS}`
      : // Deliberately NO `autoplay=1`. The player loads warm and idle, and the
        // guest's tap on the cover starts it — see the note at the top of this
        // file. `enablejsapi=1` is what makes the postMessage control possible.
        `${YOUTUBE_ORIGIN}/embed/${track.id}?enablejsapi=1&controls=0&modestbranding=1&rel=0&playsinline=1`;

  return (
    <iframe
      ref={frameRef}
      src={src}
      style={{ position: "fixed", width: 1, height: 1, opacity: 0, pointerEvents: "none", bottom: 0 }}
      allow="autoplay; encrypted-media"
      title="background-music"
    />
  );
}
