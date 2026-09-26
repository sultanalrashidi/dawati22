import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requireUserOrRedirect } from "@/lib/auth/guards";
import { getOwnedEvent, listPublishedThemes } from "@/lib/events/service";
import { getDesignRequestForEvent } from "@/lib/design-requests/service";
import { THEME_CATEGORIES, THEME_COLORS } from "@/lib/themes/vocabulary";
import { classifyRsvp } from "@/lib/invitations/service";
import { attendanceSnapshot, daysUntil, eventHasStarted, relativeTime } from "@/lib/events/activity";
import { gateLinkUrl, guestInvitationUrl, testInvitationUrl } from "@/lib/urls";
import { invitationShareText } from "@/lib/events/share-text";
import { supportWhatsAppUrl } from "@/lib/support";
import { Role, EventGuestManagementMode } from "@/generated/prisma/client";
import { AddGuestForm } from "@/components/events/add-guest-form";
import { ImportGuestsPanel } from "@/components/events/import-guests-panel";
import { GuestList } from "@/components/events/guest-list";
import { GatePinForm } from "@/components/events/gate-pin-form";
import { GateLinkCard } from "@/components/events/gate-link-card";
import { DesignRequestCard } from "@/components/events/design-request-card";
import { StartDesignRequestCard } from "@/components/events/custom-design-request-fields";
import { TestInvitationCard } from "@/components/events/test-invitation-card";
import { ensureSelfPreviewToken } from "@/lib/preview/self";
import { riyadhDateFormat } from "@/lib/dates";
import { eventCapacity } from "@/lib/events/capacity";
import { LiveAttendance } from "@/components/events/live-attendance";

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

  // Minted here rather than assumed: every event activated before the test
  // invitation shipped has a null token, and the column is unique, so a
  // blanket backfill is exactly the migration that fails halfway.
  const testToken = await ensureSelfPreviewToken(eventId, user.id);

  const d = dict.events.detail;
  // What she may USE: bought plus granted. The receipt screen deliberately
  // shows a different number — see `@/lib/events/capacity`.
  const capacity = eventCapacity(event);
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-arab" : "en-US");
  // The line above the link in the WhatsApp message a host sends each guest:
  // her extra text if she wrote one, else the composed invitation sentence.
  const shareText = invitationShareText(event);

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
  // The send queue's own predicate, computed here from rows this page already
  // has — the two screens must never disagree about how many are left, and
  // that is only guaranteed by both asking the same question. Blocked guests
  // are out of both: you do not send to somebody you have blocked.
  const unsent = rows.filter((r) => !r.guest.isBlocked && !r.invitation?.sentAt).length;
  const accepted = rows.filter((r) => r.rsvp === "accepted");
  const declined = rows.filter((r) => r.rsvp === "declined");
  const pending = rows.length - accepted.length - declined.length;
  const people = accepted.reduce((sum, r) => sum + r.people, 0);
  const pct = (n: number) => (sent > 0 ? Math.round((n / sent) * 100) : 0);

  // A declined guest gives her invitation back — the host can invite someone
  // else in her place — so she is not counted against the plan's capacity.
  // Mirrors the check in guests/service.ts addGuest(); deleting her row must
  // never free a slot a second time, which is exactly why this counts
  // everyone EXCEPT the declined, rather than counting the declined and
  // subtracting them from rows.length.
  const occupiedSlots = rows.length - declined.length;

  // Door check-ins, not RSVPs: who actually showed up versus who only said
  // yes. Only meaningful once the event has happened — mid-event it would
  // just read as "look who hasn't arrived yet", which isn't the point.
  const attendedRows = rows.filter((r) => r.guest.checkedInCount > 0);
  const noShowRows = accepted.filter((r) => r.guest.checkedInCount === 0);
  // PEOPLE, not envelopes. This card used to print `attendedRows.length` under
  // the unit "ضيفاً" — the number of invitations that had been scanned at
  // least once — directly below another card that counts people correctly. So
  // the host read "118 attended" on a night 240 women walked in. One invitation
  // can carry four of them, which is the whole point of the seat count.
  const attendedPeople = attendedRows.reduce((sum, r) => sum + r.guest.checkedInCount, 0);

  // The report refreshes itself while the night is actually happening, and
  // stops once it plainly is not.
  const report = attendanceSnapshot(event.eventDate);

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
  // The attendance report's own switch: it exists on the page from day one,
  // but only turns on once the event's own start time has actually passed —
  // `daysLeft` is day-granular ("today") and would flip it on hours too early.
  const eventStarted = eventHasStarted(event.eventDate);

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
            <p className="mt-1 text-lg font-bold leading-snug">{event.name}</p>
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
              <span>{locale === "ar" ? event.order?.plan?.nameAr : event.order?.plan?.name}</span>
              <span className="font-bold tabular-nums text-bg">
                {nf.format(occupiedSlots)} / {nf.format(capacity)}
              </span>
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg/15">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${capacity > 0 ? Math.min(100, (occupiedSlots / capacity) * 100) : 0}%` }}
              />
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN ───────────────────────────────────────────────────────── */}
      <div className="min-w-0 flex-1">
        {/* ── GATE ─────────────────────────────────────────────────────── */}
        {event.hasQr && (
          <section id="gate" className="rounded-2xl bg-fg p-5 text-bg">
            <h2 className="font-bold">{d.gateAccessTitle}</h2>
            <p className="mt-2 text-xs leading-relaxed text-bg/70">{d.gateHint}</p>
            <ol className="mt-2 flex flex-col gap-1.5 text-xs leading-relaxed text-bg/70">
              {d.gateSteps.map((step, i) => (
                <li key={step} className="flex gap-2">
                  <span className="shrink-0 font-bold text-bg/50">{nf.format(i + 1)}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

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

            <div className="mt-4 flex flex-col gap-3 border-t border-bg/15 pt-4 [&_input]:text-fg">
              <GateLinkCard
                eventId={event.id}
                locale={locale}
                dict={dict}
                url={event.gateLinkToken ? gateLinkUrl(event.gateLinkToken) : null}
              />
              <GatePinForm eventId={event.id} dict={dict} hasPinSet={Boolean(event.gatePinHash)} />
            </div>
          </section>
        )}

        {/* ── OVERVIEW ─────────────────────────────────────────────────── */}
        <div id="overview" className={`flex flex-wrap items-center justify-between gap-3 ${event.hasQr ? "mt-6" : ""}`}>
          <h1 className="text-2xl font-bold text-fg sm:text-3xl">{d.overview}</h1>
          <span className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-fg-muted">
            {countdown}
          </span>
        </div>

        {/* ── EDIT LOCK ────────────────────────────────────────────────
            Two states, decided by one column. Activation is orderId; this is
            detailsLockedAt, stamped by the first invitation that actually
            reaches a guest — not by paying, and not by adding guests. */}
        {event.detailsLockedAt === null ? (
          <section className="mt-3 rounded-2xl border border-accent/40 bg-accent-soft/15 px-5 py-4">
            <h2 className="text-base font-bold text-fg">{d.editableTitle}</h2>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">{d.editableBody}</p>
            <Link
              href={`/${locale}/events/${eventId}/details`}
              className="mt-3 inline-block rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-strong"
            >
              {d.editableCta}
            </Link>
          </section>
        ) : (
          <section className="mt-3 rounded-xl border border-border bg-surface-2/60 px-4 py-3">
            <h2 className="text-xs font-bold text-fg">{d.lockedTitle}</h2>
            <p className="mt-1 text-xs leading-relaxed text-fg-muted">
              {d.lockedBody.replace(
                "{date}",
                riyadhDateFormat(locale === "ar" ? "ar-SA-u-ca-gregory" : "en-US", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(event.detailsLockedAt),
              )}
            </p>
            <a
              href={supportWhatsAppUrl(
                d.lockedWhatsappMessage
                  .replace("{name}", event.name)
                  .replace("{reference}", event.referenceCode ?? event.id.slice(-6)),
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs font-bold text-accent hover:underline"
            >
              {d.lockedSupportCta}
            </a>
          </section>
        )}

        {/* ── STATS ────────────────────────────────────────────────────── */}
        <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
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

        {testToken && (
          <TestInvitationCard
            eventId={event.id}
            locale={locale}
            dict={dict}
            url={testInvitationUrl(testToken)}
          />
        )}

        {/* ── ADD GUEST ────────────────────────────────────────────────── */}
        <div id="add-guests" className="mt-4 scroll-mt-24">
          <AddGuestForm eventId={event.id} locale={locale} dict={dict} />
          {/* The existing names and numbers travel to the client so the review
              table can flag "already one of your guests" as she reads, rather
              than after she has committed three hundred rows. They are her own
              guests on her own event — nothing here is another tenant's. */}
          <ImportGuestsPanel
            eventId={event.id}
            locale={locale}
            dict={dict}
            seatsRemaining={Math.max(0, capacity - occupiedSlots)}
            existingGuests={event.guests.map((g) => ({ nameAr: g.nameAr, phone: g.phone }))}
          />
        </div>

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

        {/* ── SEND QUEUE ───────────────────────────────────────────────── */}
        {unsent > 0 && (
          <Link
            href={`/${locale}/events/${eventId}/send`}
            className="mt-4 flex h-12 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-fg transition-colors hover:bg-accent-strong"
          >
            {d.sendQueueOpen.replace("{count}", nf.format(unsent))}
          </Link>
        )}

        {/* ── MESSAGES FOR THE COUPLE ──────────────────────────────────── */}
        <section className="mt-4 rounded-2xl border border-border bg-surface p-5">
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

        {/* ── GUESTS ─────────────────────────────────────────────────────── */}
        <section id="guests" className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4">
            <h2 className="text-base font-bold text-fg">{d.latestReplies}</h2>
            <span className="text-xs text-fg-muted">
              {d.seatsRemaining.replace("{count}", nf.format(Math.max(0, capacity - occupiedSlots)))}
            </span>
          </div>

          {rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-fg-muted">{d.noGuestsYet}</p>
          ) : (
            /* Search, filter and a page size live in the list itself: three
               hundred names with none of the three is a screen you scroll
               until you give up. The rows were already client components, so
               moving the loop inside costs nothing. */
            <GuestList
              eventId={event.id}
              locale={locale}
              dict={dict}
              entries={rows.map(({ guest, invitation, reply, rsvp, lastActivityAt }) => ({
                id: guest.id,
                nameAr: guest.nameAr,
                phone: guest.phone,
                allowedCount: guest.allowedCount,
                checkedInCount: guest.checkedInCount,
                isBlocked: guest.isBlocked,
                companions: rsvp === "accepted" ? (reply?.partySize ?? guest.allowedCount) : null,
                activity:
                  invitation?.respondedAt || invitation?.viewedAt
                    ? `${invitation.respondedAt ? "" : `${d.openedNoReply} · `}${
                        relativeTime(lastActivityAt, locale) ?? ""
                      }`
                    : // Unshared and unopened are different kinds of silence:
                      // one asks the host to act, the other to wait. sentAt
                      // distinguishes them.
                      invitation?.sentAt
                      ? d.notOpenedYet
                      : d.notSentYet,
                invitationUrl: invitation ? guestInvitationUrl(invitation.linkToken) : "",
                waMessage: invitation ? `${shareText}\n${guestInvitationUrl(invitation.linkToken)}` : "",
                rsvp,
                sent: Boolean(invitation?.sentAt),
              }))}
            />
          )}
        </section>

        {/* ── ATTENDANCE REPORT ────────────────────────────────────────────
            Present on the page from day one, but switched off until the
            event's own start time — the gate itself can't record a check-in
            before then anyway, and it reads as a promise ("this is where
            you'll watch it") rather than a section that just appears out of
            nowhere on the day. Once on, it fills in with every scan and
            keeps reading the same way after the event too. The gate staff
            themselves only ever see allow/deny, never a name — this
            comparison against RSVPs is host-only, on this page alone. */}
        {event.hasQr && (
          <section className="mt-4 rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-base font-bold text-fg">{d.attendanceTitle}</h2>
            {!eventStarted ? (
              <p className="mt-1 text-sm leading-relaxed text-fg-muted">{d.attendanceNotStarted}</p>
            ) : (
              <>
                <p className="mt-1 text-sm leading-relaxed text-fg-muted">{d.attendanceHint}</p>
                {report.live && (
                  <>
                    <LiveAttendance />
                    <p className="mt-1 text-xs text-fg-muted">
                      {d.attendanceUpdatedAt.replace(
                        "{time}",
                        riyadhDateFormat(locale === "ar" ? "ar-SA" : "en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        }).format(report.at),
                      )}
                    </p>
                  </>
                )}

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <StatCard
                    label={d.attendedLabel}
                    value={nf.format(attendedPeople)}
                    unit={d.attendedPeopleUnit.replace("{guests}", nf.format(attendedRows.length))}
                    tone="success"
                  />
                  <StatCard
                    label={d.noShowLabel}
                    value={nf.format(noShowRows.length)}
                    unit={d.noShowPeopleUnit}
                    tone="danger"
                  />
                </div>

                {attendedRows.length === 0 && noShowRows.length === 0 ? (
                  <p className="mt-4 text-sm text-fg-muted">{d.attendanceEmpty}</p>
                ) : (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {attendedRows.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-fg-muted">{d.attendedListTitle}</p>
                        <ul className="mt-2 flex flex-col divide-y divide-border">
                          {attendedRows.map((r) => (
                            <li
                              key={r.guest.id}
                              className="flex items-baseline justify-between gap-3 py-2 text-sm text-fg"
                            >
                              <span>{r.guest.nameAr}</span>
                              {/* "2 of 4" — a name alone cannot say that one
                                  of her four seats is still outside. */}
                              <span className="shrink-0 text-xs text-fg-muted">
                                {d.attendedSeats
                                  .replace("{used}", nf.format(r.guest.checkedInCount))
                                  .replace("{allowed}", nf.format(r.guest.allowedCount))}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {noShowRows.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-fg-muted">{d.noShowListTitle}</p>
                        <ul className="mt-2 flex flex-col divide-y divide-border">
                          {noShowRows.map((r) => (
                            <li key={r.guest.id} className="py-2 text-sm text-fg">
                              {r.guest.nameAr}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* ── CUSTOM DESIGN ────────────────────────────────────────────── */}
        <div className="mt-4">
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
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <p className="text-xs font-bold text-fg-muted">{label}</p>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className={`text-2xl font-bold tabular-nums sm:text-3xl ${valueColor}`}>{value}</span>
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
