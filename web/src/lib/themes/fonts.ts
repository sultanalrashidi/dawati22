import { Aref_Ruqaa, Reem_Kufi, Amiri, Cormorant_Garamond, Inter, IBM_Plex_Sans_Arabic } from "next/font/google";

export const arefRuqaa = Aref_Ruqaa({ variable: "--font-aref-ruqaa", subsets: ["arabic"], weight: ["400", "700"] });
export const reemKufi = Reem_Kufi({ variable: "--font-reem-kufi", subsets: ["arabic"], weight: ["400", "700"] });
export const amiri = Amiri({ variable: "--font-amiri", subsets: ["arabic"], weight: ["400", "700"] });
export const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});
export const interFont = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600"] });
export const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600"],
});

export const THEME_FONT_CLASS = [
  arefRuqaa.variable,
  reemKufi.variable,
  amiri.variable,
  cormorant.variable,
  interFont.variable,
  plexArabic.variable,
].join(" ");

const FONT_VAR_MAP: Record<string, string> = {
  "Aref Ruqaa": "var(--font-aref-ruqaa)",
  "Reem Kufi": "var(--font-reem-kufi)",
  Amiri: "var(--font-amiri)",
  "Cormorant Garamond": "var(--font-cormorant)",
  Inter: "var(--font-inter)",
  "IBM Plex Sans Arabic": "var(--font-plex-arabic)",
};

export function fontVarFor(name: string): string {
  return FONT_VAR_MAP[name] ?? "var(--font-plex-arabic)";
}
