"use client";

import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

/**
 * A notice driven by one query parameter, for pages served as static files —
 * they are the same bytes for every visitor, so the server cannot read the
 * query that an action redirected back with (`?error=rate`). Nothing renders
 * on the server or during hydration; the message appears once the browser's
 * address is known.
 */
export function QueryNotice({
  param,
  messages,
  fallback,
  className,
}: {
  param: string;
  /** Message per value of the parameter; anything else shows `fallback`. */
  messages?: Record<string, string>;
  fallback: string;
  className: string;
}) {
  const value = useSyncExternalStore(
    subscribeNever,
    () => new URLSearchParams(window.location.search).get(param),
    () => null,
  );
  if (!value) return null;
  return <p className={className}>{messages?.[value] ?? fallback}</p>;
}
