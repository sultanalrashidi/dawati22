import type { Metadata } from "next";
import { THEME_FONT_CLASS } from "@/lib/themes/fonts";
import { getAppUrl } from "@/lib/urls";
import "../../globals.css";

export const metadata: Metadata = {
  // Without this, Next.js falls back to Vercel's auto-detected VERCEL_URL
  // (the per-deployment hash domain) for resolving og:image/twitter:image
  // to an absolute URL — not the stable public domain guests actually get.
  metadataBase: new URL(getAppUrl()),
  title: "دعوتي",
  description: "دعوة رقمية خاصة",
  // A per-guest invitation link, carrying a guest's name and a token, is not a
  // public page. WhatsApp still draws its link-preview card from the OG tags —
  // that fetch identifies as a bot and is unaffected by noindex.
  robots: { index: false, follow: false },
};

// Standalone root layout for the guest experience: no site chrome, always
// Arabic/RTL, no login — opened directly from a WhatsApp link.
export default function GuestLayout({ children }: LayoutProps<"/i/[token]">) {
  return (
    <html lang="ar" dir="rtl" className={`${THEME_FONT_CLASS} h-full antialiased`}>
      <body className="min-h-full bg-[#0a0a0a]">{children}</body>
    </html>
  );
}
