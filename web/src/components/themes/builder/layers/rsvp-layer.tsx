"use client";

import { useState, useTransition, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { submitRsvpAction } from "@/lib/invitations/actions";
import type { RsvpLayer, TypographyDoc, VariantPalette } from "@/lib/themes/builder/types";
import { scaled, textStyleToCss } from "./style";

/**
 * The real RSVP form, rendered as one positionable block.
 *
 * This is deliberately **not** a second RSVP implementation. `RsvpForm` below
 * is the hand-coded scene's markup and state — name, phone, أحضر/أعتذر, party
 * size, message, submit — lifted out with its two hard-wired dependencies
 * turned into props: the copy (which came from `dict.guest`) and the colours
 * (which came from CSS variables). A caller can hand it `var(--color-accent)`
 * and its own dictionary and get the scene the guest page renders today; the
 * layer at the bottom of this file hands it the admin's authored styling.
 *
 * It submits through `submitRsvpAction` — the same server action, so a booking
 * taken by a builder theme is indistinguishable from one taken by a hand-coded
 * one — and reports the result back through `onResponded` so the page can move
 * the guest on to the entry pass.
 *
 * The block is positioned as a whole rather than field-by-field on purpose: a
 * form whose inputs can be dragged apart individually is a form a design can
 * quietly break into something that no longer takes a booking.
 */

export type RsvpResponse = "ACCEPTED" | "DECLINED";

export interface RsvpFormLabels {
  name: string;
  phone: string;
  attending: string;
  decline: string;
  partySize: string;
  message: string;
  messagePlaceholder: string;
  submit: string;
  error: string;
  thanksAccept: string;
  thanksDecline: string;
}

/** Matches `dict.guest` word for word, so a caller passing no copy reads the same. */
export const DEFAULT_RSVP_LABELS: RsvpFormLabels = {
  name: "الاسم",
  phone: "رقم الجوال",
  attending: "سأحضر",
  decline: "أعتذر",
  partySize: "عدد الأشخاص",
  message: "كلمة لنا",
  messagePlaceholder: "شاركونا أمنياتكم وكلماتكم الجميلة",
  submit: "إرسال التأكيد",
  error: "تعذر تسجيل الرد، حاول مرة أخرى",
  thanksAccept: "يسعدنا حضوركم! نراكم قريبًا",
  thanksDecline: "شكرًا لتواصلكم، سنفتقد حضوركم",
};

/**
 * Every colour and length the form paints with, as plain CSS strings — so one
 * caller can pass `var(--color-accent)` and another a hex from a stored layer.
 */
export interface RsvpFormTokens {
  /** Type of the values the guest types. */
  field: CSSProperties;
  /** Type of the small caption above each control. */
  label: CSSProperties;
  fieldBackground: string;
  borderColor: string;
  borderRadius: string;
  accent: string;
  accentFg: string;
  /** The decline control, and the captions' de-emphasis. */
  muted: string;
  controlHeight: string;
  gap: string;
  /** Padding inside a control. */
  padding: string;
}

/** Everything the form needs about the invitation it is taking a booking for. */
export interface StageRsvp {
  /** Prefills the name field, exactly as the hand-coded scene does. */
  guestName: string;
  allowedCount: number;
  allowGuestPartySize: boolean;
  /** Preview surfaces set this so a design review never writes a real RSVP. */
  simulate?: boolean;
  /** Lets the page advance to the entry pass once a response lands. */
  onResponded?: (response: RsvpResponse, qrDataUrl: string | null) => void;
  labels?: Partial<RsvpFormLabels>;
}

export interface RsvpFormProps extends StageRsvp {
  tokens: RsvpFormTokens;
  /** A scrolling builder layer must grow with its fields, never shrink them. */
  naturalHeight?: boolean;
  /** Required to submit for real; without one the form can only simulate. */
  linkToken?: string | null;
  /** The invitation's stored answer, so a returning guest sees the thank-you. */
  alreadyAnswered?: RsvpResponse | null;
}

export function RsvpForm({
  tokens,
  guestName,
  allowedCount,
  allowGuestPartySize,
  linkToken,
  simulate,
  onResponded,
  labels,
  alreadyAnswered,
  naturalHeight = false,
}: RsvpFormProps) {
  const copy = labels ? { ...DEFAULT_RSVP_LABELS, ...labels } : DEFAULT_RSVP_LABELS;

  const [name, setName] = useState(guestName);
  const [phone, setPhone] = useState("");
  const [attending, setAttending] = useState<boolean | null>(null);
  const [partySize, setPartySize] = useState(allowedCount);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Seeded from the invitation's stored status, so a guest returning to an
  // invitation they already answered sees the thank-you rather than an empty
  // form inviting them to book a second time.
  const [answered, setAnswered] = useState<RsvpResponse | null>(alreadyAnswered ?? null);
  const [isPending, startTransition] = useTransition();

  // No token means there is nothing to submit against — the editor, the
  // gallery, a theme preview. Simulating is the honest option there: a real
  // POST would fail, and a dead submit button would misrepresent the design
  // being reviewed.
  const local = Boolean(simulate) || !linkToken;

  const controlStyle: CSSProperties = {
    ...tokens.field,
    height: tokens.controlHeight,
    ...(naturalHeight ? { minHeight: tokens.controlHeight } : {}),
    paddingInline: tokens.padding,
    backgroundColor: tokens.fieldBackground,
    border: `1px solid ${tokens.borderColor}`,
    borderRadius: tokens.borderRadius,
    outline: "none",
    width: "100%",
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    if (attending === null || isPending) return;
    const response: RsvpResponse = attending ? "ACCEPTED" : "DECLINED";

    if (local) {
      // A preview passes `onResponded` and wants the thank-you; the editor
      // passes nothing, and swapping the authored form out for a thank-you the
      // admin then can't get back would be a design surface that ate itself.
      if (!onResponded) return;
      setAnswered(response);
      onResponded(response, null);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await submitRsvpAction(linkToken!, response, {
        guestNameAr: name.trim() || undefined,
        guestPhone: phone.trim() || undefined,
        partySize: attending ? partySize : undefined,
        messageAr: message.trim() || undefined,
      });
      if (!result.ok) {
        // The form stays standing so the guest can retry — losing what they
        // typed to a transient failure is how a booking gets abandoned.
        setError(copy.error);
        return;
      }
      setAnswered(response);
      onResponded?.(response, result.qrDataUrl ?? null);
    });
  }

  if (answered) {
    return (
      <div
        dir="rtl"
        className={naturalHeight ? "flex w-full items-start justify-center break-words" : "flex h-full w-full items-center justify-center"}
        style={tokens.field}
      >
        <span style={{ textAlign: "center" }}>
          {answered === "ACCEPTED" ? copy.thanksAccept : copy.thanksDecline}
        </span>
      </div>
    );
  }

  return (
    <form
      dir="rtl"
      onSubmit={submit}
      className={naturalHeight ? "flex w-full flex-col text-start [&>*]:shrink-0" : "flex h-full w-full flex-col text-start"}
      style={{ gap: tokens.gap }}
    >
      <Field label={copy.name} tokens={tokens}>
        <input value={name} onChange={(event) => setName(event.target.value)} required style={controlStyle} />
      </Field>

      <Field label={copy.phone} tokens={tokens}>
        <input
          type="tel"
          dir="ltr"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          style={controlStyle}
        />
      </Field>

      <div className="flex w-full" style={{ gap: tokens.gap }}>
        <ChoiceButton
          label={copy.attending}
          selected={attending === true}
          color={tokens.accent}
          selectedFg={tokens.accentFg}
          tokens={tokens}
          naturalHeight={naturalHeight}
          onClick={() => setAttending(true)}
        />
        <ChoiceButton
          label={copy.decline}
          selected={attending === false}
          color={tokens.muted}
          selectedFg={tokens.accentFg}
          tokens={tokens}
          naturalHeight={naturalHeight}
          onClick={() => setAttending(false)}
        />
      </div>

      {attending === true && allowedCount > 1 && allowGuestPartySize && (
        <Field label={copy.partySize} tokens={tokens}>
          <select
            value={partySize}
            onChange={(event) => setPartySize(Number(event.target.value))}
            style={controlStyle}
          >
            {Array.from({ length: allowedCount }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label={copy.message} tokens={tokens}>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={2}
          placeholder={copy.messagePlaceholder}
          style={{ ...controlStyle, height: "auto", paddingBlock: tokens.padding, resize: "none" }}
        />
      </Field>

      <button
        type="submit"
        disabled={attending === null || isPending}
        className="w-full disabled:opacity-50"
        style={{
          ...tokens.field,
          color: tokens.accentFg,
          textAlign: "center",
          height: naturalHeight ? "auto" : tokens.controlHeight,
          ...(naturalHeight ? { minHeight: tokens.controlHeight, overflowWrap: "anywhere" } as const : {}),
          backgroundColor: tokens.accent,
          borderRadius: tokens.borderRadius,
        }}
      >
        {copy.submit}
      </button>

      {error && <span style={{ ...tokens.label, color: "#DC2626" }}>{error}</span>}
    </form>
  );
}

function ChoiceButton({
  label,
  selected,
  color,
  selectedFg,
  tokens,
  onClick,
  naturalHeight = false,
}: {
  label: string;
  selected: boolean;
  color: string;
  selectedFg: string;
  tokens: RsvpFormTokens;
  onClick: () => void;
  naturalHeight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={naturalHeight ? "min-w-0 flex-1" : "flex-1"}
      style={{
        ...tokens.field,
        textAlign: "center",
        height: naturalHeight ? "auto" : tokens.controlHeight,
        ...(naturalHeight ? { minHeight: tokens.controlHeight, overflowWrap: "anywhere" } as const : {}),
        borderRadius: tokens.borderRadius,
        border: `1px solid ${color}`,
        backgroundColor: selected ? color : "transparent",
        color: selected ? selectedFg : color,
      }}
    >
      {label}
    </button>
  );
}

function Field({ label, tokens, children }: { label: string; tokens: RsvpFormTokens; children: ReactNode }) {
  return (
    <label className="flex w-full flex-col" style={{ gap: `calc(${tokens.gap} / 2)` }}>
      <span style={tokens.label}>{label}</span>
      {children}
    </label>
  );
}

// ---------------------------------------------------------------------------
// The layer
// ---------------------------------------------------------------------------

/**
 * A floor under a `cqw` size.
 *
 * Everything else on a stage scales purely with the stage, which is right for
 * decoration. The RSVP block is the one place a guest has to *hit* and *read*:
 * on a 390px phone the stage is often ~330px wide, and `scaled(40)` there is a
 * 34px control — under both platform minimum tap targets — while a 13px input
 * makes iOS zoom the page on focus. `max()` keeps the design's proportions
 * whenever they are already big enough and refuses to go below usable.
 */
function atLeast(px: number, floorPx: number): string {
  return `max(${scaled(px)}, ${floorPx}px)`;
}

export function RsvpContent({
  layer,
  typography,
  palette,
  linkToken,
  rsvp,
  defaultGuestName,
  alreadyAnswered,
}: {
  layer: RsvpLayer;
  typography: TypographyDoc;
  palette: VariantPalette;
  linkToken?: string | null;
  /** Absent in the editor, which shows a working-looking, simulating form. */
  rsvp?: StageRsvp | null;
  /** The stage's own resolved guest name — the sample one in the editor. */
  defaultGuestName: string;
  /** The invitation's stored answer, if the guest already responded. */
  alreadyAnswered?: RsvpResponse | null;
}) {
  const scrollable = layer.overflow === "scroll";
  // 16px is the threshold below which iOS zooms the page when an input takes
  // focus — which on an invitation reads as the page "jumping" mid-booking.
  const field = {
    ...textStyleToCss(layer.fieldStyle, typography),
    fontSize: atLeast(layer.fieldStyle.fontSize, 16),
  };
  const tokens: RsvpFormTokens = {
    field: { ...field, textAlign: "start" },
    // The caption is the field's own face a size down and de-emphasised: one
    // authored style drives both, so an admin never keeps two in sync by hand.
    label: {
      ...field,
      fontSize: atLeast(layer.fieldStyle.fontSize * 0.82, 12),
      color: palette.fgMuted,
      textAlign: "start",
    },
    fieldBackground: layer.fieldBackground,
    borderColor: layer.borderColor,
    borderRadius: scaled(layer.borderRadius),
    accent: layer.accent,
    accentFg: layer.accentFg,
    muted: palette.fgMuted,
    controlHeight: atLeast(40, 44),
    gap: scaled(10),
    padding: scaled(10),
  };

  return (
    <div
      dir="rtl"
      className={scrollable ? "flex min-h-full w-full flex-col [&>*]:shrink-0" : "flex h-full w-full flex-col"}
      style={{ gap: scaled(10) }}
    >
      {layer.title && <div className={scrollable ? "break-words" : undefined} style={textStyleToCss(layer.titleStyle, typography)}>{layer.title}</div>}
      <RsvpForm
        tokens={tokens}
        naturalHeight={scrollable}
        guestName={rsvp?.guestName ?? defaultGuestName}
        // Two seats and an open picker make the editor show the party-size row,
        // which is the field an admin most needs to see while sizing the block.
        allowedCount={rsvp?.allowedCount ?? 2}
        allowGuestPartySize={rsvp?.allowGuestPartySize ?? true}
        linkToken={linkToken}
        alreadyAnswered={alreadyAnswered}
        simulate={rsvp?.simulate}
        onResponded={rsvp?.onResponded}
        labels={rsvp?.labels}
      />
    </div>
  );
}
