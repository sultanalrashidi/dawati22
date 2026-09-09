import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Almarai } from "next/font/google";
import { locales, isLocale, dirOf } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { THEME_COOKIE } from "@/lib/theme/constants";
import { THEME_FONT_CLASS } from "@/lib/themes/fonts";
import { AppChrome } from "@/components/app-chrome";
import { InlineScript } from "@/components/inline-script";
import "../globals.css";

const bodyFont = Almarai({
  variable: "--font-body",
  subsets: ["arabic"],
  weight: ["300", "400", "700", "800"],
});

// `--font-display` is the «دعوتي» wordmark's face — the header and footer are
// its only users; headings and numbers set in Almarai at bold/extrabold. It
// has to be a face with Arabic glyphs, and Aref Ruqaa is already loaded for
// the theme engine and already on <html> via THEME_FONT_CLASS, so pointing at
// its variable costs no extra download.

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: "دعوتي — Dawati",
  description: "منصة عربية فاخرة للدعوات الرقمية والمناسبات",
};

// Avoids a light/dark flash before hydration: reads the theme cookie (or
// falls back to the OS preference) and sets data-theme before first paint.
// Deliberately NOT read via cookies() server-side — that would opt this
// route out of static prerendering for a value that's fine to correct client-side.
const NO_FLASH_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);if(m){document.documentElement.setAttribute('data-theme',decodeURIComponent(m[1]))}else if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark')}}catch(e){}})()`;

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = await getDictionary(locale);

  return (
    <html
      lang={locale}
      dir={dirOf(locale)}
      data-theme="light"
      className={`${bodyFont.variable} ${THEME_FONT_CLASS} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <InlineScript html={NO_FLASH_SCRIPT} />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-fg">
        <AppChrome locale={locale} dict={dict}>
          {children}
        </AppChrome>
      </body>
    </html>
  );
}
