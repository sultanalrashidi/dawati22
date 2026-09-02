import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";
import {
  COUPLE_FORMAT_KINDS,
  DEFAULT_COUPLE_FORMAT,
  DEFAULT_OPENING_KIND,
  INVITATION_OPENING_KINDS,
  type CoupleFormatKind,
  type HostModeKind,
  type InvitationOpeningKind,
} from "@/lib/themes/builder/content";
import { ClosingField } from "@/components/events/closing-field";
import { CouplesFields, type CoupleValues } from "@/components/events/couples-fields";
import { HostFields } from "@/components/events/host-fields";
import { ThemePicker, type ThemeOption } from "@/components/events/theme-picker";

/**
 * The event form's fields, shared by the customer's create page and the admin's
 * edit page. Both post the same names, and `lib/events/form.ts` reads them
 * back — one shape written and read in one place, so a field support can
 * correct is never a field the customer could not enter.
 *
 * The fields follow the invitation's own reading order — opening, host,
 * couple, date, venue, notes, closing — so the host fills the card in the
 * order her guests will read it.
 *
 * The event-type select is NOT here: it decides whether the rest of this form
 * should render at all, so it lives in `EventTypeGate`, which wraps this.
 */

const FIELD =
  "h-11 rounded-lg border border-border bg-bg px-3 text-fg outline-none focus:border-accent";
const AREA = "rounded-lg border border-border bg-bg px-3 py-2 text-fg outline-none focus:border-accent";

type FormCopy = Dictionary["events"]["form"];

/** Which dictionary label names each opening — the long texts themselves live in content.ts. */
const OPENING_LABEL_KEYS: Record<InvitationOpeningKind, keyof FormCopy> = {
  VERSE: "openingVerse",
  DUA: "openingDua",
  BASMALA: "openingBasmala",
  NONE: "openingNone",
};

const COUPLE_FORMAT_LABEL_KEYS: Record<CoupleFormatKind, keyof FormCopy> = {
  ALA: "coupleFormatAla",
  WAW: "coupleFormatWaw",
  BRIDE_FOCUS: "coupleFormatBrideFocus",
};

/** An existing event's values, already flattened into what the inputs need. */
export interface EventFieldDefaults {
  type: string;
  name: string;
  openingKind: InvitationOpeningKind;
  hostMode: HostModeKind;
  groomMotherAr: string;
  brideMotherAr: string;
  hostLineAr: string;
  couples: CoupleValues[];
  coupleFormat: CoupleFormatKind;
  invitationTextAr: string;
  /** `YYYY-MM-DDTHH:mm`, in the same clock the server parses it back with. */
  eventDateLocal: string;
  locationName: string;
  regionName: string;
  mapUrl: string;
  musicUrl: string;
  musicAutoplay: boolean;
  /** One `label|time` line per schedule item. */
  scheduleText: string;
  noteNoPhotos: boolean;
  noteNoChildren: boolean;
  noteShowPass: boolean;
  notesAr: string;
  /** "" when the event has no closing of its own — the field then shows the default preset. */
  closingAr: string;
  /** `themeId` or `themeId:variantId` — see themeOptionKey(). */
  themeKey: string;
  guestManagementMode: string;
  rsvpRequired: boolean;
  allowGuestPartySize: boolean;
}

