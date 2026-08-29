import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requireUserOrRedirect } from "@/lib/auth/guards";
import { Role } from "@/generated/prisma/client";
import { adminHasPassword } from "@/lib/auth/admin-login";
import { isTestPhoneBypassEnabled } from "@/lib/settings/service";
import { SecurityPanel } from "@/components/admin/security-panel";

export default async function AdminSecurityPage({
  params,
}: PageProps<"/[locale]/admin/security">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const user = await requireUserOrRedirect(locale, [Role.ADMIN]);

  const [hasPassword, bypassEnabled] = await Promise.all([
    adminHasPassword(user.id),
    isTestPhoneBypassEnabled(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-fg">{dict.adminAuth.securityTitle}</h1>
      <div className="mt-6">
        <SecurityPanel
          locale={locale}
          dict={dict}
          hasPassword={hasPassword}
          bypassEnabled={bypassEnabled}
        />
      </div>
    </div>
  );
}
