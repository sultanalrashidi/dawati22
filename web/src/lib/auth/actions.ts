"use server";

import { redirect } from "next/navigation";
import { destroySession } from "@/lib/auth/session";

export async function logoutAction(formData: FormData) {
  const locale = String(formData.get("locale") ?? "ar");
  await destroySession();
  redirect(`/${locale}`);
}