export function EventFields({
  locale,
  dict,
  themeOptions,
  defaults,
}: {
  locale: Locale;
  dict: Dictionary;
  themeOptions: ThemeOption[];
  /** Absent on the create form, where the sample texts are the starting point. */
  defaults?: EventFieldDefaults;
}) {
  const f = dict.events.form;

  return (
    <>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-fg-muted">{f.nameLabel}</span>
        <input
          name="name"
          required
          minLength={2}
          placeholder={f.namePlaceholder}
          defaultValue={defaults?.name ?? ""}
          className={FIELD}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-fg-muted">{f.openingLabel}</span>
        <select
          name="openingKind"
          defaultValue={defaults?.openingKind ?? DEFAULT_OPENING_KIND}
          className={FIELD}
        >
          {INVITATION_OPENING_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {f[OPENING_LABEL_KEYS[kind]]}
            </option>
          ))}
        </select>
      </label>

      <HostFields
        f={f}
        defaults={
          defaults && {
            hostMode: defaults.hostMode,
            groomMotherAr: defaults.groomMotherAr,
            brideMotherAr: defaults.brideMotherAr,
            hostLineAr: defaults.hostLineAr,
          }
        }
      />

      {/* One pair by default; a joint wedding adds more, all posted under the
          same `couple*` names. */}
      <CouplesFields f={f} defaultCouples={defaults?.couples} />

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-fg-muted">{f.coupleFormatLabel}</span>
        <select
          name="coupleFormat"
          defaultValue={defaults?.coupleFormat ?? DEFAULT_COUPLE_FORMAT}
          className={FIELD}
        >
          {COUPLE_FORMAT_KINDS.map((format) => (
            <option key={format} value={format}>
              {f[COUPLE_FORMAT_LABEL_KEYS[format]]}
            </option>
          ))}
        </select>
        <span className="text-xs text-fg-muted">{f.coupleFormatHint}</span>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-fg-muted">{f.extraTextLabel}</span>
        <textarea
          name="invitationTextAr"
          rows={3}
          placeholder={f.invitationTextPlaceholder}
          defaultValue={defaults?.invitationTextAr ?? ""}
          className={AREA}
        />
        <span className="text-xs text-fg-muted">{f.extraTextHint}</span>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-fg-muted">{f.dateLabel}</span>
        <input
          type="datetime-local"
          name="eventDate"
          required
          defaultValue={defaults?.eventDateLocal ?? ""}
          className={FIELD}
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg-muted">{f.locationNameLabel}</span>
          <input
            name="locationName"
            required
            minLength={2}
            defaultValue={defaults?.locationName ?? ""}
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg-muted">{f.regionNameLabel}</span>
          <input
            name="regionName"
            placeholder={f.regionNamePlaceholder}
            defaultValue={defaults?.regionName ?? ""}
            className={FIELD}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-fg-muted">{f.mapUrlLabel}</span>
        <input
          name="mapUrl"
          type="url"
          dir="ltr"
          defaultValue={defaults?.mapUrl ?? ""}
          className={FIELD}
        />
      </label>

      <div className="flex flex-col gap-2 text-sm">
        <span className="text-fg-muted">{f.notesLabel}</span>
        <span className="text-xs text-fg-muted">{f.notesStandardLabel}</span>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="noteNoPhotos" defaultChecked={defaults?.noteNoPhotos ?? false} />
          {f.noteNoPhotosLabel}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="noteNoChildren"
            defaultChecked={defaults?.noteNoChildren ?? false}
          />
          {f.noteNoChildrenLabel}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="noteShowPass" defaultChecked={defaults?.noteShowPass ?? false} />
          {f.noteShowPassLabel}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-fg-muted">{f.notesFreeLabel}</span>
          <textarea
            name="notesAr"
            rows={3}
            placeholder={f.notesPlaceholder}
            defaultValue={defaults?.notesAr ?? ""}
            className={AREA}
          />
        </label>
      </div>

      <ClosingField f={f} defaultValue={defaults?.closingAr} />

      <div className="flex flex-col gap-2 text-sm">
        <label className="flex flex-col gap-1.5">
          <span className="text-fg-muted">{f.musicUrlLabel}</span>
          <input
            name="musicUrl"
            type="url"
            dir="ltr"
            placeholder={f.musicUrlPlaceholder}
            defaultValue={defaults?.musicUrl ?? ""}
            className={FIELD}
          />
        </label>
        <span className="text-xs text-fg-muted">{f.musicUrlHint}</span>
        <div className="flex flex-col gap-2">
          <span className="text-fg-muted">{f.musicAutoplayLabel}</span>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="musicAutoplay"
              value="manual"
              defaultChecked={!defaults?.musicAutoplay}
            />
            {f.musicAutoplayManual}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="musicAutoplay"
              value="auto"
              defaultChecked={Boolean(defaults?.musicAutoplay)}
            />
            {f.musicAutoplayAuto}
          </label>
        </div>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-fg-muted">{f.scheduleLabel}</span>
        <textarea
          name="scheduleItems"
          rows={3}
          defaultValue={defaults ? defaults.scheduleText : f.schedulePlaceholder}
          dir="rtl"
          className={AREA}
        />
        <span className="text-xs text-fg-muted">{f.scheduleHint}</span>
      </label>

      <div className="flex flex-col gap-2 text-sm">
        <span className="text-fg-muted">{f.themeLabel}</span>
        <p className="-mt-1 text-xs text-fg-muted">{f.themeHint}</p>
        <ThemePicker
          locale={locale}
          dict={dict}
          options={themeOptions}
          defaultKey={defaults?.themeKey}
          allowCustomRequest={!defaults}
        />
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <span className="text-fg-muted">{f.guestManagementLabel}</span>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="guestManagementMode"
            value="SELF"
            defaultChecked={(defaults?.guestManagementMode ?? "SELF") !== "ADMIN"}
          />
          {f.guestManagementSelf}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="guestManagementMode"
            value="ADMIN"
            defaultChecked={defaults?.guestManagementMode === "ADMIN"}
          />
          {f.guestManagementAdmin}
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="rsvpRequired" defaultChecked={defaults?.rsvpRequired ?? true} />
        {f.rsvpRequiredLabel}
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="allowGuestPartySize"
          defaultChecked={defaults?.allowGuestPartySize ?? true}
        />
        {f.allowGuestPartySizeLabel}
      </label>
    </>
  );
}
