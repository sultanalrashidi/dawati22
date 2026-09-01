"use client";

import { useState } from "react";

/**
 * Copies a prepared string to the clipboard and flashes a confirmation. Used on
 * the admin guests page for one invitation link, and for the whole list at
 * once — the only part of that page that needs to run on the client.
 */
export function CopyTextButton({
  text,
  label,
  copiedLabel,
  className,
}: {
  text: string;
  label: string;
  copiedLabel: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={className ?? "text-xs text-accent hover:underline"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard can be refused (permissions, non-secure context); the
          // button simply not confirming is the honest signal.
        }
      }}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
