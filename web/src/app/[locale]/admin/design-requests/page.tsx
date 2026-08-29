import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requireUserOrRedirect } from "@/lib/auth/guards";
import { Role } from "@/generated/prisma/client";
import { listDesignRequests } from "@/lib/design-requests/service";
import { themeCategoryLabel, themeColorLabel } from "@/lib/themes/vocabulary";
import { DesignRequestRow } from "@/components/admin/design-request-row";

/**
 * The team's queue for custom design requests.
 *
 * Newest first and nothing hidden: a request that is finished still belongs on
 * the page, because "what did we deliver for this customer?" is the question
 * support gets, not "what is outstanding".
 */
export default async function AdminDesignRequestsPage({
  params,
}: PageProps<"/[locale]/admin/design-requests">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  await requireUserOrRedirect(locale, [Role.ADMIN]);

  const requests = await listDesignRequests();
  const d = dict.designRequest;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-fg">{d.adminTitle}</h1>

      {requests.length === 0 ? (
        <p className="mt-8 text-sm text-fg-muted">{d.adminEmpty}</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {requests.map((request) => (
            <DesignRequestRow
              key={request.id}
              locale={locale}
              dict={dict}
              request={{
                id: request.id,
                reference: request.reference,
                status: request.status,
                createdAt: request.createdAt.toISOString(),
                customerName: request.user.name,
                customerPhone: request.user.phone,
                eventId: request.event.id,
                eventName: request.event.name,
                colorLabels: request.colorTags
                  .map((tag) => themeColorLabel(tag, dict.themesGallery))
                  .filter((label): label is string => Boolean(label)),
                styleLabel: request.styleCategory
                  ? themeCategoryLabel(request.styleCategory, dict.themesGallery)
                  : null,
                inspirationName: request.inspirationTheme
                  ? locale === "ar"
                    ? request.inspirationTheme.nameAr
                    : request.inspirationTheme.name
                  : null,
                notes: request.notes,
                revisionCount: request.revisionCount,
                revisionNote: request.revisionNote,
                adminNote: request.adminNote,
                deliveredThemeId: request.deliveredThemeId,
                deliveredThemeName: request.deliveredTheme
                  ? locale === "ar"
                    ? request.deliveredTheme.nameAr
                    : request.deliveredTheme.name
                  : null,
                priceSar: Number(request.priceSar),
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
