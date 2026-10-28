"use client";

import { useRef, useState, useTransition } from "react";
import type { SaveThemeState } from "@/actions/themes";
import { removeThemeBackground, uploadThemeBackground } from "@/actions/uploads";
import { BUTTON_STYLES, FONTS, RADII, SHADOWS, type ThemeTokens } from "@/lib/themes";
import type { StudioTheme } from "./ThemeStudio";

type Draft = { name: string; tokens: ThemeTokens };

const COLOURS: { key: keyof ThemeTokens & ("background" | "text" | "muted" | "button" | "buttonText"); label: string }[] = [
  { key: "background", label: "Background" },
  { key: "text", label: "Text" },
  { key: "muted", label: "Secondary text" },
  { key: "button", label: "Button" },
  { key: "buttonText", label: "Button text" },
];

const LABELS = {
  buttonStyle: { solid: "Solid", outline: "Outline", glass: "Glass" },
  shadow: { flat: "None", soft: "Soft", hard: "3D" },
  radius: { none: "Square", small: "Soft", medium: "Rounded", pill: "Pill" },
  font: { sans: "Sans", serif: "Serif", mono: "Mono", rounded: "Rounded" },
} as const;

/** The form for one theme: every change updates the draft (and the preview) at once; Save persists it. */
export function ThemeBuilder({
  theme,
  draft,
  onDraft,
  onSave,
  onBackgroundChanged,
}: {
  theme: StudioTheme;
  draft: Draft;
  onDraft: (next: Draft) => void;
  onSave: () => Promise<SaveThemeState>;
  onBackgroundChanged: () => void;
}) {
  const [state, setState] = useState<SaveThemeState>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [uploading, startUpload] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const e = state.errors ?? {};

  const setToken = <K extends keyof ThemeTokens>(key: K, value: ThemeTokens[K]) =>
    onDraft({ ...draft, tokens: { ...draft.tokens, [key]: value } });

  function save() {
    startSave(async () => setState(await onSave()));
  }

  function pickBackground(file: File | undefined) {
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    startUpload(async () => {
      const result = await uploadThemeBackground(theme.id, formData);
      setUploadError(result.ok ? null : result.error);
      if (result.ok) onBackgroundChanged();
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  function clearBackground() {
    startUpload(async () => {
      const result = await removeThemeBackground(theme.id);
      setUploadError(result.ok ? null : result.error);
      if (result.ok) onBackgroundChanged();
    });
  }

  return (
    <section className="card" data-testid="theme-builder">
      <h2 className="text-base font-semibold">Edit theme</h2>
      <p className="mb-4 text-sm text-stone-500">Changes show in the preview straight away and on your page once saved.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="theme-name" className="label">
            Name
          </label>
          <input
            id="theme-name"
            className="input"
            value={draft.name}
            maxLength={40}
            onChange={(ev) => onDraft({ ...draft, name: ev.target.value })}
          />
          {e.name && <p className="error">{e.name}</p>}
        </div>

        {COLOURS.map(({ key, label }) => (
          <ColourField key={key} id={`colour-${key}`} label={label} value={draft.tokens[key]} onChange={(v) => setToken(key, v)} />
        ))}

        <div className="flex flex-col gap-3">
          <div>
            <p className="label">Gradient</p>
            <label className="flex min-h-[38px] cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="checkbox"
                checked={draft.tokens.backgroundEnd !== null}
                onChange={(ev) => setToken("backgroundEnd", ev.target.checked ? draft.tokens.background : null)}
              />
              Fade the background into a second colour
            </label>
          </div>
          {draft.tokens.backgroundEnd !== null && (
            <ColourField id="colour-backgroundEnd" label="Gradient end" value={draft.tokens.backgroundEnd} onChange={(v) => setToken("backgroundEnd", v)} />
          )}
        </div>

        <Select id="buttonStyle" label="Button style" value={draft.tokens.buttonStyle} options={BUTTON_STYLES} labels={LABELS.buttonStyle} onChange={(v) => setToken("buttonStyle", v)} />
        <Select id="shadow" label="Shadow" value={draft.tokens.shadow ?? "soft"} options={SHADOWS} labels={LABELS.shadow} onChange={(v) => setToken("shadow", v)} />
        <Select id="radius" label="Corners" value={draft.tokens.radius} options={Object.keys(RADII) as (keyof typeof RADII)[]} labels={LABELS.radius} onChange={(v) => setToken("radius", v)} />
        <Select id="font" label="Font" value={draft.tokens.font} options={Object.keys(FONTS) as (keyof typeof FONTS)[]} labels={LABELS.font} onChange={(v) => setToken("font", v)} />

        <div className="sm:col-span-2">
          <p className="label">Background image</p>
          <div className="flex flex-wrap items-center gap-3">
            {theme.backgroundUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={theme.backgroundUrl} alt="" className="h-12 w-20 rounded-md object-cover" data-testid="background-image" />
            )}
            <label className={`btn-secondary cursor-pointer ${uploading ? "pointer-events-none opacity-60" : ""}`}>
              {uploading ? "Uploading…" : theme.backgroundUrl ? "Change image" : "Upload image"}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                aria-label="Upload background image"
                onChange={(ev) => pickBackground(ev.target.files?.[0])}
                disabled={uploading}
              />
            </label>
            {theme.backgroundUrl && (
              <button type="button" className="btn-ghost" onClick={clearBackground} disabled={uploading}>
                Remove image
              </button>
            )}
            {theme.backgroundUrl && (
              <label className="flex items-center gap-2 text-sm text-stone-600">
                Darken
                <input
                  type="range"
                  min={0}
                  max={90}
                  step={5}
                  value={draft.tokens.overlay}
                  onChange={(ev) => setToken("overlay", Number(ev.target.value))}
                  aria-label="Darken background image"
                />
                <span className="w-8 tabular-nums">{draft.tokens.overlay}%</span>
              </label>
            )}
          </div>
          {uploadError && (
            <p className="error" role="alert">
              {uploadError}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save theme"}
        </button>
        {state.savedAt && !saving && (
          <span className="text-sm text-green-700" role="status">
            Theme saved
          </span>
        )}
        {e.form && <p className="error mt-0">{e.form}</p>}
      </div>
    </section>
  );
}

function ColourField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (hex: string) => void }) {
  const [text, setText] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setText(value);
  }
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(ev) => onChange(ev.target.value)}
          aria-label={`${label} colour picker`}
          className="size-9 cursor-pointer rounded border border-stone-300 bg-white p-0.5"
        />
        <input
          id={id}
          className="input font-mono"
          value={text}
          maxLength={7}
          spellCheck={false}
          onChange={(ev) => {
            const next = ev.target.value.toLowerCase();
            setText(next);
            if (/^#[0-9a-f]{6}$/.test(next)) onChange(next);
          }}
        />
      </div>
    </div>
  );
}

function Select<T extends string>({
  id,
  label,
  value,
  options,
  labels,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <select id={id} className="input" value={value} onChange={(ev) => onChange(ev.target.value as T)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {labels[o]}
          </option>
        ))}
      </select>
    </div>
  );
}
