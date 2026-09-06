import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { prisma } from "@/lib/db/client";
import { getGateSessionEventId } from "@/lib/gatepin/session";
import { exitGateAccessAction } from "@/lib/gatepin/actions";
import { GateScanner } from "@/components/gate/gate-scanner";
import { GateAccessForm } from "@/components/gate/gate-access-form";

export default async function GateAccessPage({ params }: PageProps<"/[locale]/gate-access">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const g = dict.gateAccess;

  const eventId = await getGateSessionEventId();
  const event = eventId ? await prisma.event.findUnique({ where: { id: eventId }, select: { name: true } }) : null;

  if (event) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 sm:px-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-fg">{event.name}</h1>
          <form action={exitGateAccessAction}>
            <button type="submit" className="text-xs text-fg-muted hover:text-fg hover:underline">
              {g.exit}
            </button>
          </form>
        </div>
        <GateScanner eventId={eventId!} dict={dict} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-8">
      <h1 className="text-xl font-semibold text-fg">{g.title}</h1>
      <p className="mt-1 text-sm text-fg-muted">{g.subtitle}</p>
      <GateAccessForm dict={dict} />
    </div>
  );
}
