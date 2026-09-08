"use client";

import { proposeRibbonFlow } from "@/lib/themes/builder/ribbon-flow";
import { RIBBON_THEME_SLUG } from "@/lib/themes/builder/ribbon-greeting";
import type { LayoutDoc } from "@/lib/themes/builder/types";
import type { LayoutOverrides } from "@/lib/themes/builder/resolve";

export function RibbonFlowPreset({ themeSlug, layout, overrides, published, disabled, onApply }: {
  themeSlug: string; layout: LayoutDoc; overrides: LayoutOverrides[];
  published: boolean; disabled: boolean; onApply: (layout: LayoutDoc) => void;
}) {
  if (themeSlug !== RIBBON_THEME_SLUG) return null;
  const proposal = proposeRibbonFlow(themeSlug, layout, overrides);
  return <section aria-label="تنسيق صفحات فيونكة الورد" className="rounded-xl border border-accent/30 bg-surface p-4 text-sm leading-7">
    <h2 className="font-semibold">فيونكة الورد · تنسيق الصفحات الخمس</h2>
    <p>العد التنازلي، كل ما يهمكم، برنامج اليوم، الملاحظات وتأكيد الحضور. عناوين أوضح وتفاصيل مرتبة، مع بقاء النصوص والصور والألوان والوظائف نفسها.</p>
    <p className="text-fg-muted">اقتراح قابل للتعديل والتراجع بخطوة واحدة. لا يغيّر الظرف أو الأسماء أو بطاقة الدخول، ولا يُحفظ تلقائيًا.</p>
    {published && <p className="text-warning">حفظ القالب المنشور يؤثر في الدعوات المرتبطة به. راجع النتيجة قبل الحفظ.</p>}
    {!proposal.ok && <p role="status" className="text-warning">{proposal.reason}</p>}
    <button type="button" disabled={disabled || !proposal.ok}
      className="mt-2 rounded-full border border-accent px-4 py-2 text-accent disabled:opacity-50"
      onClick={() => { if (proposal.ok) onApply(proposal.layout); }}>تطبيق تنسيق الصفحات الخمس</button>
  </section>;
}
