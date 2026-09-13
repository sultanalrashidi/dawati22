import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveMusicLink } from "../src/lib/music/link";
import { readTrack, storeTrack, trackUrl } from "../src/lib/music/track";
import { DEFAULT_MUSIC_TRACK, isUnchosenMusic, musicToPlay } from "../src/lib/themes/builder/content";

const CLIP = "7563365143522970888";

/**
 * A stand-in for TikTok: short links redirect, oEmbed answers per id, and
 * every request is recorded so a test can say what was — or was not — asked.
 */
function fakeTiktok({
  redirects = {} as Record<string, string>,
  oembed = {} as Record<string, number>,
  down = false,
} = {}) {
  const calls: string[] = [];
  const impl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (down) throw new TypeError("fetch failed");
    if (url.startsWith("https://www.tiktok.com/oembed")) {
      const target = new URL(url).searchParams.get("url") ?? "";
      const id = /\/video\/(\d+)/.exec(target)?.[1] ?? "";
      const status = oembed[id] ?? 200;
      return new Response(JSON.stringify(status === 200 ? { type: "video" } : { code: 400 }), { status });
    }
    const location = redirects[url];
    if (location) return new Response(null, { status: 301, headers: { location } });
    return new Response("<html></html>", { status: 200 });
  }) as typeof fetch;
  return { impl, calls };
}

test("an empty field is no song, and asks nobody", async () => {
  const { impl, calls } = fakeTiktok();
  assert.deepEqual(await resolveMusicLink("", impl), { ok: true, track: null });
  assert.deepEqual(await resolveMusicLink(null, impl), { ok: true, track: null });
  assert.equal(calls.length, 0);
});

test("YouTube links read as they always did, with no network call", async () => {
  const { impl, calls } = fakeTiktok();
  for (const link of [
    "https://www.youtube.com/watch?v=LDnUX_mwx2Q",
    "https://youtu.be/LDnUX_mwx2Q",
    "https://youtube.com/shorts/LDnUX_mwx2Q",
    "https://music.youtube.com/watch?v=LDnUX_mwx2Q&feature=share",
  ]) {
    assert.deepEqual(await resolveMusicLink(link, impl), { ok: true, track: "LDnUX_mwx2Q" }, link);
  }
  assert.equal(calls.length, 0);
});

test("every full TikTok video link reads to the same stored track", async () => {
  for (const link of [
    `https://www.tiktok.com/@si.737/video/${CLIP}?_r=1&_t=ZS-99hsdHW6EpI`,
    `https://www.tiktok.com/@/video/${CLIP}`,
    `https://m.tiktok.com/v/${CLIP}.html`,
    `https://www.tiktok.com/embed/v2/${CLIP}`,
    `https://www.tiktok.com/player/v1/${CLIP}?autoplay=1`,
    `https://t.tiktok.com/i18n/share/video/${CLIP}/?_d=x`,
    `شوفي هذا المقطع https://www.tiktok.com/@si.737/video/${CLIP} 😍`,
  ]) {
    const { impl } = fakeTiktok();
    assert.deepEqual(await resolveMusicLink(link, impl), { ok: true, track: `tiktok:${CLIP}` }, link);
  }
});

test("a share link is followed to its video, then checked", async () => {
  const other = "7373495658197552392";
  for (const short of ["https://vt.tiktok.com/ZSq9arj2K/", "https://vm.tiktok.com/ZMabc123/", "https://www.tiktok.com/t/ZTabc123/"]) {
    const { impl, calls } = fakeTiktok({ redirects: { [short]: `https://www.tiktok.com/@x/video/${other}?_r=1` } });
    assert.deepEqual(await resolveMusicLink(short, impl), { ok: true, track: `tiktok:${other}` }, short);
    assert.equal(calls[0], short);
    assert.ok(calls[1]?.startsWith("https://www.tiktok.com/oembed"), "then oEmbed");
  }
});

test("photo posts are refused — the embedded player has no sound for them", async () => {
  const { impl, calls } = fakeTiktok({ redirects: { "https://vt.tiktok.com/ZSphoto/": "https://www.tiktok.com/@/photo/7377348267614489888" } });
  assert.deepEqual(await resolveMusicLink("https://www.tiktok.com/@x/photo/7377348267614489888", impl), { ok: false, reason: "photo" });
  assert.deepEqual(await resolveMusicLink("https://vt.tiktok.com/ZSphoto/", impl), { ok: false, reason: "photo" });
  assert.ok(!calls.some((c) => c.includes("oembed")), "no oEmbed for a photo");
});

test("a clip TikTok refuses to show is refused before any guest opens it", async () => {
  const { impl } = fakeTiktok({ oembed: { "6940222458985286914": 400 } });
  assert.deepEqual(await resolveMusicLink("https://www.tiktok.com/@x/video/6940222458985286914", impl), {
    ok: false,
    reason: "unavailable",
  });
});

test("a TikTok that cannot be reached does not cost her the form", async () => {
  const { impl } = fakeTiktok({ down: true });
  // The link names its video: accepted, the check is only a courtesy.
  assert.deepEqual(await resolveMusicLink(`https://www.tiktok.com/@x/video/${CLIP}`, impl), { ok: true, track: `tiktok:${CLIP}` });
  // A share link without an answer has no id at all.
  assert.deepEqual(await resolveMusicLink("https://vt.tiktok.com/ZSq9arj2K/", impl), { ok: false, reason: "unreachable" });
});

