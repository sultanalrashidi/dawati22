"use client";

import { useEffect } from "react";
import { clearSessionHint, readSessionHint } from "@/lib/auth/session-hint";

/**
 * Rendered on the login page only when the server found no session. A role
 * cookie that is still there then belongs to a session that expired or was
 * revoked, and would keep the header offering «دعواتي» to someone who is
 * signed out — so it goes.
 */
export function ClearSessionHint() {
  useEffect(() => {
    if (readSessionHint()) clearSessionHint();
  }, []);
  return null;
}
