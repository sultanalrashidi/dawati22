import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getLegalDoc } from "@/lib/legal/documents";
import { LegalPage } from "@/components/legal/legal-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getLegalDoc(locale, "privacy").title };
}

export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  return <LegalPage doc={getLegalDoc(locale, "privacy")} updatedLabel={dict.legal.updatedPrefix} />;
}