test("a share link that leads away from TikTok, or nowhere, is not trusted", async () => {
  const { impl } = fakeTiktok({ redirects: { "https://vt.tiktok.com/ZSevil/": "https://example.com/video/7563365143522970888" } });
  assert.deepEqual(await resolveMusicLink("https://vt.tiktok.com/ZSevil/", impl), { ok: false, reason: "unreachable" });
  assert.deepEqual(await resolveMusicLink("https://vt.tiktok.com/ZSnothing/", impl), { ok: false, reason: "unreachable" });
});

test("links that are not a video are refused, not dropped", async () => {
  const { impl } = fakeTiktok();
  for (const link of [
    "https://www.tiktok.com/music/original-sound-7563365211952974609",
    "https://www.tiktok.com/@si.737",
    "https://soundcloud.com/some/track",
    "not a link",
  ]) {
    assert.deepEqual(await resolveMusicLink(link, impl), { ok: false, reason: "unrecognized" }, link);
  }
});

test("the house track is known good and is not re-checked on every save", async () => {
  const { impl, calls } = fakeTiktok();
  assert.deepEqual(await resolveMusicLink(trackUrl(DEFAULT_MUSIC_TRACK), impl), { ok: true, track: DEFAULT_MUSIC_TRACK });
  assert.equal(calls.length, 0);
});

test("what the song field shows reads back to the same track", async () => {
  for (const stored of [DEFAULT_MUSIC_TRACK, "tiktok:7373495658197552392", "LDnUX_mwx2Q"]) {
    const { impl } = fakeTiktok();
    assert.deepEqual(await resolveMusicLink(trackUrl(stored), impl), { ok: true, track: stored }, stored);
  }
  assert.equal(trackUrl(null), "");
});

test("the stored shapes: a bare YouTube id, or tiktok:<id>", () => {
  assert.deepEqual(readTrack("LDnUX_mwx2Q"), { provider: "youtube", id: "LDnUX_mwx2Q" });
  assert.deepEqual(readTrack(`tiktok:${CLIP}`), { provider: "tiktok", id: CLIP });
  assert.equal(storeTrack({ provider: "tiktok", id: CLIP }), `tiktok:${CLIP}`);
  assert.equal(storeTrack({ provider: "youtube", id: "LDnUX_mwx2Q" }), "LDnUX_mwx2Q");
  for (const junk of [null, "", "preview-sample", "tiktok:abc", "tiktok:"]) {
    assert.equal(readTrack(junk), null, String(junk));
  }
});

test("the house track is the owner's TikTok clip, and plays for anyone who did not choose", () => {
  assert.equal(DEFAULT_MUSIC_TRACK, `tiktok:${CLIP}`);
  assert.deepEqual(readTrack(DEFAULT_MUSIC_TRACK), { provider: "tiktok", id: CLIP });
  // Nothing chosen, or the retired house track drafts were born holding.
  assert.equal(isUnchosenMusic(null), true);
  assert.equal(isUnchosenMusic("LDnUX_mwx2Q"), true);
  assert.equal(musicToPlay(null), DEFAULT_MUSIC_TRACK);
  assert.equal(musicToPlay("LDnUX_mwx2Q"), DEFAULT_MUSIC_TRACK);
  // Hers, including the house track kept on purpose: her autoplay choice stands.
  assert.equal(isUnchosenMusic(DEFAULT_MUSIC_TRACK), false);
  assert.equal(isUnchosenMusic("dQw4w9WgXcQ"), false);
  assert.equal(musicToPlay("dQw4w9WgXcQ"), "dQw4w9WgXcQ");
});

test("every form that saves a song resolves the link first", () => {
  // Wiring, not behaviour: the actions are server-only and cannot be imported here.
  for (const file of ["../src/lib/drafts/actions.ts", "../src/lib/events/actions.ts", "../src/lib/admin/actions.ts"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    const calls = source.match(/readEventForm\(/g)?.length ?? 0;
    const resolves = source.match(/await resolveMusicLink\(formData\.get\("musicUrl"\)\)/g)?.length ?? 0;
    assert.ok(calls > 0, file);
    assert.equal(resolves, calls, `${file}: one resolve per readEventForm`);
  }
});

test("drafts are born with the house track, starting with the reveal", () => {
  const source = readFileSync(new URL("../src/lib/drafts/service.ts", import.meta.url), "utf8");
  assert.match(source, /musicYoutubeId: DEFAULT_MUSIC_TRACK,\s*musicAutoplay: true,/);
  const view = readFileSync(new URL("../src/components/guest/invitation-view.tsx", import.meta.url), "utf8");
  assert.match(view, /if \(event\.musicAutoplay \|\| isUnchosenMusic\(event\.musicYoutubeId\)\) music\.start\(\);/);
  for (const preview of ["../src/components/themes/theme-preview-dialog.tsx", "../src/app/theme-preview/[themeId]/page.tsx"]) {
    const text = readFileSync(new URL(preview, import.meta.url), "utf8");
    assert.match(text, /musicYoutubeId: DEFAULT_MUSIC_TRACK,\s*musicAutoplay: true,/, preview);
  }
});
