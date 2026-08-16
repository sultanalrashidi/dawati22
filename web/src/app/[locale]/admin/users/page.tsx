import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { listUsers } from "@/lib/admin/service";
import { toggleUserBlockedAction } from "@/lib/admin/actions";

export default async function AdminUsersPage({ params }: PageProps<"/[locale]/admin/users">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const users = await listUsers();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-fg">{dict.admin.users}</h1>
      <div className="mt-6 flex flex-col gap-2">
        {users.map((user) => {
          const boundToggle = toggleUserBlockedAction.bind(null, user.id, locale, !user.isBlocked);
          return (
            <div
              key={user.id}
              className="flex items-center justify-between rounded-xl border border-border bg-surface p-4"
            >
              <div>
                <p className="font-medium text-fg">
                  {user.name}
                  {user.isBlocked && (
                    <span className="ms-2 rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger">
                      {dict.events.detail.blocked}
                    </span>
                  )}
                </p>
                <p className="text-sm text-fg-muted" dir="ltr">
                  {user.phone ?? user.email}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-fg-muted">{user.role}</span>
                <form action={boundToggle}>
                  <button type="submit" className="text-xs text-fg-muted hover:text-fg hover:underline">
                    {user.isBlocked ? dict.admin.unblock : dict.admin.block}
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
