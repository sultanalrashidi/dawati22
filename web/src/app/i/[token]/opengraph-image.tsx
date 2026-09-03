import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import { getInvitationByLinkToken } from "@/lib/invitations/service";
import { couplesFor } from "@/lib/events/service";
import type { ThemeConfig } from "@/lib/themes/types";

export const alt = "دعوة رقمية خاصة";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FALLBACK_PALETTE = { bg: "#14110d", surface: "#1e1912", fg: "#f3ede3", fgMuted: "#b8ac9a", accent: "#d4af74" };

/**
 * The face the names are set in when they fall back to Arabic. Chosen by
 * rendering, not taste: Satori's shaper (opentype.js) throws "lookupType 5
 * substFormat 3 is not yet supported" on the GSUB tables of Amiri, Noto Naskh
 * Arabic, Noto Kufi Arabic and the Noto Sans Arabic that next/og would fetch on
 * its own — for the most common Saudi names of all (عبدالله، عبدالعزيز،
 * الجوهرة). Markazi Text shapes every one of them.
 */
const ARABIC_FONT = "Markazi Text";
const ARABIC_FONT_WEIGHT = 500;

type FontEntry = NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"] extends (infer F)[] | undefined
  ? F
  : never;

/**
 * Only the glyphs actually needed (the `text` param) — keeps the fetch small.
 * The display face is Latin-only, so the Arabic names get their own face
 * (`ARABIC_FONT`) rather than being subset out of Cormorant.
 */
async function loadGoogleFont(family: string, text: string, weight: number): Promise<ArrayBuffer> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await fetch(cssUrl).then((res) => res.text());
  const match = css.match(/src: url\(([^)]+)\) format\('(?:opentype|truetype)'\)/);
  if (!match) throw new Error(`Could not resolve font file for ${family}`);
  const res = await fetch(match[1]);
  return res.arrayBuffer();
}

/**
 * The names line, groom first. "Faisal & Noura" when both English names were
 * given; otherwise the Arabic given names — the English ones are optional and
 * the Arabic ones required — joined with "و". Never one of each: a Latin word
 * and an Arabic word on one line sit on different baselines in Satori.
 */
function previewNames(couple: {
  groomNameEn: string;
  brideNameEn: string;
  groomNameAr: string | null;
  brideNameAr: string | null;
}): { text: string; script: "latin" | "arabic" } {
  const brideEn = couple.brideNameEn.trim();
  const groomEn = couple.groomNameEn.trim();
  if (brideEn && groomEn) return { text: `${groomEn} & ${brideEn}`, script: "latin" };
  const bride = couple.brideNameAr?.trim() || brideEn;
  const groom = couple.groomNameAr?.trim() || groomEn;
  const text = [groom, bride].filter(Boolean).join(" و ");
  return { text: text || "دعوتي", script: "arabic" };
}

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await getInvitationByLinkToken(token);

  const theme = (invitation?.event.theme.config as unknown as ThemeConfig | undefined)?.palette ?? FALLBACK_PALETTE;
  const latinFont = (invitation?.event.theme.config as unknown as ThemeConfig | undefined)?.fonts.latinDisplay ?? "Cormorant Garamond";
  // One card, one pair of names: a joint wedding shows its primary couple
  // rather than stacking every pair into a link preview.
  const primaryCouple = invitation ? couplesFor(invitation.event)[0] : null;
  const names = primaryCouple ? previewNames(primaryCouple) : { text: "دعوتي", script: "arabic" as const };
  const dateLabel = invitation
    ? new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric" }).format(invitation.event.eventDate)
    : "";

  // Must cover every glyph actually drawn in the Latin face (Latin names +
  // "Wedding Invitation" + the date) — subsetting to just the names left the
  // date's letters outside the fetched font and falling back to Satori's
  // default typeface. Arabic names are drawn in their own face, subset to them.
  const latinGlyphs = `${names.script === "latin" ? names.text : ""} WEDDING INVITATION ${dateLabel}`;
  const [latinData, arabicData] = await Promise.all([
    loadGoogleFont(latinFont, latinGlyphs, 600).catch(() => null),
    names.script === "arabic"
      ? loadGoogleFont(ARABIC_FONT, names.text, ARABIC_FONT_WEIGHT).catch(() => null)
      : Promise.resolve<ArrayBuffer | null>(null),
  ]);
  const fonts: FontEntry[] = [];
  if (latinData) fonts.push({ name: "DisplayFont", data: latinData, style: "normal", weight: 600 });
  if (arabicData) fonts.push({ name: "ArabicFont", data: arabicData, style: "normal", weight: ARABIC_FONT_WEIGHT });
  const displayFont = latinData ? "DisplayFont" : undefined;

  const namesRow =
    names.script === "latin" ? (
      <div style={{ fontSize: 72, color: theme.fg, fontFamily: displayFont, display: "flex" }}>{names.text}</div>
    ) : (
      // Satori shapes Arabic letters but does no bidi reordering across
      // spaces, so a plain string prints the words left-to-right — groom
      // first. One flex item per word in a reversed row puts the bride's name
      // on the right, where an Arabic reader starts.
      <div
        style={{
          fontSize: 72,
          color: theme.fg,
          fontFamily: arabicData ? "ArabicFont" : undefined,
          display: "flex",
          flexDirection: "row-reverse",
          gap: 22,
        }}
      >
        {names.text.split(" ").map((word, index) => (
          <span key={index}>{word}</span>
        ))}
      </div>
    );

  const card = (namesNode: ReactNode) =>
    new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: theme.bg,
            position: "relative",
          }}
        >
          {/* corner-bracket frame, echoing the LuxuryKit card motif */}
          {[
            { top: 40, left: 40, borderWidth: "3px 0 0 3px" },
            { top: 40, right: 40, borderWidth: "3px 3px 0 0" },
            { bottom: 40, left: 40, borderWidth: "0 0 3px 3px" },
            { bottom: 40, right: 40, borderWidth: "0 3px 3px 0" },
          ].map((pos, i) => (
            <div key={i} style={{ position: "absolute", width: 56, height: 56, borderColor: theme.accent, borderStyle: "solid", ...pos }} />
          ))}

          <div
            style={{
              fontSize: 22,
              letterSpacing: 10,
              textTransform: "uppercase",
              color: theme.accent,
              marginBottom: 28,
              fontFamily: displayFont,
              display: "flex",
            }}
          >
            Wedding Invitation
          </div>
          {namesNode}
          <div style={{ width: 140, height: 1, background: theme.accent, margin: "36px 0" }} />
          <div style={{ fontSize: 26, color: theme.fgMuted, fontFamily: displayFont, display: "flex" }}>
            {dateLabel}
          </div>
        </div>
      ),
      {
        ...size,
        fonts: fonts.length > 0 ? fonts : undefined,
      },
    );

  // Render eagerly so a shaping failure on an unusual name (see ARABIC_FONT)
  // is caught here, and the preview degrades to the frame, heading and date
  // instead of the link showing no image at all.
  try {
    const response = card(namesRow);
    const png = await response.arrayBuffer();
    return new Response(png, { headers: response.headers });
  } catch {
    return card(null);
  }
}
