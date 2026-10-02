// يصدّر اللوحات العشر (png/board-*.png، 2400×600) ثم مشاهد الكاروسيل الأربعة
// (png/scene-*.png، 1080×1920) اللي تركّب اللوحات على الجسر.
//   node render.mjs
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
mkdirSync(join(HERE, 'png'), { recursive: true });

// المشاهد ترسم اللوحات على canvas وتقرأ بكسلاتها، فتحتاج قراءة الملفات المحلية
const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--allow-file-access-from-files'] });

const boards = await browser.newPage({ viewport: { width: 2400, height: 600 }, deviceScaleFactor: 1 });
for (let i = 1; i <= 10; i++) {
  await boards.goto(`file://${join(HERE, 'billboards.html')}?board=${i}`);
  await boards.waitForFunction(() => window.__ready === true);
  const top = await boards.evaluate(n => BOARDS[n - 1].top, i);
  const name = `board-${String(i).padStart(2, '0')}${top ? `-carousel-${top}` : ''}.png`;
  await boards.screenshot({ path: join(HERE, 'png', name), clip: { x: 0, y: 0, width: 2400, height: 600 } });
  console.log(name);
}

const scenes = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
scenes.on('pageerror', e => console.error('[pageerror]', e.message));
for (let i = 1; i <= 4; i++) {
  await scenes.goto(`file://${join(HERE, 'scenes.html')}?scene=${i}`);
  await scenes.waitForFunction(() => window.__ready === true);
  const name = `scene-${i}.png`;
  await scenes.screenshot({ path: join(HERE, 'png', name), clip: { x: 0, y: 0, width: 1080, height: 1920 } });
  console.log(name);
}
await browser.close();
