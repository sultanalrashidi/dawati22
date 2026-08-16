import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getThemeForEdit } from "@/lib/admin/themes/service";
import { listEventsAdmin } from "@/lib/admin/service";
import { assignThemeToEventAction } from "@/lib/admin/themes/actions";
import type { ThemeConfig } from "@/lib/themes/types";
import { ThemeEditorForm } from "@/components/admin/theme-editor-form";
import { ThemeStatusActions } from "@/components/admin/theme-status-actions";
import { ThemeAssetManager } from "@/components/admin/theme-asset-manager";

export default async function EditThemePage({ params }: PageProps<"/[locale]/admin/themes/[themeId]">) {
  const { locale, themeId } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  const [theme, events] = await Promise.all([getThemeForEdit(themeId), listEventsAdmin()]);
  if (!theme) notFound();

  const boundAssign = assignThemeToEventAction.bind(null, themeId, locale);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-fg">{locale === "ar" ? theme.nameAr : theme.name}</h1>
        <ThemeStatusActions
          themeId={theme.id}
          locale={locale}
          dict={dict}
          status={theme.status}
          isUsed={theme._count.events > 0}
        />
      </div>

      <ThemeEditorForm
        locale={locale}
        dict={dict}
        theme={{
          id: theme.id,
          slug: theme.slug,
          name: theme.name,
          nameAr: theme.nameAr,
          category: theme.category,
          description: theme.description,
          descriptionAr: theme.descriptionAr,
          config: theme.config as unknown as ThemeConfig,
        }}
      />

      <section>
        <h2 className="text-lg font-semibold text-fg">{dict.admin.assets}</h2>
        <div className="mt-3">
          <ThemeAssetManager themeId={theme.id} locale={locale} dict={dict} assets={theme.assets} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-fg">{dict.events.form.themeLabel}</h2>
        <form action={boundAssign} className="mt-3 flex items-center gap-3">
          <select
            name="eventId"
            className="h-10 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent"
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-10 rounded-full bg-accent px-5 text-sm font-medium text-accent-fg hover:bg-accent-strong"
          >
            {dict.common.save}
          </button>
        </form>
      </section>
    </div>
  );
}
