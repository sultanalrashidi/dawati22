import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { CreateThemeForm } from "@/components/admin/builder/create-theme-form";

export default async function NewBuilderThemePage({
  params,
}: PageProps<"/[locale]/admin/themes/builder/new">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  return (
    <div>
      <Link href={`/${locale}/admin/themes`} className="text-sm text-fg-muted hover:text-fg">
        {dict.admin.themes}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-fg">{dict.admin.newThemeTitle}</h1>
      <div className="mt-6">
        <CreateThemeForm locale={locale} dict={dict} />
      </div>
    </div>
  );
}
