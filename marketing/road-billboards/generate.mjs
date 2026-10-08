// يولّد صور الكاروسيل الأربع صوراً واقعية عبر Gemini (gemini-2.5-flash-image).
// يرسل لكل صورة البرومبت + ملف اللوحة من png/ كمرجع، عشان يطلع النص العربي والشعار مثل التصميم بالضبط.
//
//   GEMINI_API_KEY=... node generate.mjs            ← الأربع كلها
//   GEMINI_API_KEY=... node generate.mjs 2 --n 3    ← الصورة ٢ فقط، ٣ محاولات
//
// النتائج في photos/scene-<رقم>-<محاولة>.png
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('GEMINI_API_KEY غير موجود في البيئة'); process.exit(1); }
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-image';

const COMMON = `The attached image is the exact billboard artwork. Reproduce it on the billboard EXACTLY as given: same Arabic text, same letters, same logo on the right, same cream background and thin gold border. Do not translate, re-letter or change any text. The billboard is mounted on top of a concrete overpass, facing the camera, large and clearly readable, occupying about 70% of the image width, in the upper-middle of the frame. Shot from inside a car through the windshield, part of the dashboard and A-pillars visible at the frame edges, phone-camera realism, natural light, real photograph, not a render, not an illustration. All cars seen from behind with no license plates visible (plates blank or hidden), cars common in Saudi Arabia. No road signs, no government logos, no other text anywhere. Vertical 9:16.`;

const SCENES = [
  { n: 1, board: 'png/board-01-carousel-1.png', prompt: `Real photo on a wide multi-lane highway in Riyadh, Saudi Arabia, at golden hour sunset: warm orange-pink sky, low sun glowing behind modern Riyadh towers, date palms along the median. Traffic ahead: a white Toyota Land Cruiser, a white Toyota Camry and a pearl-white GMC Yukon.` },
  { n: 2, board: 'png/board-02-carousel-2.png', prompt: `Real night photo on a busy Riyadh highway around 9 pm: streams of red tail lights, warm sodium street lamps, lit modern towers in the distance. The billboard is softly backlit and glowing. Traffic ahead: a white Toyota Land Cruiser, a silver Hyundai Sonata, a black Lexus LX and a white Nissan Patrol.` },
  { n: 3, board: 'png/board-03-carousel-3.png', prompt: `Real photo from a car just exiting a long road tunnel in Riyadh at dusk: dark tunnel walls with orange tunnel lights frame the shot, purple-orange sky opening ahead, the billboard on the overpass right after the tunnel exit. Traffic ahead: a white Toyota Hilux, a white Toyota Camry and a beige Toyota Land Cruiser.` },
  { n: 4, board: 'png/board-04-carousel-4.png', prompt: `Real photo in light evening traffic on a wide Riyadh road at blue hour: deep blue sky with a thin orange glow on the horizon, rows of tall palms, street lamps just turning on, the billboard softly illuminated. Traffic in the next lanes: a white Toyota Land Cruiser, a silver Toyota Camry, a white Hyundai Elantra and a black GMC Yukon.` },
];

const args = process.argv.slice(2);
const only = args.find(a => /^\d$/.test(a));
const tries = Number(args[args.indexOf('--n') + 1]) || 2;
mkdirSync(join(HERE, 'photos'), { recursive: true });

for (const s of SCENES.filter(s => !only || s.n === Number(only))) {
  const board = readFileSync(join(HERE, s.board)).toString('base64');
  for (let t = 1; t <= tries; t++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${s.prompt}\n\n${COMMON}` }, { inline_data: { mime_type: 'image/png', data: board } }] }],
        generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '9:16' } },
      }),
    });
    const json = await res.json();
    const part = json.candidates?.[0]?.content?.parts?.find(p => p.inlineData || p.inline_data);
    if (!res.ok || !part) { console.error(`scene ${s.n} try ${t}: فشل`, JSON.stringify(json.error ?? json).slice(0, 300)); continue; }
    const out = join(HERE, 'photos', `scene-${s.n}-${t}.png`);
    writeFileSync(out, Buffer.from((part.inlineData ?? part.inline_data).data, 'base64'));
    console.log(out);
  }
}
