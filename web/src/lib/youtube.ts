const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extracts an 11-char YouTube video ID from any common URL shape
 * (watch?v=, youtu.be/, shorts/, embed/, music.youtube.com). Returns null
 * for anything that isn't a recognizable YouTube video link.
 */
export function extractYoutubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").replace(/^music\./, "");
  if (host !== "youtube.com" && host !== "youtu.be") return null;

  let candidate: string | null = null;
  if (host === "youtu.be") {
    candidate = url.pathname.slice(1);
  } else if (url.pathname === "/watch") {
    candidate = url.searchParams.get("v");
  } else if (url.pathname.startsWith("/shorts/")) {
    candidate = url.pathname.slice("/shorts/".length);
  } else if (url.pathname.startsWith("/embed/")) {
    candidate = url.pathname.slice("/embed/".length);
  }

  if (!candidate) return null;
  candidate = candidate.split("/")[0].split("?")[0];
  return YOUTUBE_ID_PATTERN.test(candidate) ? candidate : null;
}
