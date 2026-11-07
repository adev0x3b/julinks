"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { setLinkImage } from "@/actions/links";
import { grabLinkPreview, removeLinkThumbnail, uploadLinkThumbnail } from "@/actions/uploads";
import { CENTRE, FramedImage } from "@/components/PublicProfile";
import type { ImageFocus, ImageLayout } from "@/lib/validation";
import { FocalPointPicker, useDebouncedSave } from "./FocalPointPicker";
import type { EditorLink } from "./LinkList";

/** Uploads a picture for a link; shared by the square and the panel's "Change picture". */
function usePictureUpload(
  link: EditorLink,
  onPatch: (changes: Partial<EditorLink>) => void,
  onError: (message: string | null) => void,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  function pick(file: File | undefined) {
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await uploadLinkThumbnail(link.id, formData);
      if (result.ok) {
        onError(null);
        // A new picture starts centred, like the server records it.
        onPatch({ thumbnailUrl: result.url, imageFocus: CENTRE });
      } else {
        onError(result.error);
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  }
  const input = (label: string) => (
    <input
      ref={inputRef}
      type="file"
      accept="image/png,image/jpeg,image/webp,image/gif"
      className="sr-only"
      aria-label={label}
      onChange={(ev) => pick(ev.target.files?.[0])}
      disabled={pending}
    />
  );
  return { inputRef, pending, input };
}

/**
 * The square before the title: a dashed placeholder or the link's picture.
 * Either opens the picture panel below the row.
 */
export function PictureButton({
  link,
  open,
  onToggle,
}: {
  link: EditorLink;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="shrink-0">
      <button
        type="button"
        className={`grid size-10 place-items-center overflow-hidden rounded-lg border text-stone-400 transition hover:border-brand-500 hover:text-brand-600 ${
          link.thumbnailUrl
            ? "border-stone-200"
            : "border-dashed border-stone-300"
        } ${open ? "ring-2 ring-brand-100" : ""}`}
        aria-label={
          link.thumbnailUrl
            ? `Picture settings for ${link.title}`
            : `Add picture for ${link.title}`
        }
        aria-expanded={open}
        onClick={onToggle}
      >
        {link.thumbnailUrl ? (
          <FramedImage src={link.thumbnailUrl} focus={link.imageFocus} className="size-full" testId="link-thumbnail" />
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        )}
      </button>
    </div>
  );
}

/**
 * Without a picture: upload one or grab the link's own preview image. With one:
 * small or big, where it is centred, change it or remove it. Settings save on their own.
 */
export function PicturePanel({
  link,
  onPatch,
  onError,
  onClose,
}: {
  link: EditorLink;
  onPatch: (changes: Partial<EditorLink>) => void;
  onError: (message: string | null) => void;
  onClose: () => void;
}) {
  const { pending: uploading, input } = usePictureUpload(link, onPatch, onError);
  const [pending, startTransition] = useTransition();
  const [grabbing, startGrab] = useTransition();
  const [grabError, setGrabError] = useState<string | null>(null);
  const [status, setStatus] = useState<"saving" | "saved" | null>(null);
  const latest = useRef({ layout: link.imageLayout, focus: link.imageFocus });
  useEffect(() => {
    latest.current = { layout: link.imageLayout, focus: link.imageFocus };
  }, [link.imageLayout, link.imageFocus]);

  function save(settings: { layout: ImageLayout; focus: ImageFocus }) {
    setStatus("saving");
    startTransition(async () => {
      const result = await setLinkImage(link.id, settings);
      if (result.ok) {
        setStatus("saved");
      } else {
        setStatus(null);
        onError(result.error);
      }
    });
  }
  const saveFocus = useDebouncedSave((focus: ImageFocus) =>
    save({ layout: latest.current.layout, focus }),
  );

  function setLayout(layout: ImageLayout) {
    onPatch({ imageLayout: layout });
    save({ layout, focus: latest.current.focus });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeLinkThumbnail(link.id);
      if (result.ok) {
        onPatch({ thumbnailUrl: null, imageFocus: CENTRE });
        onClose();
      } else {
        onError(result.error);
      }
    });
  }

  function grab() {
    setGrabError(null);
    startGrab(async () => {
      const result = await grabLinkPreview(link.id);
      if (result.ok) {
        onError(null);
        onPatch({ thumbnailUrl: result.url, imageFocus: CENTRE });
      } else {
        setGrabError(result.error);
      }
    });
  }

  const name = `picture for ${link.title}`;
  const grabButton = (
    <button type="button" className="btn-secondary" onClick={grab} disabled={grabbing || uploading} aria-label={`Grab picture from the link ${link.title}`}>
      {grabbing ? "Fetching…" : "Grab from the link"}
    </button>
  );
  if (!link.thumbnailUrl) {
    return (
      <div className="mt-3 flex flex-col gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4" data-testid="picture-panel">
        <p className="text-sm text-stone-600">Give this link a picture: upload one, or use the preview image the page itself advertises.</p>
        {grabError && (
          <p className="error" role="alert">
            {grabError}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <label className={`btn-primary cursor-pointer ${uploading ? "pointer-events-none opacity-60" : ""}`}>
            {uploading ? "Uploading…" : "Upload a picture"}
            {input(`Picture file for ${link.title}`)}
          </label>
          {grabButton}
          <button type="button" className="btn-ghost ml-auto" onClick={onClose} aria-label={`Close picture settings for ${link.title}`}>
            Done
          </button>
        </div>
      </div>
    );
  }
  return (
    <div
      className="mt-3 flex flex-col gap-4 rounded-xl border border-stone-200 bg-stone-50 p-4"
      data-testid="picture-panel"
    >
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="mb-2 text-sm font-medium">Show it</legend>
        {(
          [
            ["thumbnail", "Small, beside the title"],
            ["featured", "Big, above the title"],
          ] as const
        ).map(([layout, label]) => (
          <label
            key={layout}
            className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${
              link.imageLayout === layout
                ? "border-brand-600 bg-white font-medium text-brand-700"
                : "border-stone-200 text-stone-600 hover:bg-white"
            }`}
          >
            <input
              type="radio"
              name={`layout-${link.id}`}
              value={layout}
              checked={link.imageLayout === layout}
              onChange={() => setLayout(layout)}
              className="sr-only"
              aria-label={`${label} (${name})`}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <div>
        <p className="mb-2 text-sm font-medium">Centre it</p>
        <FocalPointPicker
          src={link.thumbnailUrl!}
          focus={link.imageFocus}
          shape={link.imageLayout === "featured" ? "card" : "circle"}
          name={name}
          onChange={(focus) => {
            onPatch({ imageFocus: focus });
            setStatus("saving");
            saveFocus(focus);
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label
          className={`btn-secondary cursor-pointer ${uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          {uploading ? "Uploading…" : "Change picture"}
          {input(`Picture file for ${link.title}`)}
        </label>
        {grabButton}
        <button
          type="button"
          className="btn-ghost text-red-600 hover:text-red-700"
          onClick={remove}
          disabled={pending || uploading}
        >
          Remove picture
        </button>
        {status && (
          <span className="text-sm text-stone-500" role="status">
            {status === "saving" ? "Saving…" : "Saved"}
          </span>
        )}
        {grabError && (
          <span className="error" role="alert">
            {grabError}
          </span>
        )}
        <button
          type="button"
          className="btn-ghost ml-auto"
          onClick={onClose}
          aria-label={`Close picture settings for ${link.title}`}
        >
          Done
        </button>
      </div>
    </div>
  );
}
