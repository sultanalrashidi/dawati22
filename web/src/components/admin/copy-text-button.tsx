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
  onCopied,
}: {
  text: string;
  label: string;
  copiedLabel: string;
  className?: string;
  /**
   * Fired after a successful copy — for the "copy all links" button, where the
   * copy IS the send and nothing else would ever record it.
   *
   * Fire-and-forget on purpose: the links are already on the clipboard by the
   * time this runs, so a failure here must not look like a failure to copy.
   */
  onCopied?: () => void;
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
        // Outside the try: the links are on the clipboard by now, and a
        // failure to RECORD the send must not read as a failure to copy.
        try {
          onCopied?.();
        } catch {
          // Recorded on a best-effort basis, exactly like the per-row share.
        }
      }}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
