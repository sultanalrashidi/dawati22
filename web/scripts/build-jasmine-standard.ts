import { readFileSync, writeFileSync } from 'node:fs';
import { assertLayoutDoc } from '../src/lib/themes/builder/schema';
import { applyJasmineStandard, jasmineReference, REFERENCE_THEME_SLUG } from '../src/lib/themes/builder/jasmine-standard';
import type { LayoutDoc, VariantPalette } from '../src/lib/themes/builder/types';
import type { LayoutOverrides } from '../src/lib/themes/builder/resolve';

/**
 * Reads the live catalogue (one entry per design, as the gallery serves it)
 * and writes every design brought onto the عروس الياسمين pattern.
 *
 *   npx tsx scripts/build-jasmine-standard.ts <live-themes.json> <proposed-themes.json>
 *
 * Always feed it a fresh read of production: admins edit designs in place, so
 * anything older would write their work away.
 */
type Theme = { themeId: string; family: string; name: string; layout: LayoutDoc; typography: unknown;
  variants: { id: string; slug: string; name: string; palette: unknown; assets: unknown; overrides: LayoutOverrides }[] };

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('usage: build-jasmine-standard.ts <live-themes.json> <proposed-themes.json>');
const live = JSON.parse(readFileSync(input, 'utf8')) as Theme[];
const reference = jasmineReference();
const report: string[] = [];
const proposed = live.map(theme => {
  if (theme.family === REFERENCE_THEME_SLUG) {
    // The reference itself changes only by the seats-line typo fix.
    return { ...theme, layout: assertLayoutDoc(reference.layout) };
  }
  const result = applyJasmineStandard({ family: theme.family, layout: theme.layout,
    variants: theme.variants.map(v => ({ slug: v.slug, overrides: v.overrides, palette: v.palette as VariantPalette })) });
  if (result.removed.length) report.push(`${theme.family}: merged into the date block ${result.removed.join(', ')}`);
  if (result.hidden.length) report.push(`${theme.family}: hidden ${result.hidden.join(', ')}`);
  return { ...theme, layout: assertLayoutDoc(result.layout),
    variants: theme.variants.map((v, i) => ({ ...v, overrides: result.variants[i].overrides, palette: result.variants[i].palette ?? v.palette })) };
});
writeFileSync(output, JSON.stringify(proposed, null, 1));
console.log(report.join('\n'));
console.log(`Wrote ${proposed.length} designs to ${output}.`);
