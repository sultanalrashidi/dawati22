import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { prisma } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { PlanCard } from "@/components/plans/plan-card";

export default async function PlansPage({ params }: PageProps<"/[locale]/plans">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  const [plans, user] = await Promise.all([
    prisma.plan.findMany({ where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } }),
    getSessionUser(),
  ]);
  const canOrder = user?.role === "CUSTOMER";

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-8">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-fg">{dict.plans.title}</h1>
        <p className="mt-2 text-fg-muted">{dict.plans.subtitle}</p>
      </div>

      {plans.length === 0 ? (
        <p className="mt-12 text-center text-fg-muted">{dict.common.empty}</p>
      ) : (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan, i) => (
            <PlanCard
              key={plan.id}
              locale={locale}
              dict={dict}
              plan={{
                id: plan.id,
                name: locale === "ar" ? plan.nameAr : plan.name,
                invitationCount: plan.invitationCount,
                price: Number(plan.price),
                currency: plan.currency,
              }}
              highlighted={i === 1}
              canOrder={canOrder}
            />
          ))}
        </div>
      )}
    </div>
  );
}
