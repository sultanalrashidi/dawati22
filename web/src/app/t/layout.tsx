import type { Metadata } from "next";
import { THEME_FONT_CLASS } from "@/lib/themes/fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: "دعوة تجريبية",
  description: "نسخة تجريبية من الدعوة",
  // A link the customer forwards to her mother is still not a public page.
  robots: { index: false, follow: false },
};

/**
 * A standalone root layout, for the same reason `/preview` and `/i` have one:
 * this IS the invitation, full-bleed and opening like an envelope, and every
 * route under `/[locale]` is wrapped in the site header.
 *
 * Being outside `/[locale]` means being outside the layout that declares
 * <html> and <body>, so they are declared here — a segment tree with no root
 * layout of its own renders nothing but a Next runtime error.
 */
export default function TestInvitationLayout({ children }: LayoutProps<"/t">) {
  return (
    <html lang="ar" dir="rtl" className={`${THEME_FONT_CLASS} h-full antialiased`}>
      <body className="min-h-full bg-[#0a0a0a]">{children}</body>
    </html>
  );
}
