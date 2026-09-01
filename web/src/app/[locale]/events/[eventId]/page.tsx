import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requireUserOrRedirect } from "@/lib/auth/guards";
import { getOwnedEvent, listPublishedThemes } from "@/lib/events/service";
import { getDesignRequestForEvent } from "@/lib/design-requests/service";
import { THEME_CATEGORIES, THEME_COLORS } from "@/lib/themes/vocabulary";
import { orderTerms } from "@/lib/orders/terms";
import { classifyRsvp } from "@/lib/invitations/service";
import { daysUntil, relativeTime } from "@/lib/events/activity";
import { guestInvitationUrl } from "@/lib/urls";
import { supportWhatsAppUrl } from "@/lib/support";
import { Role, EventGuestManagementMode } from "@/generated/prisma/client";
import { AddGuestForm } from "@/components/events/add-guest-form";
import { GuestRow } from "@/components/events/guest-row";
import { GatePinForm } from "@/components/events/gate-pin-form";
import { DesignRequestCard } from "@/components/events/design-request-card";
import { StartDesignRequestCard } from "@/components/events/custom-design-request-fields";

/**
 * The host's dashboard for one event.
 *
 * Every number on it is computed from rows that exist — invitations, their
 * statuses and timestamps, and the guest's own RSVP reply. Nothing is
 * illustrative. Where the product has no capability the panel is simply absent
 * rather than mocked: there is no automated outbound messaging, so there is no
 * "send reminders" button — sending is the host handing a link to WhatsApp,
 * one guest at a time, which is what the row actions do.
 */
