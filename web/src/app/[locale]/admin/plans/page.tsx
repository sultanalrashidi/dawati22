import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { listPlans } from "@/lib/admin/service";
import { PlansManager } from "@/components/admin/plans-manager";

export default async function AdminPlansPage({ params }: PageProps<"/[locale]/admin/plans">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const plans = await listPlans();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-fg">{dict.admin.plans}</h1>
      <div className="mt-6">
        <PlansManager
          locale={locale}
          dict={dict}
          plans={plans.map((p) => ({
            id: p.id,
            name: p.name,
            nameAr: p.nameAr,
            invitationCount: p.invitationCount,
            price: Number(p.price),
            sortOrder: p.sortOrder,
            status: p.status,
          }))}
        />
      </div>
    </div>
  );
}
