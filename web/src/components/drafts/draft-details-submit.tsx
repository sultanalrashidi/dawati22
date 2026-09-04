"use client";

import { useFormStatus } from "react-dom";

/** Saves the details form and returns to the preview. */
export function DraftDetailsSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 rounded-full bg-fg text-sm font-bold text-bg transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {label}
    </button>
  );
}
