/**
 * A viewfinder with a scan line through it — the door team's scanner.
 *
 * Shared by the header button and the home page's door section on purpose: the
 * icon a visitor reads about in "how it works" is the same shape they then look
 * for in the header on the night of the event.
 */
export function ScanIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 8.5V6a2 2 0 0 1 2-2h2.5" />
      <path d="M15.5 4H18a2 2 0 0 1 2 2v2.5" />
      <path d="M20 15.5V18a2 2 0 0 1-2 2h-2.5" />
      <path d="M8.5 20H6a2 2 0 0 1-2-2v-2.5" />
      <path d="M7 12h10" />
    </svg>
  );
}
