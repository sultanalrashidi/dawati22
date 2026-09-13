/**
 * An invitation's song, as the one `Event.musicYoutubeId` column stores it.
 *
 * The column predates TikTok and keeps its name so that adding TikTok needed
 * no migration. A bare 11-character value is a YouTube video id — every row
 * written before TikTok, unchanged — and `tiktok:<digits>` is a TikTok video.
 * Nothing outside this file should spell either shape by hand.
 */
export type MusicTrack =
  | { provider: "youtube"; id: string }
  | { provider: "tiktok"; id: string };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
/** TikTok ids are 19 digits today; the range leaves room either side. */
const TIKTOK_ID = /^\d{8,25}$/;
const TIKTOK_PREFIX = "tiktok:";

export function isTiktokId(id: string): boolean {
  return TIKTOK_ID.test(id);
}

/** The stored value, understood. Null for empty or anything unrecognised. */
export function readTrack(stored: string | null | undefined): MusicTrack | null {
  if (!stored) return null;
  if (stored.startsWith(TIKTOK_PREFIX)) {
    const id = stored.slice(TIKTOK_PREFIX.length);
    return isTiktokId(id) ? { provider: "tiktok", id } : null;
  }
  return YOUTUBE_ID.test(stored) ? { provider: "youtube", id: stored } : null;
}

export function storeTrack(track: MusicTrack): string {
  return track.provider === "tiktok" ? `${TIKTOK_PREFIX}${track.id}` : track.id;
}

/**
 * A link the customer can read back in the song field — and that the form
 * accepts again unchanged, so re-saving the page never trips on its own value.
 * TikTok's own share links resolve to this `@/video/<id>` shape.
 */
export function trackUrl(stored: string | null | undefined): string {
  const track = readTrack(stored);
  if (!track) return "";
  return track.provider === "tiktok"
    ? `https://www.tiktok.com/@/video/${track.id}`
    : `https://www.youtube.com/watch?v=${track.id}`;
}
