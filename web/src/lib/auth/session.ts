import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/client";
import { generateSecureToken, sha256Hex } from "@/lib/security/tokens";
import type { Role } from "@/generated/prisma/client";

const SESSION_COOKIE = "dawati_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type SessionUser = {
  id: string;
  role: Role;
  name: string;
  phone: string | null;
  email: string | null;
  locale: "ar" | "en";
  isBlocked: boolean;
};

export async function createSession(userId: string, meta?: { userAgent?: string; ip?: string }) {
  const token = generateSecureToken();
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      userAgent: meta?.userAgent,
      ip: meta?.ip,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: sha256Hex(token) } });
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256Hex(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  if (session.user.isBlocked) return null;

  return {
    id: session.user.id,
    role: session.user.role,
    name: session.user.name,
    phone: session.user.phone,
    email: session.user.email,
    locale: session.user.locale,
    isBlocked: session.user.isBlocked,
  };
}
