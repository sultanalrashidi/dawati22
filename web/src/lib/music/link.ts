import { extractYoutubeVideoId } from "@/lib/youtube";
import { DEFAULT_MUSIC_TRACK } from "@/lib/themes/builder/content";
import { isTiktokId, readTrack, storeTrack } from "@/lib/music/track";

/**
 * The song link a customer pasted, turned into the value the event stores.
 *
 * YouTube links are read as they always were, with no network call. TikTok
 * needs the network twice:
 *
 * - The link TikTok's own Share → Copy link hands out is a short one
 *   (vt.tiktok.com/…, vm.tiktok.com/…, tiktok.com/t/…) with no video id in it.
 *   TikTok answers it with a redirect to the full link, so it is followed here
 *   — never in the guest's browser.
 * - A clip can be deleted, private or a photo post, and none of those play in
 *   TikTok's embedded player. Its oEmbed endpoint says which, so the customer
 *   hears about it now instead of her guests opening a silent invitation.
 *
 * If TikTok cannot be reached for the second check, a link that already names
 * a video is accepted: a slow TikTok is no reason to lose her whole form.
 *
 * Called from the server actions only — a browser is not allowed to read
 * TikTok's redirects. Not marked `server-only` so its tests can import it.
 */
export type MusicLinkResult =
  | { ok: true; track: string | null }
  | { ok: false; reason: MusicLinkProblem };

/**
 * - `unrecognized`: not a YouTube or TikTok video link at all.
 * - `photo`: a TikTok photo post — the embedded player has no sound for those.
 * - `unavailable`: TikTok says the clip cannot be shown (deleted, private…).
 * - `unreachable`: a short link TikTok did not answer, so there is no id.
 */
export type MusicLinkProblem = "unrecognized" | "photo" | "unavailable" | "unreachable";

type Fetch = typeof fetch;

const TIMEOUT_MS = 6000;
const HEADERS = { "user-agent": "Mozilla/5.0 (compatible; DawatiBot/1.0; +https://www.dawati.store)" };

type TiktokLink =
  | { kind: "video"; id: string }
  | { kind: "photo" }
  | { kind: "short" }
  | { kind: "other" };

function isTiktokHost(host: string): boolean {
  return host === "tiktok.com" || host.endsWith(".tiktok.com");
}

/** What a tiktok.com URL points at, from its shape alone. */
function readTiktokUrl(url: URL): TiktokLink {
  const host = url.hostname.toLowerCase();
  if (host === "vm.tiktok.com" || host === "vt.tiktok.com") return { kind: "short" };
  const path = url.pathname;
  if (/^\/t\/[A-Za-z0-9]+\/?$/.test(path)) return { kind: "short" };
  if (/\/photo\/\d+/.test(path)) return { kind: "photo" };
  const id =
    /\/video\/(\d+)/.exec(path)?.[1] ?? // www.tiktok.com/@user/video/<id>, t.tiktok.com/i18n/share/video/<id>
    /^\/v\/(\d+)(?:\.html)?/.exec(path)?.[1] ?? // m.tiktok.com/v/<id>.html
    /^\/embed(?:\/v2)?\/(\d+)/.exec(path)?.[1] ?? // www.tiktok.com/embed/v2/<id>
    /^\/player\/v1\/(\d+)/.exec(path)?.[1]; // www.tiktok.com/player/v1/<id>
  return id && isTiktokId(id) ? { kind: "video", id } : { kind: "other" };
}

/** The first http(s) URL in what was pasted — share sheets sometimes add words. */
function firstUrl(raw: string): URL | null {
  const match = /https?:\/\/\S+/i.exec(raw.trim());
  if (!match) return null;
  try {
    return new URL(match[0]);
  } catch {
    return null;
  }
}

/**
 * Follows a short link to the full one. TikTok answers with one redirect
 * today; a couple more hops are allowed in case it adds a regional bounce.
 */
async function followShortLink(start: URL, fetchImpl: Fetch): Promise<TiktokLink | null> {
  let current = start;
  for (let hop = 0; hop < 4; hop++) {
    let res: Response;
    try {
      res = await fetchImpl(current, {
        redirect: "manual",
        headers: HEADERS,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      return null;
    }
    const location = res.headers.get("location");
    if (res.status < 300 || res.status >= 400 || !location) return null;
    try {
      current = new URL(location, current);
    } catch {
      return null;
    }
    if (!isTiktokHost(current.hostname.toLowerCase())) return null;
    const next = readTiktokUrl(current);
    if (next.kind !== "short") return next;
  }
  return null;
}

/** true: a public video. false: TikTok refuses it. null: TikTok did not answer. */
async function tiktokVideoPlays(id: string, fetchImpl: Fetch): Promise<boolean | null> {
  const target = `https://www.tiktok.com/@/video/${id}`;
  try {
    const res = await fetchImpl(`https://www.tiktok.com/oembed?url=${encodeURIComponent(target)}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status >= 500) return null;
    if (!res.ok) return false;
    const body = (await res.json()) as { type?: unknown };
    return body.type === "video";
  } catch {
    return null;
  }
}

export async function resolveMusicLink(
  raw: FormDataEntryValue | null,
  fetchImpl: Fetch = fetch,
): Promise<MusicLinkResult> {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return { ok: true, track: null };

  const url = firstUrl(text);
  if (!url) return { ok: false, reason: "unrecognized" };

  if (!isTiktokHost(url.hostname.toLowerCase())) {
    const youtubeId = extractYoutubeVideoId(url.toString());
    return youtubeId
      ? { ok: true, track: storeTrack({ provider: "youtube", id: youtubeId }) }
      : { ok: false, reason: "unrecognized" };
  }

  let link = readTiktokUrl(url);
  if (link.kind === "short") {
    const followed = await followShortLink(url, fetchImpl);
    if (!followed) return { ok: false, reason: "unreachable" };
    link = followed;
  }
  if (link.kind === "photo") return { ok: false, reason: "photo" };
  if (link.kind !== "video") return { ok: false, reason: "unrecognized" };

  const track = storeTrack({ provider: "tiktok", id: link.id });
  // The house track was checked when it was chosen; every draft starts with it
  // in the field, so asking TikTok again on each save would only add a wait.
  if (track === DEFAULT_MUSIC_TRACK) return { ok: true, track };

  const plays = await tiktokVideoPlays(link.id, fetchImpl);
  if (plays === false) return { ok: false, reason: "unavailable" };
  return readTrack(track) ? { ok: true, track } : { ok: false, reason: "unrecognized" };
}
