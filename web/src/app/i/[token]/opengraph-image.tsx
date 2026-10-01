import { ImageResponse } from "next/og";
import type { CSSProperties } from "react";
import { getViewableInvitationByLinkToken } from "@/lib/invitations/service";
import { linkPreviewText } from "@/lib/invitations/link-preview";
import type { ThemeConfig } from "@/lib/themes/types";
import { ThemeEngine } from "@/generated/prisma/client";
import { builderThemeConfig, loadBuilderTheme } from "@/lib/themes/builder/guest";

export const alt = "دعوة رقمية خاصة";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FALLBACK_PALETTE = { bg: "#14110d", surface: "#1e1912", fg: "#f3ede3", fgMuted: "#b8ac9a", accent: "#d4af74" };

/** The line over the names. Arabic, like the invitation and everything else on the card. */
const HEADING = "دعوة زفاف";

/**
 * The one face the whole card is set in. Chosen by rendering, not taste:
 * Satori's shaper (opentype.js) throws "lookupType 5 substFormat 3 is not yet
 * supported" on the GSUB tables of Amiri, Noto Naskh Arabic, Noto Kufi Arabic
 * and the Noto Sans Arabic that next/og would fetch on its own — for the most
 * common Saudi names of all (عبدالله، عبدالعزيز، الجوهرة). Markazi Text shapes
 * every one of them. It carries Latin letters too, so an English name standing
 * in for a missing Arabic one sits on the same baseline as the "و" beside it;
 * a Latin face and an Arabic face on one line do not, in Satori.
 */
const ARABIC_FONT = "Markazi Text";
const ARABIC_FONT_WEIGHT = 500;

type FontEntry = NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"] extends (infer F)[] | undefined
  ? F
  : never;

/**
 * How long each of the two font requests may take. WhatsApp gives up on a slow
 * preview and shows the bare link, so a late face is worth less than the
 * frame-only card drawn without it.
 */
const FONT_FETCH_TIMEOUT_MS = 2500;

/** Only the glyphs actually needed (the `text` param) — keeps the fetch small. */
async function loadGoogleFont(family: string, text: string, weight: number): Promise<ArrayBuffer> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(text)}`;
  const cssRes = await fetch(cssUrl, { signal: AbortSignal.timeout(FONT_FETCH_TIMEOUT_MS) });
  if (!cssRes.ok) throw new Error(`Font CSS for ${family} answered ${cssRes.status}`);
  const match = (await cssRes.text()).match(/src: url\(([^)]+)\) format\('(?:opentype|truetype)'\)/);
  if (!match) throw new Error(`Could not resolve font file for ${family}`);
  const res = await fetch(match[1], { signal: AbortSignal.timeout(FONT_FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Font file for ${family} answered ${res.status}`);
  return res.arrayBuffer();
}

/**
 * The names line's size: 80px for the usual pair, smaller as the names grow,
 * so a long pair ("عبدالرحمن بن محمد و الجوهرة بنت عبدالعزيز") stays inside
 * the card instead of losing its end off the left edge. Satori cannot measure
 * joined Arabic, so this goes by characters; ~0.4em each is what Markazi Text
 * draws them at.
 */
function namesFontSize(names: string): number {
  return Math.max(28, Math.min(80, Math.floor(1000 / (0.4 * Math.max(1, [...names].length)))));
}

/** opentype.js's own test for an Arabic letter; the Arabic-Indic digits are not one. */
const ARABIC_LETTER = /[\u0600-\u065F\u066A-\u06D2\u06FA-\u06FF]/;
/** A word with a Latin letter in it: part of an English name. */
const LATIN_WORD = /[A-Za-z\u00C0-\u024F]/;
const NBSP = "\u00a0";

/**
 * A line of Arabic cut into the pieces Satori can draw right to left, first
 * piece first.
 *
 * Satori does no bidi: it places words left to right in the order given. The
 * only reordering is opentype.js's, which draws Arabic words joined by
 * no-break spaces as one stretch, reversed whole, and leaves digits and Latin
 * letters as they are. So each piece is one Arabic stretch plus the numbers
 * (or English name) read just before it, written as it is SEEN: the stretch in
 * reading order for opentype.js to turn round, then those numbers to its
 * right. A piece never holds two stretches: opentype.js would pull the space
 * before the number between them into the first and glue the two together.
 *
 * Pieces rather than one flex item per word, because Satori sizes a text box
 * by adding up its letters' isolated forms — far wider than the joined word it
 * draws — so every word carried its own blank and the Gregorian date printed
 * as "١٩      نوفمبر". Inside a piece the words sit where they are drawn; the
 * one blank left is at the piece's right-hand end, where it falls after a
 * comma or at the end of the line. Nothing here can measure it, so it also
 * leaves each line a little left of centre.
 */
