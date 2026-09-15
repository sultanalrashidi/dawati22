import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { listDiscountCodes } from "@/lib/discounts/service";
import { codeRefusal } from "@/lib/discounts/rules";
import { deleteDiscountCodeAction, setDiscountCodeActiveAction } from "@/lib/admin/actions";
import { DiscountCodeForm } from "@/components/admin/discount-code-form";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { riyadhDateFormat, toRiyadhDateTimeLocal } from "@/lib/dates";

/**
 * The owner's discount codes: a form for a new one (or the one being edited,
 * `?edit=<id>`), then every code with what it takes off, how often it has been
 * used and whether it works right now.
 */
export default async function AdminDiscountsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/discounts">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const search = await searchParams;
  const dict = await getDictionary(locale);
  const a = dict.admin;

  const codes = await listDiscountCodes();
  const editId = typeof search?.edit === "string" ? search.edit : null;
  const editing = editId ? (codes.find((code) => code.id === editId) ?? null) : null;

  const now = new Date();
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en-US");
  const when = riyadhDateFormat(locale === "ar" ? "ar-SA-u-ca-gregory" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-fg">{a.discounts}</h1>
      <p className="mt-2 max-w-prose text-sm text-fg-muted">{a.discountsIntro}</p>

      <div className="mt-6">
        <DiscountCodeForm
          // A fresh form per code, so switching from one edit to another (or
          // back to a new code) starts from that code's own values.
          key={editing?.id ?? "new"}
          locale={locale}
          dict={dict}
          editing={editing ? { id: editing.id, code: editing.code } : null}
          defaults={{
            kind: editing?.kind ?? "PERCENT",
            value: editing?.value ?? null,
            maxUses: editing?.maxUses ?? null,
            startsAt: editing?.startsAt ? toRiyadhDateTimeLocal(editing.startsAt) : "",
            endsAt: editing?.endsAt ? toRiyadhDateTimeLocal(editing.endsAt) : "",
          }}
        />
      </div>

      <section className="mt-8 flex flex-col gap-3">
        {codes.length === 0 && <p className="text-sm text-fg-muted">{a.discountEmpty}</p>}
        {codes.map((code) => {
          const status = codeRefusal(code, code.paidUses, now) ?? "live";
          const dates = [
            code.startsAt ? a.discountWindowFrom.replace("{date}", when.format(code.startsAt)) : null,
            code.endsAt ? a.discountWindowUntil.replace("{date}", when.format(code.endsAt)) : a.discountNoWindow,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <div
              key={code.id}
              className={`rounded-xl border bg-surface p-4 ${
                code.id === editing?.id ? "border-accent" : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-lg font-bold text-fg">
                    <span dir="ltr">{code.code}</span>
                  </p>
                  <p className="mt-1 text-sm text-fg">
                    {(code.kind === "PERCENT" ? a.discountValuePercent : a.discountValueFixed).replace(
                      "{value}",
                      nf.format(code.value),
                    )}
                  </p>
                  <p className="mt-1 text-xs text-fg-muted">
                    {code.maxUses !== null
                      ? a.discountUses
                          .replace("{used}", nf.format(code.paidUses))
                          .replace("{max}", nf.format(code.maxUses))
                      : a.discountUsesUnlimited.replace("{used}", nf.format(code.paidUses))}
                    {" · "}
                    {dates}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                    status === "live" ? "bg-success/10 text-success" : "bg-surface-2 text-fg-muted"
                  }`}
                >
                  {a.discountStatus[status]}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <form action={setDiscountCodeActiveAction.bind(null, code.id, locale, !code.active)}>
                  <button
                    type="submit"
                    className="h-9 rounded-full border border-border px-4 text-xs font-medium text-fg transition-colors hover:border-accent"
                  >
                    {code.active ? a.discountDeactivate : a.discountActivate}
                  </button>
                </form>
                <Link
                  href={`/${locale}/admin/discounts?edit=${code.id}`}
                  className="flex h-9 items-center rounded-full border border-border px-4 text-xs font-medium text-fg transition-colors hover:border-accent"
                >
                  {a.discountEditLink}
                </Link>
                {/* Only a code no order ever carried; a used one is switched off instead. */}
                {code.deletable && (
                  <form action={deleteDiscountCodeAction.bind(null, code.id, locale)}>
                    <ConfirmSubmitButton
                      confirmMessage={a.discountDeleteConfirm}
                      className="h-9 rounded-full px-4 text-xs font-medium text-danger hover:bg-danger/5"
                    >
                      {a.discountDelete}
                    </ConfirmSubmitButton>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
