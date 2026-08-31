import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { LegalDoc } from "@/lib/legal/documents";
import { SUPPORT_EMAIL, supportWhatsAppUrl } from "@/lib/support";

/**
 * Renders one legal document — terms, privacy or refunds — from its structured
 * content. Layout direction (RTL for Arabic) comes from <html dir> in the
 * locale layout, so this component stays direction-agnostic and uses logical
 * spacing (`ps-*`) for the bullet lists.
 *
 * A section's `contact` line is rendered with tappable WhatsApp and email
 * links: the reader sees the channel name and taps it to open WhatsApp or their
 * mail app — the phone number and address themselves are never shown.
 */
export function LegalPage({
  doc,
  labels,
}: {
  doc: LegalDoc;
  /** The `legal` slice of the dictionary — link labels and connective words. */
  labels: Dictionary["legal"];
}) {
  const whatsAppUrl = supportWhatsAppUrl(labels.contactWhatsappMessage);
  const emailUrl = `mailto:${SUPPORT_EMAIL}`;
  const linkClass = "font-semibold text-accent hover:text-accent-strong";

  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
      <h1 className="text-3xl font-semibold text-fg">{doc.title}</h1>
      <p className="mt-2 text-sm text-fg-muted">
        {labels.updatedPrefix}: {doc.updated}
      </p>

      {doc.intro.length > 0 && (
        <div className="mt-6 space-y-4 leading-relaxed text-fg-muted">
          {doc.intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}

      {doc.sections.map((section, i) => (
        <section key={i} className="mt-10">
          <h2 className="text-lg font-semibold text-fg">{section.heading}</h2>

          {section.body && section.body.length > 0 && (
            <div className="mt-3 space-y-3 leading-relaxed text-fg-muted">
              {section.body.map((p, j) => (
                <p key={j}>{p}</p>
              ))}
            </div>
          )}

          {section.contact && (
            <p className="mt-3 leading-relaxed text-fg-muted">
              {section.contact.lead} {labels.contactVia}{" "}
              <a href={whatsAppUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                {labels.contactWhatsapp}
              </a>{" "}
              {labels.contactOr}{" "}
              <a href={emailUrl} className={linkClass}>
                {labels.contactEmail}
              </a>
              {section.contact.trailing ?? "."}
            </p>
          )}

          {section.bullets && section.bullets.length > 0 && (
            <ul className="mt-3 list-disc space-y-2 ps-5 leading-relaxed text-fg-muted">
              {section.bullets.map((b, j) => (
                <li key={j}>{b}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </article>
  );
}
