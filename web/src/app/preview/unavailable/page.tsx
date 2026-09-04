import Link from "next/link";
import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Where a share link lands once its three viewers are used up. */
export default async function PreviewUnavailablePage() {
  const dict = await getDictionary("ar");
  const d = dict.draft;

  return (
    <div dir="rtl" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <h1 className="text-xl font-bold text-fg">{d.shareExhaustedTitle}</h1>
      <p className="max-w-sm text-sm leading-relaxed text-fg-muted">{d.shareExhaustedBody}</p>
      <Link
        href="/ar"
        className="inline-flex h-11 items-center rounded-full border border-border px-6 text-sm font-bold text-fg transition-colors hover:border-accent"
      >
        {dict.common.notFoundHome}
      </Link>
    </div>
  );
}
