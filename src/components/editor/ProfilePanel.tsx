"use client";

import { useActionState } from "react";
import { saveProfile, type ProfileFormState } from "@/actions/profile";
import { Field } from "@/components/Field";
import { THEMES } from "@/lib/themes";

export type ProfileDraft = { displayName: string; bio: string; theme: string };

const initial: ProfileFormState = {};

export function ProfilePanel({
  username,
  draft,
  onChange,
}: {
  username: string;
  draft: ProfileDraft;
  onChange: (next: ProfileDraft) => void;
}) {
  const [state, action, pending] = useActionState(saveProfile, initial);
  const e = state.errors ?? {};
  return (
    <form action={action} className="card" noValidate>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-base font-semibold">Profile</h2>
        <span className="font-mono text-xs text-stone-400">/{username}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Display name" name="displayName" error={e.displayName}>
          <input
            id="displayName"
            name="displayName"
            className="input"
            value={draft.displayName}
            maxLength={60}
            onChange={(ev) => onChange({ ...draft, displayName: ev.target.value })}
          />
        </Field>
        <Field label="Bio" name="bio" error={e.bio} hint={`${draft.bio.length}/200`}>
          <input
            id="bio"
            name="bio"
            className="input"
            value={draft.bio}
            maxLength={200}
            onChange={(ev) => onChange({ ...draft, bio: ev.target.value })}
          />
        </Field>
      </div>
      <fieldset className="mt-4">
        <legend className="label">Theme</legend>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((theme) => {
            const selected = draft.theme === theme.id;
            return (
              <label
                key={theme.id}
                className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                  selected ? "border-brand-600 bg-brand-50 text-brand-700" : "border-stone-300 hover:bg-stone-50"
                }`}
              >
                <input
                  type="radio"
                  name="theme"
                  value={theme.id}
                  checked={selected}
                  onChange={() => onChange({ ...draft, theme: theme.id })}
                  className="sr-only"
                />
                <span className="size-4 rounded-full border border-black/10" style={{ background: theme.background }} aria-hidden />
                {theme.name}
              </label>
            );
          })}
        </div>
        {e.theme && <p className="error">{e.theme}</p>}
      </fieldset>
      <div className="mt-5 flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </button>
        {state.savedAt && !pending && (
          <span className="text-sm text-green-700" role="status">
            Saved
          </span>
        )}
      </div>
    </form>
  );
}
