"use client";

import { proposeRibbonGreeting, RIBBON_THEME_SLUG } from "@/lib/themes/builder/ribbon-greeting";
import type { LayoutDoc } from "@/lib/themes/builder/types";
import type { LayoutOverrides } from "@/lib/themes/builder/resolve";

export function RibbonGreetingPreset({ themeSlug, layout, overrides, published, disabled, onApply }: {
  themeSlug: string; layout: LayoutDoc; overrides: LayoutOverrides[];
  published: boolean; disabled: boolean; onApply: (layout: LayoutDoc) => void;
}) {
  if (themeSlug !== RIBBON_THEME_SLUG) return null;
  const proposal = proposeRibbonGreeting(themeSlug, layout, overrides);
  return (
    <section aria-label="تنسيق ترحيب فيونكة الورد" className="rounded-xl border border-accent/30 bg-surface p-4 text-sm leading-7">
      <h2 className="font-semibold">تنسيق الترحيب والأسماء · كل ألوان فيونكة الورد</h2>
      <p>يعيد ترتيب الطبقات الخمس ويبرز الأسماء، ويجمع التاريخ والوقت. تبقى النصوص مرتبطة ببيانات المناسبة وقابلة للتحرير، ولا تتغيّر الصور أو بطاقة الدخول.</p>
      <p className="text-fg-muted">التطبيق هنا للمراجعة فقط ويمكن التراجع عنه بزر ↶. لن يُحفظ حتى تضغط «حفظ».</p>
      {published && <p className="text-warning">تنبيه: حفظ قالب منشور يغيّر الدعوات المرتبطة به مباشرة. راجع جميع الألوان وخذ نسخة من التصميم قبل الحفظ.</p>}
      {!proposal.ok && <p role="status" className="text-warning">{proposal.reason}</p>}
      <button type="button" disabled={disabled || !proposal.ok}
        className="mt-2 rounded-full border border-accent px-4 py-2 text-accent disabled:opacity-50"
        onClick={() => { if (proposal.ok) onApply(proposal.layout); }}>
        تطبيق التنسيق على المحرر
      </button>
    </section>
  );
}
