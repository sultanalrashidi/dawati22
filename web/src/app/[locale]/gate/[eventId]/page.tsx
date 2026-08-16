import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requireUserOrRedirect } from "@/lib/auth/guards";
import { assertGateAccess, CheckInAccessError } from "@/lib/checkin/service";
import { prisma } from "@/lib/db/client";
import { Role } from "@/generated/prisma/client";
import { GateScanner } from "@/components/gate/gate-scanner";

export default async function GateScannerPage({ params }: PageProps<"/[locale]/gate/[eventId]">) {
  const { locale, eventId } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const user = await requireUserOrRedirect(locale, [Role.GATE_STAFF]);

  try {
    await assertGateAccess(user.id, user.role, eventId);
  } catch (err) {
    if (err instanceof CheckInAccessError) notFound();
    throw err;
  }

  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { name: true } });
  if (!event) notFound();

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-8">
      <h1 className="text-xl font-semibold text-fg">{event.name}</h1>
      <GateScanner eventId={eventId} dict={dict} />
    </div>
  );
}
