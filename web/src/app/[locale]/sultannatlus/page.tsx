import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getSessionUser } from "@/lib/auth/session";
import { Role } from "@/generated/prisma/client";
import { AdminLoginForm } from "@/components/auth/admin-login-form";

export const metadata: Metadata = {
  title: "دعوتي",
  // Being unlisted is most of what this path is worth; a crawler indexing it
  // would undo that by itself.
  robots: { index: false, follow: false },
};

/**
 * The private admin sign-in, reached at `/sultannatlus` through a rewrite in
 * next.config.ts.
 *
 * It lives UNDER `[locale]` and not at the app root, which looks like the wrong
 * place for it and is the only place that works. Next.js has to tell the
 * browser which static segments sit beside a dynamic one so `/ar` can be
 * resolved, so every root-level folder name is printed into the flight payload
 * of every page — an earlier version of this route sat at the root and its path
 * was therefore in the HTML source of the home page. A child of `[locale]` is
 * never listed that way.
 *
 * The path is a speed bump regardless. What actually guards this route is the
 * password, the code sent to the account's phone, and the lockout.
 */
export default async function AdminSignInPage({
  params,
}: PageProps<"/[locale]/sultannatlus">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  // Already signed in as the admin? There is nothing to do here.
  const user = await getSessionUser();
  if (user?.role === Role.ADMIN) redirect(`/${locale}/admin`);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16 sm:px-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-fg">{dict.adminAuth.title}</h1>
        <p className="mt-2 text-sm text-fg-muted">{dict.adminAuth.subtitle}</p>
      </div>
      <AdminLoginForm locale={locale} dict={dict} />
    </div>
  );
}
