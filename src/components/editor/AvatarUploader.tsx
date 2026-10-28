"use client";

import { useRef, useState, useTransition } from "react";
import { setAvatarFocus } from "@/actions/profile";
import { removeAvatar, uploadAvatar } from "@/actions/uploads";
import { FramedImage } from "@/components/PublicProfile";
import type { ImageFocus } from "@/lib/validation";
import { FocalPointPicker, useDebouncedSave } from "./FocalPointPicker";

/**
 * Avatar picker: choosing a file submits it straight away, the server resizes
 * and stores it, and the page refreshes with the new URL. "Adjust" opens the
 * focal point and zoom picker; its changes save on their own after a short pause.
 */
export function AvatarUploader({
  avatarUrl,
  focus,
  initials,
  onChanged,
  onFocusChanged,
}: {
  avatarUrl: string | null;
  focus: ImageFocus;
  initials: string;
  onChanged: (url: string | null) => void;
  onFocusChanged: (focus: ImageFocus) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [focusStatus, setFocusStatus] = useState<"saving" | "saved" | null>(null);
  const [pending, startTransition] = useTransition();
  const saveFocus = useDebouncedSave((next: ImageFocus) => {
    startTransition(async () => {
      const result = await setAvatarFocus(next);
      if (result.ok) {
        setFocusStatus("saved");
      } else {
        setFocusStatus(null);
        setError(result.error);
      }
    });
  });

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
      if (result.ok) {
        setAdjusting(false);
        onChanged(null);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          <FramedImage src={avatarUrl} alt="Your avatar" focus={focus} className="size-16 shrink-0 rounded-full" testId="avatar-image" />
        ) : (
          <div
            className="grid size-16 place-items-center rounded-full bg-stone-200 text-xl font-semibold text-stone-600"
            aria-hidden
          >
            {initials || "?"}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <label
            className={`btn-secondary cursor-pointer ${pending ? "pointer-events-none opacity-60" : ""}`}
          >
            {pending ? "Working…" : avatarUrl ? "Change photo" : "Upload photo"}
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
            <>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setAdjusting((v) => !v)}
                aria-expanded={adjusting}
              >
                {adjusting ? "Done" : "Adjust"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={remove}
                disabled={pending}
              >
                Remove
              </button>
            </>
          )}
          {error && (
            <p className="error mt-0 w-full" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
      {avatarUrl && adjusting && (
        <div
          className="rounded-xl border border-stone-200 bg-stone-50 p-4"
          data-testid="avatar-adjust"
        >
          <p className="mb-3 text-sm text-stone-600">
            Click the photo, or drag, to choose what sits in the middle of the
            circle. Zoom in to fill it with your face.
          </p>
          <FocalPointPicker
            src={avatarUrl}
            focus={focus}
            shape="circle"
            name="your photo"
            onChange={(next) => {
              onFocusChanged(next);
              setFocusStatus("saving");
              saveFocus(next);
            }}
          />
          {focusStatus && (
            <p className="mt-2 text-sm text-stone-500" role="status">
              {focusStatus === "saving" ? "Saving…" : "Saved"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
