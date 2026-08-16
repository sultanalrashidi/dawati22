import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { ThemeEditorForm } from "@/components/admin/theme-editor-form";

export default async function NewThemePage({ params }: PageProps<"/[locale]/admin/themes/new">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-fg">{dict.admin.addTheme}</h1>
      <div className="mt-6">
        <ThemeEditorForm locale={locale} dict={dict} />
      </div>
    </div>
  );
}
