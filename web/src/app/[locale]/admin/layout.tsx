import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requireUserOrRedirect } from "@/lib/auth/guards";
import { Role } from "@/generated/prisma/client";

export default async function AdminLayout({
  children,
  params,
}: LayoutProps<"/[locale]/admin">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  await requireUserOrRedirect(locale, [Role.ADMIN]);

  const links = [
    [`/${locale}/admin`, dict.admin.dashboard],
    [`/${locale}/admin/users`, dict.admin.users],
    [`/${locale}/admin/events`, dict.admin.events],
    [`/${locale}/admin/orders`, dict.admin.orders],
    [`/${locale}/admin/plans`, dict.admin.plans],
    [`/${locale}/admin/themes`, dict.admin.themes],
    [`/${locale}/admin/gate-staff`, dict.admin.gateStaff],
  ] as const;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-8 md:flex-row">
      <nav className="flex shrink-0 gap-2 overflow-x-auto md:w-48 md:flex-col md:overflow-visible">
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
