import type { Dictionary } from "@/lib/i18n/get-dictionary";

/**
 * The feature comparison under the picker on /plans, written for someone
 * seeing the product for the first time: what both options include, and what
 * only a door code adds. Every row is something the product ships today —
 * marketing copy the product cannot honour is a support ticket, not a table.
 *
 * The wallet row is the one line the environment decides. It renders only
 * when the server says a wallet can actually issue passes, so the page never
 * advertises a button the invitation will not show.
 */
export function TierComparison({
  dict,
  walletAvailable,
}: {
  dict: Dictionary;
  /** `walletPassesConfigured()`, read on the server. */
  walletAvailable: boolean;
}) {
  const p = dict.plans;
  const c = p.compare;

  const groups = [
    { key: "invitation", title: c.groupInvitation },
    { key: "followUp", title: c.groupFollowUp },
    { key: "door", title: c.groupDoor },
  ] as const;

  // The wallet pass is listed with the invitation, straight after the calendar
  // row that closes that group in the dictionary: both are things a guest saves
  // to the phone from the invitation. It stays barcode-only (the pass carries
  // the QR the door scanner reads), hence the dash under «بدون باركود».
  const rows = [
    ...c.rows,
    ...(walletAvailable
      ? [{ group: "invitation", label: c.walletLabel, hint: c.walletHint, qr: true, noQr: false }]
      : []),
  ];

  return (
    <section id="compare" aria-labelledby="compare-title" className="scroll-mt-24">
      <h2 id="compare-title" className="text-xl font-bold text-fg">
        {c.title}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-fg-muted">{c.subtitle}</p>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="sr-only">
                {c.featureColumn}
              </th>
              <th
                scope="col"
                className="w-16 px-1 py-3 text-center text-xs font-bold text-accent sm:w-24 sm:text-sm"
              >
                {p.tierQr}
              </th>
              <th
                scope="col"
                className="w-16 px-1 py-3 text-center text-xs font-bold text-fg sm:w-24 sm:text-sm"
              >
                {p.tierNoQr}
              </th>
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.key}>
              <tr>
                <th
                  scope="rowgroup"
                  colSpan={3}
                  className="bg-surface-2/60 px-4 py-2 text-start text-xs font-bold text-fg-muted"
                >
                  {group.title}
                </th>
              </tr>
              {rows
                .filter((row) => row.group === group.key)
                .map((row) => (
                  <tr key={row.label} className="border-t border-border">
                    <th scope="row" className="px-4 py-3 text-start font-medium text-fg">
                      {row.label}
                      {row.hint && (
                        <span className="mt-0.5 block text-xs font-normal leading-relaxed text-fg-muted">
                          {row.hint}
                        </span>
                      )}
                    </th>
                    <Cell included={row.qr} dict={dict} />
                    <Cell included={row.noQr} dict={dict} />
                  </tr>
                ))}
            </tbody>
          ))}
        </table>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-fg-muted">{p.noQrDoorNote}</p>
      <p className="mt-3 rounded-xl bg-accent-soft/10 px-4 py-3 text-sm leading-relaxed text-fg">
        {c.pickHint}
      </p>
    </section>
  );
}

function Cell({ included, dict }: { included: boolean; dict: Dictionary }) {
  const c = dict.plans.compare;
  return (
    <td className="px-1 py-3 text-center align-top">
      {included ? (
        <Tick />
      ) : (
        <span aria-hidden="true" className="text-fg-muted/50">
          —
        </span>
      )}
      {/* The tick and the dash say nothing to a screen reader. */}
      <span className="sr-only">{included ? c.included : c.notIncluded}</span>
    </td>
  );
}

function Tick() {
  return (
    <svg
      className="inline-block h-4 w-4 text-success"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}
