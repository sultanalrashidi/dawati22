"use client";

import { useState, type ReactNode } from "react";
import {
  PALETTE_ROLES,
  PALETTE_ROLE_LABELS_AR,
  colorRoleOf,
  resolveColor,
  roleRef,
  type PaletteRole,
  type VariantPalette,
} from "@/lib/themes/builder/types";

/**
 * Small field primitives for the builder's inspector.
 *
 * The rest of the admin panel repeats its Tailwind strings inline, which is
 * fine at three or four fields per form. The inspector has closer to forty, and
 * every one of them is the same shape, so they get a component here instead.
 */

const INPUT_CLASS =
  "h-9 w-full rounded-lg border border-border bg-bg px-2 text-sm text-fg outline-none focus:border-accent";

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-3">
      <header className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-fg">{title}</h3>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-fg-muted">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-fg-muted/70">{hint}</span>}
    </label>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  slider,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  /** Adds a range control alongside — for values that are felt, not typed. */
  slider?: boolean;
}) {
  return (
    <Field label={suffix ? `${label} (${suffix})` : label}>
      <div className="flex items-center gap-2">
        <input
          type="number"
          dir="ltr"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const next = Number.parseFloat(event.target.value);
            if (Number.isFinite(next)) onChange(next);
          }}
          className={`${INPUT_CLASS} ${slider ? "w-20 shrink-0" : ""}`}
        />
        {slider && (
          <input
            type="range"
            value={Number.isFinite(value) ? value : 0}
            min={min ?? 0}
            max={max ?? 100}
            step={step}
            onChange={(event) => onChange(Number.parseFloat(event.target.value))}
            className="h-9 w-full accent-[var(--color-accent)]"
          />
        )}
      </div>
    </Field>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={normalizeHex(value)}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-border bg-bg"
        />
        <input
          type="text"
          dir="ltr"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={INPUT_CLASS}
        />
      </div>
    </Field>
  );
}

/**
 * A colour that is usually one of the palette's slots.
 *
 * The chips are the palette of the colour on screen — pick "النص" and the
 * layer follows every colour's own primary ink from now on. "مخصص" freezes
 * the current value as a hex that belongs to this colour only, which is what
 * "I changed this text's colour myself" means in the editor. A layer already
 * holding a hex opens on the hex row so the override stays visible.
 */
export function PaletteColorField({
  label,
  value,
  palette,
  roles = PALETTE_ROLES,
  onChange,
}: {
  label: string;
  value: string;
  palette: VariantPalette;
  /** The slots this colour can sensibly take — text roles for ink, fills for boxes. */
  roles?: readonly PaletteRole[];
  onChange: (value: string) => void;
}) {
  const role = colorRoleOf(value);
  // "مخصص" was pressed for THIS value. Keyed by value rather than a bare
  // boolean, so selecting another layer (or colour) whose value is a role
  // shows its chips instead of a hex row left open from the last one.
  const [customFor, setCustomFor] = useState<string | null>(null);
  const customOpen = customFor === value;
  const showCustom = role === null || customOpen;

  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1">
        {roles.map((option) => (
          <button
            key={option}
            type="button"
            title={`${PALETTE_ROLE_LABELS_AR[option]} — من لوحة ألوان هذا اللون`}
            onClick={() => {
              setCustomFor(null);
              onChange(roleRef(option));
            }}
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
              role === option && !customOpen ? "border-accent bg-accent/10 text-fg" : "border-border text-fg-muted"
            }`}
          >
            <span
              className="h-3 w-3 rounded-full border border-border"
              style={{ backgroundColor: palette[option] }}
            />
            {PALETTE_ROLE_LABELS_AR[option]}
          </button>
        ))}
        <button
          type="button"
          title="لون خاص بهذا اللون فقط — ما يتبع لوحة الألوان"
          onClick={() => {
            // Freeze what is on screen as a hex of this colour's own; the
            // field then shows the hex row because the value is a literal.
            const frozen = resolveColor(value, palette);
            setCustomFor(frozen);
            if (role !== null) onChange(frozen);
          }}
          className={`rounded-full border px-2 py-0.5 text-[11px] ${
            showCustom ? "border-accent bg-accent/10 text-fg" : "border-border text-fg-muted"
          }`}
        >
          مخصص
        </button>
      </div>
      {showCustom && (
        <div className="mt-1 flex items-center gap-2">
          <input
            type="color"
            value={normalizeHex(resolveColor(value, palette))}
            onChange={(event) => onChange(event.target.value)}
            className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-border bg-bg"
          />
          <input
            type="text"
            dir="ltr"
            // The stored value, not its resolution: a half-typed "@" is a
            // literal in the variant paint and must stay visible so it can be
            // corrected before the save rejects it.
            value={role === null ? value : resolveColor(value, palette)}
            onChange={(event) => onChange(event.target.value)}
            className={INPUT_CLASS}
          />
        </div>
      )}
    </Field>
  );
}

/** `<input type="color">` rejects shorthand and alpha forms; the text box keeps them. */
function normalizeHex(value: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.test(value)) {
    const [, r, g, b] = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(value)!;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^#[0-9a-fA-F]{8}$/.test(value)) return value.slice(0, 7);
  return "#000000";
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className={INPUT_CLASS}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function TextField({
  label,
  value,
  onChange,
  dir,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  dir?: "rtl" | "ltr";
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <Field label={label}>
      {multiline ? (
        <textarea
          dir={dir}
          rows={3}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-lg border border-border bg-bg p-2 text-sm text-fg outline-none focus:border-accent"
        />
      ) : (
        <input
          type="text"
          dir={dir}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={INPUT_CLASS}
        />
      )}
    </Field>
  );
}

export function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-fg">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[var(--color-accent)]"
      />
      {label}
    </label>
  );
}

export function GhostButton({
  children,
  onClick,
  title,
  danger,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  title?: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border border-border px-2 py-1 text-xs hover:border-accent disabled:opacity-40 ${
        danger ? "text-danger" : "text-fg"
      }`}
    >
      {children}
    </button>
  );
}
