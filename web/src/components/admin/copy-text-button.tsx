"use client";

import { useState } from "react";

/**
 * Copies a prepared string to the clipboard and flashes a confirmation. Used on
 * the admin guests page for one invitation link, and for the whole list at
 * once — the only part of that page that needs to run on the client.
 *
 * It only copies. Copying the whole list used to record every invitation as
 * sent, and copying is not sending: see `toggleGuestMgmtDoneAction`.
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
        } catch {
          // Clipboard can be refused (permissions, non-secure context); the
          // button simply not confirming is the honest signal.
          return;
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
