// Renders index.html frame-by-frame (window.seek(t)) to an H.264 MP4 with the
// synthesised soundtrack. Deterministic: every frame is a pure function of t.
//
//   node render.mjs [--from 0] [--to 76] [--fps 30] [--workers 3] [--out out.mp4] [--stills 1,5,10]
import { spawn, execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// PLAYWRIGHT / FFMPEG override the module path and binary (e.g. imageio_ffmpeg's bundled ffmpeg)
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const FF = process.env.FFMPEG ?? 'ffmpeg';
const argv = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? a.concat([[v.slice(2), arr[i + 1]]]) : a), []));
const fps = Number(argv.fps ?? 30);
const workers = Number(argv.workers ?? 3);
const outFile = argv.out ?? join(HERE, 'out', 'dawati-promo.mp4');
mkdirSync(join(HERE, 'out'), { recursive: true });

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto('file://' + join(HERE, argv.page ?? 'index.html'));
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  return page;
}

const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--font-render-hinting=none'] });
const probe = await openPage(browser);
const meta = await probe.evaluate(() => window.__meta());
const from = Number(argv.from ?? 0);
const to = Math.min(Number(argv.to ?? meta.duration), meta.duration);

if (argv.stills) {
  const dir = join(HERE, 'out', 'stills');
  mkdirSync(dir, { recursive: true });
  for (const s of String(argv.stills).split(',').map(Number)) {
    await probe.evaluate(t => window.seek(t), s);
    await probe.screenshot({ path: join(dir, `t${s.toFixed(2).padStart(6, '0')}.png`) });
  }
  console.log('stills written to', dir);
  await browser.close();
  process.exit(0);
}

writeFileSync(join(HERE, 'out', 'cues.json'), JSON.stringify(meta.audio, null, 1));
await probe.close();

const total = Math.round((to - from) * fps);
const per = Math.ceil(total / workers);
const segDir = join(HERE, 'out', 'segments');
if (existsSync(segDir)) rmSync(segDir, { recursive: true });
mkdirSync(segDir, { recursive: true });
const t0 = performance.now();
let done = 0;

async function renderRange(w) {
  const startF = w * per, endF = Math.min(total, startF + per);
  if (startF >= endF) return null;
  const page = await openPage(browser);
  const seg = join(segDir, `seg${String(w).padStart(2, '0')}.mp4`);
  const ff = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(fps), seg]);
  ff.stderr.on('data', d => process.stderr.write(d));
  for (let f = startF; f < endF; f++) {
    const t = from + f / fps;
    await page.evaluate(tt => window.seek(tt), t);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    done++;
    if (done % 60 === 0) {
      const el = (performance.now() - t0) / 1000;
      console.log(`${done}/${total} frames  ${(done / el).toFixed(1)} fps  eta ${((total - done) / (done / el)).toFixed(0)}s`);
    }
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await page.close();
  return seg;
}

const segs = (await Promise.all(Array.from({ length: workers }, (_, w) => renderRange(w)))).filter(Boolean);
await browser.close();
writeFileSync(join(segDir, 'list.txt'), segs.map(s => `file '${s}'`).join('\n'));
const silent = join(HERE, 'out', 'video-silent.mp4');
execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(segDir, 'list.txt'), '-c', 'copy', silent]);

// soundtrack
const wav = join(HERE, 'out', 'soundtrack.wav');
if (argv.noaudio === undefined) {
  const cues = { ...meta.audio, duration: to - from };
  cues.sfx = (cues.sfx || []).filter(e => e.t >= from && e.t < to).map(e => ({ ...e, t: e.t - from }));
  cues.sections = cues.sections.map(s => ({ ...s, start: s.start - from, end: s.end - from }));
  cues.musicOffset = (cues.musicOffset ?? 0) - from;
  writeFileSync(join(HERE, 'out', 'cues-used.json'), JSON.stringify(cues, null, 1));
  console.log(execFileSync('python3', [join(HERE, 'audio', 'synth.py'), join(HERE, 'out', 'cues-used.json'), wav]).toString());
  execFileSync(FF, ['-y', '-loglevel', 'error', '-i', silent, '-i', wav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-shortest', '-movflags', '+faststart', outFile]);
} else {
  execFileSync(FF, ['-y', '-loglevel', 'error', '-i', silent, '-c', 'copy', '-movflags', '+faststart', outFile]);
}
console.log('wrote', outFile, `in ${((performance.now() - t0) / 1000).toFixed(0)}s`);
