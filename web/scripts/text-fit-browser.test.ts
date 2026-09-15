import test from 'node:test';
import assert from 'node:assert/strict';
import { CHROME, launchChrome, SETTLED } from './headless-chrome';
import { GUEST_PHONES } from '../src/lib/themes/builder/stage-size';

/**
 * The browser half of the text-fit check.
 *
 * Opens the dev-only text-fit review page in headless Chrome as each phone in
 * GUEST_PHONES — every screen of every design and colour, each stage exactly
 * as wide as the guest page makes it there — and fails on any text box that
 * FittedText had to turn into a scroller with the sample content: the state
 * that hides the event time or half a name from a guest. With long names and
 * a long venue it only reports what still scrolls.
 *
 * It needs the dev server started with TEXT_FIT_DIR pointing at a catalogue
 * (`live-themes.json`, see scripts/text-room.ts for how to read the live one),
 * so it runs only when pointed at one:
 *   TEXT_FIT_URL=http://localhost:3000 npx tsx --test scripts/text-fit-browser.test.ts
 * TEXT_FIT_WHICH=proposed checks `proposed-themes.json` instead.
 */
const BASE = process.env.TEXT_FIT_URL;
const WHICH = process.env.TEXT_FIT_WHICH ?? 'live';

type Stage = { design: string; scene: string; scrollers: string[] };

// Each stage's width is `guestStageWidth`, which text-fit.test.ts holds to the
// guest page's own CSS.
const READ = `[...document.querySelectorAll('[data-stage]')].map(stage => ({
  design: stage.dataset.design, scene: stage.dataset.scene,
  scrollers: [...stage.querySelectorAll('[data-text-overflow="scroll"]')].map(box => box.closest('[data-layer-id]')?.getAttribute('data-layer-id') ?? '?'),
}))`;

test('no text box turns into a scroller on common Saudi phones', {
  skip: !BASE ? 'set TEXT_FIT_URL to a running dev server to run it' : !CHROME ? 'Chrome not found; set CHROME' : false,
  timeout: 10 * 60_000,
}, async t => {
  const browser = await launchChrome();
  const failures: string[] = [];
  try {
    for (const phone of GUEST_PHONES) {
      for (const long of [false, true]) {
        const page = new URL('/ar/themes/text-fit-review', BASE);
        page.searchParams.set('phone', phone.id);
        page.searchParams.set('which', WHICH);
        if (long) page.searchParams.set('long', '1');
        await browser.open(page.href);
        await browser.evaluate(SETTLED);
        const stages = await browser.evaluate<Stage[]>(READ);
        assert.ok(stages.length > 0, 'the page shows designs');
        const scrolling = new Set<string>();
        for (const stage of stages) for (const id of stage.scrollers) scrolling.add(`${stage.scene} · ${stage.design} · ${id}`);
        if (long) t.diagnostic(`${phone.id}, long names and venue: ${scrolling.size ? [...scrolling].join('; ') : 'nothing scrolls'}`);
        else failures.push(...[...scrolling].map(row => `${phone.id} ${row}`));
      }
    }
  } finally {
    await browser.close();
  }
  assert.deepEqual(failures, [], `text boxes that scroll:\n${failures.join('\n')}`);
});
