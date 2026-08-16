import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { createOrderAction } from "@/lib/orders/actions";

export function PlanCard({
  locale,
  dict,
  plan,
  highlighted,
  canOrder,
}: {
  locale: Locale;
  dict: Dictionary;
  plan: { id: string; name: string; invitationCount: number; price: number; currency: string };
  highlighted?: boolean;
  canOrder: boolean;
}) {
  const boundCreateOrder = createOrderAction.bind(null, plan.id, locale);

  return (
    <div
      className={`flex flex-col gap-4 rounded-2xl border p-6 ${
        highlighted ? "border-accent bg-surface shadow-md" : "border-border bg-surface"
      }`}
    >
      {highlighted && (
        <span className="w-fit rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-fg">
          {dict.plans.mostPopular}
        </span>
      )}
      <h3 className="text-xl font-semibold text-fg">{plan.name}</h3>
      <p className="text-fg-muted">{dict.plans.invitations.replace("{count}", String(plan.invitationCount))}</p>
      <p className="text-3xl font-semibold text-fg">
        {plan.price.toLocaleString(locale === "ar" ? "ar-SA" : "en-US")}{" "}
        <span className="text-base font-normal text-fg-muted">{dict.common.sar}</span>
      </p>
      {canOrder ? (
        <form action={boundCreateOrder}>
          <button
            type="submit"
            className="h-11 w-full rounded-full bg-accent text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong"
          >
            {dict.plans.choose}
          </button>
        </form>
      ) : (
        <Link
          href={`/${locale}/login`}
          className="flex h-11 w-full items-center justify-center rounded-full bg-accent text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong"
        >
          {dict.plans.choose}
        </Link>
      )}
    </div>
  );
}
