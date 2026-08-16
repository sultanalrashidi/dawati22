import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requireUserOrRedirect } from "@/lib/auth/guards";
import { listAssignedEvents } from "@/lib/checkin/service";
import { Role } from "@/generated/prisma/client";

export default async function GateHomePage({ params }: PageProps<"/[locale]/gate">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const user = await requireUserOrRedirect(locale, [Role.GATE_STAFF]);

  const events = await listAssignedEvents(user.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-8">
      <h1 className="text-2xl font-semibold text-fg">{dict.gate.title}</h1>
      <p className="mt-1 text-sm text-fg-muted">{dict.gate.myEvents}</p>

      {events.length === 0 ? (
        <p className="mt-8 text-fg-muted">{dict.gate.noEvents}</p>
      ) : (
        <div className="mt-8 flex flex-col gap-3">
          {events.map((event) => {
            const checkedIn = event.guests.reduce((sum, g) => sum + g.checkedInCount, 0);
            return (
              <Link
                key={event.id}
                href={`/${locale}/gate/${event.id}`}
                className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent"
              >
                <span className="font-medium text-fg">{event.name}</span>
                <span className="text-sm text-fg-muted">
                  {checkedIn} / {event.guests.length}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
