import { ImageResponse } from "next/og";
import { getInvitationByLinkToken } from "@/lib/invitations/service";
import { couplesFor } from "@/lib/events/service";
import type { ThemeConfig } from "@/lib/themes/types";

export const alt = "دعوة رقمية خاصة";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FALLBACK_PALETTE = { bg: "#14110d", surface: "#1e1912", fg: "#f3ede3", fgMuted: "#b8ac9a", accent: "#d4af74" };

/**
 * Only the glyphs actually needed (the `text` param) — keeps the fetch small
 * and sidesteps Satori's lack of Arabic shaping: the couple names are always
 * Latin, so this card never needs an Arabic-capable font at all.
 */
async function loadGoogleFont(family: string, text: string, weight: number): Promise<ArrayBuffer> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await fetch(cssUrl).then((res) => res.text());
  const match = css.match(/src: url\(([^)]+)\) format\('(?:opentype|truetype)'\)/);
  if (!match) throw new Error(`Could not resolve font file for ${family}`);
  const res = await fetch(match[1]);
  return res.arrayBuffer();
}

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await getInvitationByLinkToken(token);

  const theme = (invitation?.event.theme.config as unknown as ThemeConfig | undefined)?.palette ?? FALLBACK_PALETTE;
  const latinFont = (invitation?.event.theme.config as unknown as ThemeConfig | undefined)?.fonts.latinDisplay ?? "Cormorant Garamond";
  // One card, one pair of names: a joint wedding shows its primary couple
  // rather than stacking every pair into a link preview.
  const primaryCouple = invitation ? couplesFor(invitation.event)[0] : null;
  const namesText = primaryCouple ? `${primaryCouple.groomNameEn} & ${primaryCouple.brideNameEn}` : "دعوتي";
  const dateLabel = invitation
    ? new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric" }).format(invitation.event.eventDate)
    : "";

  // Must cover every glyph actually drawn below (names + "Wedding Invitation"
  // + the date) — subsetting to just the names left the date's letters
  // outside the fetched font and falling back to Satori's default typeface.
  const glyphText = `${namesText} WEDDING INVITATION ${dateLabel}`;
  const fontData = await loadGoogleFont(latinFont, glyphText, 600).catch(() => null);

  return new ImageResponse(
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
            fontFamily: fontData ? "DisplayFont" : undefined,
            display: "flex",
          }}
        >
          Wedding Invitation
        </div>
        <div style={{ fontSize: 72, color: theme.fg, fontFamily: fontData ? "DisplayFont" : undefined, display: "flex" }}>
          {namesText}
        </div>
        <div style={{ width: 140, height: 1, background: theme.accent, margin: "36px 0" }} />
        <div style={{ fontSize: 26, color: theme.fgMuted, fontFamily: fontData ? "DisplayFont" : undefined, display: "flex" }}>
          {dateLabel}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fontData ? [{ name: "DisplayFont", data: fontData, style: "normal", weight: 600 }] : undefined,
    },
  );
}
