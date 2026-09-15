"use client";

import { useFormStatus } from "react-dom";

/**
 * A submit button that says it is working. The checkout's code and free
 * activation forms are server-rendered, and without this a second tap on a
 * slow connection raises a second order.
 */
export function PendingSubmit({
  label,
  pendingLabel,
  className,
}: {
  label: string;
  pendingLabel: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-60`}>
      {pending ? pendingLabel : label}
    </button>
  );
}