export default async function EventDetailPage({
  params,
}: PageProps<"/[locale]/events/[eventId]">) {
  const { locale, eventId } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const user = await requireUserOrRedirect(locale, [Role.CUSTOMER]);

  const event = await getOwnedEvent(eventId, user.id);
  if (!event) notFound();

  // The custom design, if this event has one in flight. `listPublishedThemes`
  // only comes along when there is no request yet — it feeds the "close to my
  // idea" dropdown on the brief, and there is nothing to brief otherwise.
  const designRequest = await getDesignRequestForEvent(eventId, user.id);
  const designChoices = designRequest
    ? null
    : {
        colorTags: THEME_COLORS.map((c) => ({
          tag: c.tag,
          label: dict.themesGallery[c.dictKey],
        })),
        styles: THEME_CATEGORIES.filter((c) => c.dbValue !== null).map((c) => ({
          value: c.dbValue as string,
          label: dict.themesGallery[c.dictKey],
        })),
        designs: (await listPublishedThemes(user.id)).map((theme) => ({
          id: theme.id,
          name: locale === "ar" ? theme.nameAr : theme.name,
        })),
      };

  const d = dict.events.detail;
  const capacity = orderTerms(event.order).invitationCount;
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en-US");

  const rows = event.guests.map((guest) => {
    const invitation = guest.invitation;
    const reply = invitation?.rsvps[0] ?? null;
    const rsvp = classifyRsvp(invitation?.status);
    return {
      guest,
      invitation,
      reply,
      rsvp,
      // What the guest said they are bringing. Their allowance is the ceiling,
      // not the answer — a guest allowed 4 who replies "2" is 2 people.
      people: rsvp === "accepted" ? (reply?.partySize ?? guest.allowedCount) : 0,
      lastActivityAt: invitation?.respondedAt ?? invitation?.viewedAt ?? invitation?.sentAt ?? null,
    };
  });

  const sent = rows.filter((r) => r.invitation?.sentAt).length;
  const accepted = rows.filter((r) => r.rsvp === "accepted");
  const declined = rows.filter((r) => r.rsvp === "declined");
  const pending = rows.length - accepted.length - declined.length;
  const people = accepted.reduce((sum, r) => sum + r.people, 0);
  const pct = (n: number) => (sent > 0 ? Math.round((n / sent) * 100) : 0);

  const messages = rows
    .filter((r) => r.reply?.messageAr)
    .sort((a, b) => (b.reply!.respondedAt.getTime() ?? 0) - (a.reply!.respondedAt.getTime() ?? 0));

  const daysLeft = daysUntil(event.eventDate);
  const countdown =
    daysLeft > 0
      ? d.daysToEvent.replace("{count}", nf.format(daysLeft))
      : daysLeft === 0
        ? d.eventToday
        : d.eventPassed;

  const navItems = [
    { href: "#overview", label: d.overview },
    { href: "#guests", label: d.navGuests },
    ...(event.hasQr ? [{ href: "#gate", label: d.navGate }] : []),
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8 lg:flex-row lg:gap-8">
      {/* ── SIDE PANEL ─────────────────────────────────────────────────── */}
      <aside className="lg:sticky lg:top-24 lg:h-fit lg:w-64 lg:shrink-0">
        <div className="flex flex-col gap-4 rounded-2xl bg-fg p-5 text-bg">
          <div>
            <p className="text-[11px] tracking-wide text-bg/55">{d.currentEvent}</p>
            <p className="mt-1 font-display text-lg leading-snug">{event.name}</p>
          </div>

          <nav className="flex gap-1.5 overflow-x-auto lg:flex-col lg:overflow-visible">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-bg/75 transition-colors hover:bg-bg/10 hover:text-bg"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="mt-1 border-t border-bg/15 pt-4">
            <p className="flex items-baseline justify-between text-xs text-bg/70">
              <span>{locale === "ar" ? event.order.plan?.nameAr : event.order.plan?.name}</span>
              <span className="font-bold tabular-nums text-bg">
                {nf.format(rows.length)} / {nf.format(capacity)}
              </span>
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg/15">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${capacity > 0 ? Math.min(100, (rows.length / capacity) * 100) : 0}%` }}
              />
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN ───────────────────────────────────────────────────────── */}
      <div className="min-w-0 flex-1">
        <div id="overview" className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl text-fg">{d.overview}</h1>
          <span className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-fg-muted">
            {countdown}
          </span>
        </div>

        <p className="mt-3 rounded-xl border border-border bg-surface-2/60 px-4 py-3 text-xs leading-relaxed text-fg-muted">
          {d.dataLockedNotice}
        </p>

        {/* ── STATS ────────────────────────────────────────────────────── */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={d.statSent}
            value={nf.format(sent)}
            unit={d.statSentOf.replace("{count}", nf.format(capacity))}
          />
          <StatCard
            label={d.statAccepted}
            value={nf.format(accepted.length)}
            unit={d.statAcceptedPeople
              .replace("{guests}", nf.format(accepted.length))
              .replace("{people}", nf.format(people))}
            note={d.ofDelivered.replace("{percent}", nf.format(pct(accepted.length)))}
            tone="success"
          />
          <StatCard
            label={d.statDeclined}
            value={nf.format(declined.length)}
            unit={d.statGuestUnit}
            note={d.ofDelivered.replace("{percent}", nf.format(pct(declined.length)))}
            tone="danger"
          />
          <StatCard label={d.statPending} value={nf.format(pending)} unit={d.statGuestUnit} />
        </div>

        {/* ── RESPONSE BAR ─────────────────────────────────────────────── */}
        {sent > 0 && (
          <section className="mt-4 rounded-2xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <p className="text-sm font-bold text-fg">
                {d.responsesOn.replace("{count}", nf.format(sent))}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-fg-muted">
                <Legend className="bg-success" label={`${d.rsvpAccepted} ${nf.format(accepted.length)}`} />
                <Legend className="bg-danger" label={`${d.rsvpDeclined} ${nf.format(declined.length)}`} />
                <Legend className="bg-border" label={`${d.rsvpPending} ${nf.format(pending)}`} />
              </div>
            </div>
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div className="bg-success" style={{ width: `${(accepted.length / sent) * 100}%` }} />
              <div className="bg-danger" style={{ width: `${(declined.length / sent) * 100}%` }} />
            </div>
          </section>
        )}

        {/* The customer asked the Dawati team to send the invitations. Say so
            — and say what we need from them: the guest list below, then a
            WhatsApp ping so the team actually hears about it. The message
            carries the event's reference code, which is how support finds the
            right event without asking. */}
        {event.guestManagementMode === EventGuestManagementMode.ADMIN && (
          <section className="mt-4 rounded-2xl border border-accent/40 bg-accent-soft/15 px-5 py-4">
            <h2 className="text-base font-bold text-fg">{d.teamMgmtTitle}</h2>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">{d.teamMgmtBody}</p>
            <a
              href={supportWhatsAppUrl(
                d.teamMgmtWhatsappMessage
                  .replace("{name}", event.name)
                  .replace("{reference}", event.referenceCode ?? event.id.slice(-6)),
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong"
            >
              {d.teamMgmtCta}
            </a>
          </section>
        )}

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          {/* ── GUESTS ─────────────────────────────────────────────────── */}
          <section id="guests" className="order-2 xl:order-1">
            <div className="overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4">
                <h2 className="text-base font-bold text-fg">{d.latestReplies}</h2>
                <span className="text-xs text-fg-muted">
                  {d.seatsRemaining.replace("{count}", nf.format(Math.max(0, capacity - rows.length)))}
                </span>
              </div>

              {rows.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-fg-muted">{d.noGuestsYet}</p>
              ) : (
                <>
                  <div className="hidden grid-cols-[minmax(0,1.4fr)_auto_auto_minmax(0,1fr)_auto] gap-4 border-b border-border px-4 py-2.5 text-[11px] font-bold text-fg-muted sm:grid">
                    <span>{d.colGuest}</span>
                    <span className="text-center">{d.colCompanions}</span>
                    <span>{d.colStatus}</span>
                    <span>{d.colActivity}</span>
                    <span />
                  </div>
                  {rows.map(({ guest, invitation, reply, rsvp, lastActivityAt }) => (
                    <GuestRow
                      key={guest.id}
                      eventId={event.id}
                      locale={locale}
                      dict={dict}
                      guest={{
                        id: guest.id,
                        nameAr: guest.nameAr,
                        phone: guest.phone,
                        allowedCount: guest.allowedCount,
                        checkedInCount: guest.checkedInCount,
                        isBlocked: guest.isBlocked,
                      }}
                      companions={rsvp === "accepted" ? (reply?.partySize ?? guest.allowedCount) : null}
                      activity={
                        invitation?.respondedAt || invitation?.viewedAt
                          ? `${invitation.respondedAt ? "" : `${d.openedNoReply} · `}${
                              relativeTime(lastActivityAt, locale) ?? ""
                            }`
                          : // Unshared and unopened are different kinds of
                            // silence: one asks the host to act, the other to
                            // wait. sentAt distinguishes them.
                            invitation?.sentAt
                            ? d.notOpenedYet
                            : d.notSentYet
                      }
                      invitationUrl={invitation ? guestInvitationUrl(invitation.linkToken) : ""}
                      waMessage={
                        invitation
                          ? `${event.invitationTextAr}\n${guestInvitationUrl(invitation.linkToken)}`
                          : ""
                      }
                      rsvp={rsvp}
                    />
                  ))}
                </>
              )}
            </div>

            <div className="mt-4">
              <AddGuestForm eventId={event.id} locale={locale} dict={dict} />
            </div>
          </section>

          {/* ── SIDE CARDS ─────────────────────────────────────────────── */}
          <div className="order-1 flex flex-col gap-4 xl:order-2">
            {event.hasQr && (
              <section id="gate" className="rounded-2xl bg-fg p-5 text-bg">
                <h2 className="font-bold">{d.gateAccessTitle}</h2>
                <p className="mt-2 text-xs leading-relaxed text-bg/70">{d.gateHint}</p>

                {/* Events created before reference codes existed have none, and
                    an empty framed box reads as a fault rather than an absence. */}
                {event.referenceCode && (
                  <div className="mt-4 rounded-xl bg-bg/10 px-4 py-3">
                    <p className="text-[11px] text-bg/60">{d.referenceCodeLabel}</p>
                    <p dir="ltr" className="mt-1 text-center text-xl font-bold tracking-[0.3em]">
                      {event.referenceCode}
                    </p>
                  </div>
                )}

                <Link
                  href={`/${locale}/gate-access`}
                  className="mt-3 flex h-11 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-fg transition-colors hover:bg-accent-strong"
                >
                  {d.openScanner}
                </Link>

                <div className="mt-4 border-t border-bg/15 pt-4 [&_input]:text-fg">
                  <GatePinForm eventId={event.id} dict={dict} hasPinSet={Boolean(event.gatePinHash)} />
                </div>
              </section>
            )}

            {designRequest ? (
              <DesignRequestCard
                locale={locale}
                dict={dict}
                eventId={event.id}
                request={{
                  id: designRequest.id,
                  reference: designRequest.reference,
                  status: designRequest.status,
                  priceSar: Number(designRequest.priceSar),
                  revisionCount: designRequest.revisionCount,
                  deliveredThemeId: designRequest.deliveredThemeId,
                }}
              />
            ) : (
              designChoices && (
                <StartDesignRequestCard
                  locale={locale}
                  dict={dict}
                  eventId={event.id}
                  choices={designChoices}
                />
              )
            )}

            <section className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="text-base font-bold text-fg">{d.messagesTitle}</h2>
              {messages.length === 0 ? (
                <p className="mt-3 text-sm text-fg-muted">{d.messagesEmpty}</p>
              ) : (
                <ul className="mt-3 flex flex-col">
                  {messages.slice(0, 3).map(({ guest, reply }) => (
                    <li key={guest.id} className="border-b border-border py-3 last:border-b-0 last:pb-0">
                      <p className="text-sm leading-relaxed text-fg">«{reply!.messageAr}»</p>
                      <p className="mt-1 text-xs text-fg-muted">{reply!.guestNameAr || guest.nameAr}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  note,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  note?: string;
  tone?: "success" | "danger";
}) {
  const valueColor = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-fg";
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <p className="text-xs font-bold text-fg-muted">{label}</p>
      <p className="mt-2 flex items-baseline gap-2">
        <span className={`text-3xl font-bold tabular-nums ${valueColor}`}>{value}</span>
        <span className="text-xs text-fg-muted">{unit}</span>
      </p>
      {note && <p className="mt-1.5 text-[11px] text-fg-muted">{note}</p>}
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${className}`} />
      {label}
    </span>
  );
}
