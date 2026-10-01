// يصدّر اللوحات العشر من billboards.html إلى png/ بمقاس 2400×600.
//   node render.mjs
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
mkdirSync(join(HERE, 'png'), { recursive: true });

const browser = await chromium.launch({ args: ['--font-render-hinting=none'] });
const page = await browser.newPage({ viewport: { width: 2400, height: 600 }, deviceScaleFactor: 1 });
const count = 10;
for (let i = 1; i <= count; i++) {
  await page.goto(`file://${join(HERE, 'billboards.html')}?board=${i}`);
  await page.waitForFunction(() => window.__ready === true);
  const top = await page.evaluate(n => BOARDS[n - 1].top, i);
  const name = `board-${String(i).padStart(2, '0')}${top ? `-carousel-${top}` : ''}.png`;
  await page.screenshot({ path: join(HERE, 'png', name), clip: { x: 0, y: 0, width: 2400, height: 600 } });
  console.log(name);
}
await browser.close();
