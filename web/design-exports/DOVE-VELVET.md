# حمام الوصل — Dove Velvet

New local BUILDER design, six approved colours, nine scenes. No production database writes or deployment performed.

Preview: `/ar/themes/dove-review`. Also included in `/ar/themes/collection-review`.

## Source of truth
- `src/lib/themes/builder/dove-velvet.ts`: editable scene geometry, bindings, colours and asset maps.
- `public/themes/dove-velvet/{burgundy,navy,emerald,mocha,mauve,petrol}/`: four production images per variant. `cardNoQr` deliberately reuses the blank card (no printed QR frame).
- `design-exports/dove-velvet.json`: portable draft design document. Regenerate from `web` using `node --import tsx scripts/export-dove-velvet.ts`.
- `scripts/dove-velvet.test.ts`: schema, asset completeness, ink contrast and QR clearance checks.

The preview uses sample guest data and a non-entry QR. RSVP is simulated. Actual guest data and entry tokens are supplied by the existing builder renderer when imported into production.

## Image generation
Built-in image_gen, not CLI. User reference: `/Users/sultan/untitled folder 3/_ (4).jpeg`.
Approved palette: burgundy, navy, emerald, mocha, dusty mauve, petrol blue.

Prompt set (colour substituted for each of the six variants):
1. Background: faithfully recolour reference to the target colour; portrait 9:16; preserve mottled velvet, three white embossed flying doves upper-right and empty centre/bottom; no text or extra motifs.
2. Closed envelope: straight-on velvet envelope in target colour; triangular flap, three white doves upper-right, pearl-white wax seal embossed with a dove; no lettering. Final corrective prompt: preserve geometry and ornaments, replace all checkerboard with a matching coloured velvet backdrop; opaque full-bleed RGB, no transparency attempt.
3. Open envelope: straight-on portrait 3:4; opened triangular flap and blank ivory insert at x16–84%, y25–72%; tiny white dove cluster on insert upper-right; no text. Final corrective prompt: keep exact geometry and ivory paper, recolour velvet and replace all checkerboard with matching coloured velvet backdrop, opaque RGB.
4. Entry card: ivory heavyweight paper, fine double rule in target colour inset 6%, white/silver dove cluster entirely in top 16%; blank light text area x14–86%, y19–94%; no text, no QR/frame, no flowers/bows; full-bleed portrait 9:16.

## Deployment handoff
Upload/copy the asset directory along with the app. Create this as a NEW draft Theme with slug `dove-velvet`, its layout/typography and six ThemeVariants from the export; map each slot path to a hosted URL if the deployment stores theme images in Blob. Do not overwrite any existing theme or assume the export is an executable migration. Review a real guest preview before publishing the theme. Keep development review routes private.

## Envelope revision — blank wax and clean silhouette
Active closed images now use `public/themes/dove-velvet/{colour}/envelopeClosed-v3.png`; open images retain `envelopeOpen-v2.png`. Earlier closed files are superseded.

Built-in image_gen edit prompt for each of the six closed envelopes: preserve canvas, envelope geometry, colours, velvet texture, folds and upper-right doves; remove only the engraved bird in the wax seal, leaving a smooth blank pearl/ivory centre and its raised rim; no letters or motifs. Burgundy additionally requested transparent surroundings; the output contained an opaque checkerboard, so transparency is not assumed.

The renderer now supports validated `AssetLayer.clipPolygon` coordinates. Both envelope layers carry precise percentage silhouettes that hide the entire rectangular image backdrop in the guest view and editor. Deploy `types.ts`, `schema.ts` and `theme-stage.tsx` with the updated layout export; importing the layout alone into the old renderer will not apply the crop. Scene and asset aspect ratios must remain matched. No raster pixels were programmatically altered.

The `s_cover_seal` layer is blank static text, unlocked and positioned inside the wax centre. Enter letters there or change its mode to live initials in the builder. The wax bitmap itself remains blank.

## Colour matching revision
The current export uses `public/themes/dove-velvet/{colour}/envelopeClosed-matched.png` and `envelopeOpen-matched.png` (12 images). These supersede all earlier envelope versions. Background and card files stay as listed in the export.

Built-in image_gen prompt set, applied independently to each open/closed envelope: edit target is the existing envelope; colour reference is that variant's background.png. Match only coloured velvet hue, saturation and midtone brightness to the reference under the page's 16% black veil; keep dimensional fold shadows/highlights, original geometry, canvas and ornaments. Keep ivory paper, white doves and blank pearl wax unchanged. Correct mauve to warm dusty rose, emerald to forest green and mocha to warm brown. Do not add letters or engraving. Preserve the silhouette for the existing clipPolygon.

All twelve outputs were copied into the workspace. Six colour variants were reviewed in the local invitation preview; the design asset/schema and blank-seal checks pass. Regenerated dove-velvet.json points at these matched assets.
