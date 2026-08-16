import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({ params }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const user = await getSessionUser();
  if (user) redirect(`/${locale}`);

  const dict = await getDictionary(locale);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16 sm:px-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-fg">{dict.auth.loginTitle}</h1>
        <p className="mt-2 text-sm text-fg-muted">{dict.auth.loginSubtitle}</p>
      </div>
      <LoginForm locale={locale} dict={dict} />
    </div>
  );
}