function rtlPieces(text: string): string[] {
  const pieces: { lead: string[]; arabic: string[] }[] = [{ lead: [], arabic: [] }];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let piece = pieces[pieces.length - 1];
    if (ARABIC_LETTER.test(word)) {
      piece.arabic.push(word);
      continue;
    }
    if (piece.arabic.length > 0) {
      piece = { lead: [], arabic: [] };
      pieces.push(piece);
    }
    // Consecutive Latin words are one English name, read left to right.
    const previous = piece.lead[piece.lead.length - 1];
    if (previous && LATIN_WORD.test(previous) && LATIN_WORD.test(word)) {
      piece.lead[piece.lead.length - 1] = `${previous}${NBSP}${word}`;
    } else {
      piece.lead.push(word);
    }
  }
  return pieces
    .map(({ lead, arabic }) => [arabic.join(NBSP), ...lead.reverse()].filter(Boolean).join(NBSP))
    .filter(Boolean);
}

/** The pieces of one line, the first on the right where an Arabic reader starts. */
function rtlLine(pieces: string[], fontSize: number, style: CSSProperties) {
  return (
    <div style={{ display: "flex", flexDirection: "row-reverse", gap: Math.round(fontSize * 0.25), fontSize, ...style }}>
      {pieces.map((piece, index) => (
        <span key={index}>{piece}</span>
      ))}
    </div>
  );
}

/**
 * The palette the invitation itself is drawn in.
 *
 * A BUILDER design keeps its colours on the chosen variant, not in
 * `theme.config` — reading `config.fonts` off one threw on every invitation
 * made with the current designs, so WhatsApp got a 500 and showed the site
 * icon instead of a card. Composed the way the invitation page composes it,
 * and anything unreadable falls back rather than failing the preview.
 */
async function previewPalette(
  invitation: Awaited<ReturnType<typeof getViewableInvitationByLinkToken>>,
): Promise<typeof FALLBACK_PALETTE> {
  if (!invitation) return FALLBACK_PALETTE;
  try {
    const { theme, themeVariantId } = invitation.event;
    const builder =
      theme.engine === ThemeEngine.BUILDER ? await loadBuilderTheme(theme.id, themeVariantId) : null;
    const config: ThemeConfig | undefined = builder
      ? builderThemeConfig({ palette: builder.palette, typography: builder.typography })
      : (theme.config as unknown as ThemeConfig | undefined);
    return config?.palette ?? FALLBACK_PALETTE;
  } catch {
    return FALLBACK_PALETTE;
  }
}

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await getViewableInvitationByLinkToken(token);

  const theme = await previewPalette(invitation);
  // The couple and the date exactly as the page's description gives them —
  // see lib/invitations/link-preview.ts.
  const preview = invitation ? linkPreviewText(invitation) : { names: "", dateLines: [] };
  const heading = rtlPieces(HEADING);
  const names = rtlPieces(preview.names || "دعوتي");
  const dateLines = preview.dateLines.map(rtlPieces);

  // Must cover every glyph drawn — heading, names and date, and the no-break
  // spaces between their words — or the missing ones fall back to a face
  // next/og fetches on its own (see ARABIC_FONT).
  const arabicData = await loadGoogleFont(
    ARABIC_FONT,
    [heading, names, ...dateLines].flat().join(" "),
    ARABIC_FONT_WEIGHT,
  ).catch(() => null);
  const fonts: FontEntry[] = arabicData
    ? [{ name: "ArabicFont", data: arabicData, style: "normal", weight: ARABIC_FONT_WEIGHT }]
    : [];

  const card = (show: { names: boolean; text: boolean }) =>
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
            // Only when the face was fetched: Satori splits every fontFamily it
            // is given, and an explicit undefined throws before anything draws.
            ...(arabicData ? { fontFamily: "ArabicFont" } : {}),
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

          {show.text ? rtlLine(heading, 32, { color: theme.accent, marginBottom: 8 }) : null}
          {show.names ? rtlLine(names, namesFontSize(preview.names || "دعوتي"), { color: theme.fg }) : null}
          <div style={{ width: 140, height: 1, background: theme.accent, margin: "32px 0" }} />
          {/* Hijri first, with the weekday, then the Gregorian date — the order the invitation prints them in. */}
          {show.text ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              {dateLines.map((pieces, index) => (
                <div key={index} style={{ display: "flex" }}>
                  {rtlLine(pieces, index === 0 ? 36 : 30, { color: theme.fgMuted })}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ),
      {
        ...size,
        fonts: fonts.length > 0 ? fonts : undefined,
      },
    );

  // Render eagerly so a shaping failure on an unusual name (see ARABIC_FONT)
  // is caught here, and the preview degrades to the frame, heading and date
  // instead of the link showing no image at all. The bare frame is the last
  // resort, and the only card drawn without the face: every word on the card
  // is Arabic, and next/og's own fallback face cannot shape the common names.
  const attempts = arabicData
    ? [
        { names: true, text: true },
        { names: false, text: true },
      ]
    : [];
  for (const show of attempts) {
    try {
      const response = card(show);
      const png = await response.arrayBuffer();
      return new Response(png, { headers: response.headers });
    } catch {
      // Try the plainer card.
    }
  }
  return card({ names: false, text: false });
}
