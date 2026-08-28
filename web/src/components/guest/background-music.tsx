"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Background music for an invitation.
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
 * Music pill has always started the song on a phone — is a `playVideo` command
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
 * the guest's first tap sent `pauseVideo`. With autoplay on there was no
 * single tap anywhere in the invitation that would start the song. Here the
 * state is only ever set from the player's own `onStateChange` events, so the
 * pill cannot claim to be playing when it is not, and one tap always does the
 * thing the pill says it will.
 */

const ORIGIN = "https://www.youtube-nocookie.com";

/** The shape the embed reports its state in. */
interface Info {
  playerState?: number;
  muted?: boolean;
}

/** YouTube's player states. Only "playing" decides what the pill shows. */
const PLAYING = 1;
const PAUSED = 2;

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

export function useBackgroundMusic(videoId: string | null): BackgroundMusic {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [playing, setPlaying] = useState(false);

  // Commands sent before the player finishes loading are dropped on the floor
  // by the embed — no error, no retry. That is worst on phones, where the
  // embed is heaviest and the network slowest, so a guest who taps early gets
  // silence. Anything sent too early waits here and is flushed on ready.
  const readyRef = useRef(false);
  const pendingRef = useRef<string[]>([]);
  const stateRef = useRef<number | null>(null);
  const mutedRef = useRef(false);

  const post = useCallback((func: string) => {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(JSON.stringify({ event: "command", func, args: [] }), ORIGIN);
  }, []);

  const send = useCallback(
    (func: string) => {
      if (!readyRef.current) {
        // A guest jabbing the pill should end up in the state of their LAST
        // tap, so a new play/pause supersedes an earlier one — but `unMute`
        // must survive, because `start()` queues it alongside `playVideo` and
        // dropping it would flush a play command to a muted player.
        const supersedesPlayback = func === "playVideo" || func === "pauseVideo";
        const queue = pendingRef.current.filter((queued) =>
          supersedesPlayback
            ? queued !== "playVideo" && queued !== "pauseVideo"
            : queued !== func,
        );
        queue.push(func);
        pendingRef.current = queue;
        return;
      }
      post(func);
    },
    [post],
  );

  useEffect(() => {
    if (!videoId) return;

    readyRef.current = false;
    pendingRef.current = [];

    function handleMessage(event: MessageEvent) {
      if (event.origin !== ORIGIN) return;
      if (event.source !== frameRef.current?.contentWindow) return;

      let data: unknown;
      try {
        data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (!data || typeof data !== "object") return;
      const message = data as { event?: string; info?: unknown };

      // Any of these proves the channel is live and the player is listening.
      // `alreadyInitialized` matters as much as `onReady`: the embed answers
      // that instead of `onReady` when it has seen a handshake before, so
      // treating only `onReady` as readiness leaves commands queued forever.
      if (
        message.event === "onReady" ||
        message.event === "alreadyInitialized" ||
        message.event === "initialDelivery" ||
        message.event === "infoDelivery" ||
        message.event === "onStateChange"
      ) {
        if (!readyRef.current) {
          readyRef.current = true;
          const queued = pendingRef.current;
          pendingRef.current = [];
          for (const func of queued) post(func);
        }
      }

      // State arrives on BOTH channels, and in practice almost always on
      // `infoDelivery` rather than `onStateChange` — watching only the latter
      // is why an earlier version of this file left the pill dark while the
      // song was audibly playing. `info` is a bare number on `onStateChange`
      // and an object on `infoDelivery`, and the object reports `playerState`
      // and `muted` in SEPARATE messages, so each is remembered as it comes.
      const info = message.info;
      const state = typeof info === "number" ? info : (info as Info | null)?.playerState;
      const muted = typeof info === "object" ? (info as Info | null)?.muted : undefined;

      if (typeof muted === "boolean") mutedRef.current = muted;
      if (typeof state === "number") stateRef.current = state;

      // Audible, not merely "playing": a player that some browser started
      // muted is silence as far as the guest is concerned, and a pill that
      // spins for it is the same lie in a new costume.
      setPlaying(stateRef.current === PLAYING && !mutedRef.current);
    }

    window.addEventListener("message", handleMessage);

    // The embed only starts talking after the page introduces itself. Without
    // this handshake there are no state events at all, which is why the old
    // code could never tell whether the music was actually playing.
    function introduce() {
      const win = frameRef.current?.contentWindow;
      if (!win) return;
      win.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), ORIGIN);
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
  }, [videoId, post]);

  const start = useCallback(() => {
    // `unMute` first: a player that some browser started muted would otherwise
    // "play" in silence, and the pill would report success for nothing.
    send("unMute");
    send("playVideo");
  }, [send]);

  const toggle = useCallback(() => {
    if (playing) {
      send("pauseVideo");
      // Reflect the intent immediately; the player's own report confirms it a
      // moment later. Pausing is never refused, so this cannot lie.
      stateRef.current = PAUSED;
      setPlaying(false);
      return;
    }
    start();
  }, [playing, send, start]);

  return { playing, toggle, start, frameRef, enabled: Boolean(videoId) };
}

/** The hidden player. Rendered once, above every screen, so it never remounts. */
export function MusicFrame({
  videoId,
  frameRef,
}: {
  videoId: string;
  frameRef: React.RefObject<HTMLIFrameElement | null>;
}) {
  return (
    <iframe
      ref={frameRef}
      // Deliberately NO `autoplay=1`. The player loads warm and idle, and the
      // guest's tap on the cover starts it — see the note at the top of this
      // file. `enablejsapi=1` is what makes the postMessage control possible.
      src={`${ORIGIN}/embed/${videoId}?enablejsapi=1&controls=0&modestbranding=1&rel=0&playsinline=1`}
      style={{ position: "fixed", width: 1, height: 1, opacity: 0, pointerEvents: "none", bottom: 0 }}
      allow="autoplay"
      title="background-music"
    />
  );
}
