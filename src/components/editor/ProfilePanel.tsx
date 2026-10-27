"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveProfile, type ProfileFormState } from "@/actions/profile";
import { Field } from "@/components/Field";
import { AvatarUploader } from "./AvatarUploader";
import { SocialsEditor, type SocialDraft } from "./SocialsEditor";
import { MAX_BIO_LINES, type ImageFocus } from "@/lib/validation";

export type ProfileDraft = { displayName: string; bio: string; avatarUrl: string | null; avatarFocus: ImageFocus; socials: SocialDraft[] };

const initial: ProfileFormState = {};

export function ProfilePanel({
  username,
  themeName,
  draft,
  onChange,
}: {
  username: string;
  themeName: string;
  draft: ProfileDraft;
  onChange: (next: ProfileDraft) => void;
}) {
  const [state, action, pending] = useActionState(saveProfile, initial);
  const e = state.errors ?? {};
  const initials = draft.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <section className="card">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-base font-semibold">Profile</h2>
        <span className="font-mono text-xs text-stone-400">/{username}</span>
      </div>
      <div className="mb-5">
        <p className="label">Photo</p>
        <AvatarUploader
          avatarUrl={draft.avatarUrl}
          focus={draft.avatarFocus}
          initials={initials}
          onChanged={(avatarUrl) => onChange({ ...draft, avatarUrl, avatarFocus: { x: 50, y: 50 } })}
          onFocusChanged={(avatarFocus) => onChange({ ...draft, avatarFocus })}
        />
      </div>
      <form action={action} noValidate>
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
          <Field label="Bio" name="bio" error={e.bio} hint={`${draft.bio.length}/200 · Enter starts a new line (up to ${MAX_BIO_LINES})`}>
            <textarea
              id="bio"
              name="bio"
              className="input resize-y"
              rows={3}
              value={draft.bio}
              maxLength={200}
              onChange={(ev) => onChange({ ...draft, bio: ev.target.value })}
            />
          </Field>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Saving…" : "Save profile"}
          </button>
          {state.savedAt && !pending && (
            <span className="text-sm text-green-700" role="status">
              Saved
            </span>
          )}
          <span className="ml-auto text-sm text-stone-500">
            Theme: <strong className="font-medium text-stone-700">{themeName}</strong>{" "}
            <Link href="/dashboard/appearance" className="text-brand-600 hover:underline">
              Customise
            </Link>
          </span>
        </div>
      </form>
      <SocialsEditor rows={draft.socials} onChange={(socials) => onChange({ ...draft, socials })} />
    </section>
  );
}
