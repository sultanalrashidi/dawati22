import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { listGateStaff } from "@/lib/admin/service";

export default async function AdminGateStaffPage({ params }: PageProps<"/[locale]/admin/gate-staff">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const gateStaff = await listGateStaff();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-fg">{dict.admin.gateStaff}</h1>
      <div className="mt-6 flex flex-col gap-2">
        {gateStaff.map((staff) => (
          <div key={staff.id} className="rounded-xl border border-border bg-surface p-4">
            <p className="font-medium text-fg">{staff.user.name}</p>
            <p className="text-sm text-fg-muted" dir="ltr">
              {staff.phone}
            </p>
            {staff.assignments.length === 0 ? (
              <p className="mt-2 text-sm text-fg-muted">{dict.admin.noAssignments}</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {staff.assignments.map((a) => (
                  <span key={a.id} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-fg-muted">
                    {a.event.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
