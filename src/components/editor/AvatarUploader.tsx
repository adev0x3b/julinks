"use client";

import { useRef, useState, useTransition } from "react";
import { removeAvatar, uploadAvatar } from "@/actions/uploads";

/**
 * Avatar picker: choosing a file submits it straight away, the server resizes
 * and stores it, and the page refreshes with the new URL.
 */
export function AvatarUploader({
  avatarUrl,
  initials,
  onChanged,
}: {
  avatarUrl: string | null;
  initials: string;
  onChanged: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pick(file: File | undefined) {
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await uploadAvatar(null, formData);
      if (result.ok) {
        setError(null);
        onChanged(result.url);
      } else {
        setError(result.error);
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeAvatar();
      if (result.ok) onChanged(null);
      else setError(result.error);
    });
  }

  return (
    <div className="flex items-center gap-4">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="Your avatar" className="size-16 rounded-full object-cover" data-testid="avatar-image" />
      ) : (
        <div className="grid size-16 place-items-center rounded-full bg-stone-200 text-xl font-semibold text-stone-600" aria-hidden>
          {initials || "?"}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className={`btn-secondary cursor-pointer ${pending ? "pointer-events-none opacity-60" : ""}`}>
          {pending ? "Uploading…" : avatarUrl ? "Change photo" : "Upload photo"}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            aria-label="Upload avatar"
            onChange={(ev) => pick(ev.target.files?.[0])}
            disabled={pending}
          />
        </label>
        {avatarUrl && (
          <button type="button" className="btn-ghost" onClick={remove} disabled={pending}>
            Remove
          </button>
        )}
        {error && (
          <p className="error mt-0 w-full" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
