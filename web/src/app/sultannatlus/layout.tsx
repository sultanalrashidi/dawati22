import type { Metadata } from "next";
import { Almarai } from "next/font/google";
import { THEME_FONT_CLASS } from "@/lib/themes/fonts";
import "../globals.css";

const bodyFont = Almarai({
  variable: "--font-body",
  subsets: ["arabic"],
  weight: ["300", "400", "700", "800"],
});

export const metadata: Metadata = {
  title: "دعوتي",
  // Unlisted is most of this route's protection; a crawler indexing it would
  // undo that by itself.
  robots: { index: false, follow: false },
};

/**
 * Its own root layout, outside `/[locale]`.
 *
 * No site header and no navigation on purpose: everything the shared chrome
 * offers is a link to somewhere else, and a page that is only reachable by
 * knowing its address should not advertise that it is part of anything.
 */
export default function AdminSignInLayout({ children }: LayoutProps<"/sultannatlus">) {
  return (
    <html
      lang="ar"
      dir="rtl"
      data-theme="light"
      className={`${bodyFont.variable} ${THEME_FONT_CLASS} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-bg text-fg">{children}</body>
    </html>
  );
}
