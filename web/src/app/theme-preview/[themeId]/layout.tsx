import type { Metadata } from "next";
import { THEME_FONT_CLASS } from "@/lib/themes/fonts";
import "../../globals.css";

export const metadata: Metadata = {
  title: "معاينة تصميم — دعوتي",
  robots: { index: false, follow: false },
};

/**
 * Standalone root layout, deliberately outside `/[locale]/admin`: a preview has
 * to show exactly what a guest sees, and the admin layout's sidebar and site
 * header would sit on top of the very design being judged.
 */
export default function ThemePreviewLayout({ children }: LayoutProps<"/theme-preview/[themeId]">) {
  return (
    <html lang="ar" dir="rtl" className={`${THEME_FONT_CLASS} h-full antialiased`}>
      <body className="min-h-full bg-[#0a0a0a]">{children}</body>
    </html>
  );
}
