import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import type { Role } from "@/generated/prisma/client";

export class AuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthError";
  }
}

/** For Server Components / layouts: redirects instead of throwing. */
export async function requireUserOrRedirect(
  locale: string,
  allowedRoles?: Role[]
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || (allowedRoles && !allowedRoles.includes(user.role))) {
    redirect(`/${locale}/login`);
  }
  return user;
}

/**
 * For Server Functions / Route Handlers: throws instead of redirecting.
 * Every mutating/sensitive server function must call this itself —
 * proxy.ts route matching can be refactored around and must not be the only guard.
 */
export async function requireUserOrThrow(allowedRoles?: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || (allowedRoles && !allowedRoles.includes(user.role))) {
    throw new AuthError();
  }
  return user;
}
