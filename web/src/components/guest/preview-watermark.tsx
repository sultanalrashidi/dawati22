"use client";

/**
 * The "this is not the real thing" layer over an unpaid invitation.
 *
 * Mounted once as a sibling of the invitation's screens, so one instance
 * covers the cover, every flow screen and the entry pass — the five screens
 * are mutually exclusive, and a watermark that only appeared on some of them
 * would be an invitation to screenshot the others.
 *
 * `position: fixed` rather than absolute: the invitation scrolls, and a
 * watermark that scrolls with the content leaves clean space at the top of a
 * long screen. `pointer-events: none` keeps it from swallowing taps, so the
 * customer can still open the envelope, scroll and try the RSVP underneath it.
 *
 * Honest about what it is: this is client-rendered, so someone determined can
 * remove it in devtools or crop a screenshot. It is not the paywall — the
 * paywall is that no guest link exists until the invitation is paid for. This
 * is what stops the free preview being casually forwarded and used as if it
 * were the invitation.
 */
export function PreviewWatermark({ primary, secondary }: { primary: string; secondary: string }) {
  // Drawn as one SVG tile repeated by the browser rather than a few hundred
  // DOM nodes. The tile is deliberately larger than the text so the diagonal
  // rows interlock instead of colliding at the edges.
  // Strong enough that nobody could pass this off as the real invitation,
  // light enough that she can still judge the design she is about to buy —
  // which is the entire reason the preview exists.
  //
  // Light fill with a dark outline, rather than one ink and a blend mode.
  // The designs run from cream to near-black, and any single colour vanishes
  // on half of them — a blend mode does too, since `difference` against a dark
  // ground barely moves a dark glyph. Carrying both means the fill reads on the
  // dark designs and the outline reads on the pale ones.
  const tile = `
    <svg xmlns="http://www.w3.org/2000/svg" width="440" height="320" viewBox="0 0 440 320">
      <g transform="rotate(-28 220 160)" text-anchor="middle"
         font-family="system-ui, -apple-system, 'Segoe UI', Tahoma, sans-serif"
         fill="rgba(255,255,255,0.20)" stroke="rgba(0,0,0,0.13)" stroke-width="1"
         paint-order="stroke">
        <text x="220" y="152" font-size="30" font-weight="700">${escapeXml(primary)}</text>
        <text x="220" y="186" font-size="15" font-weight="600">${escapeXml(secondary)}</text>
      </g>
    </svg>`;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60] print:hidden"
      style={{
        backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(tile.trim())}")`,
        backgroundRepeat: "repeat",
      }}
    />
  );
}

/** The strings are Arabic UI copy, but they still land inside an SVG document. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
