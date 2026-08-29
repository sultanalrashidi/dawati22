import { redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getSessionUser } from "@/lib/auth/session";
import { defaultLocale } from "@/lib/i18n/locales";
import { Role } from "@/generated/prisma/client";
import { AdminLoginForm } from "@/components/auth/admin-login-form";

/**
 * The private admin sign-in.
 *
 * Outside the `[locale]` tree on purpose: the path is the only thing keeping it
 * unadvertised, and a localised twin would double the surface for no gain. It
 * is not linked from anywhere in the product.
 */

export default async function AdminSignInPage() {
  const dict = await getDictionary(defaultLocale);

  // Already signed in as the admin? There is nothing to do here.
  const user = await getSessionUser();
  if (user?.role === Role.ADMIN) redirect(`/${defaultLocale}/admin`);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16 sm:px-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-fg">{dict.adminAuth.title}</h1>
        <p className="mt-2 text-sm text-fg-muted">{dict.adminAuth.subtitle}</p>
      </div>
      <AdminLoginForm locale={defaultLocale} dict={dict} />
    </div>
  );
}
