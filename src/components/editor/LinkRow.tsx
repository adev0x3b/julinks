"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useTransition } from "react";
import { editLink, removeLink, setLinkEnabled, setLinkFolder } from "@/actions/links";
import type { Folder } from "@/lib/data/folders";
import type { EditorLink } from "./LinkList";
import { PictureButton, PicturePanel } from "./PicturePanel";

/** One sortable row: toggle, inline edit, folder, picture, delete. Optimistic through onPatch, rolled back on failure. */
export function LinkRow({
  link,
  folders,
  onPatch,
  onRemoved,
  onError,
  onRefresh,
}: {
  link: EditorLink;
  folders: Folder[];
  onPatch: (changes: Partial<EditorLink>) => void;
  onRemoved: () => void;
  onError: (message: string | null) => void;
  onRefresh: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: link.id });
  const [editing, setEditing] = useState(false);
  const [pictureOpen, setPictureOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const style = { transform: CSS.Transform.toString(transform), transition };

  function toggle() {
    const enabled = !link.enabled;
    onPatch({ enabled });
    startTransition(async () => {
      const result = await setLinkEnabled(link.id, enabled);
      if (!result.ok) {
        onPatch({ enabled: !enabled });
        onError(result.error);
      }
    });
  }

  function remove() {
    if (!window.confirm(`Delete "${link.title}"?`)) return;
    startTransition(async () => {
      const result = await removeLink(link.id);
      if (result.ok) {
        onRemoved();
        onRefresh();
      } else {
        onError(result.error);
      }
    });
  }

  function moveToFolder(folderId: string | null) {
    const previous = link.folderId;
    onPatch({ folderId });
    startTransition(async () => {
      const result = await setLinkFolder(link.id, folderId);
      if (!result.ok) {
        onPatch({ folderId: previous });
        onError(result.error);
      }
    });
  }

  function save(formData: FormData) {
    const title = String(formData.get("title") ?? "");
    const url = String(formData.get("url") ?? "");
    startTransition(async () => {
      const result = await editLink(link.id, { title, url });
      if (result.ok) {
        onPatch({ title, url });
        onError(null);
        setEditing(false);
        onRefresh();
      } else {
        onError(result.error);
      }
    });
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-stone-200 bg-white p-3 ${isDragging ? "shadow-lg ring-2 ring-brand-100" : ""}`}
      data-testid="link-row"
    >
      {/* On a phone the controls drop to a line of their own, so the title keeps its room. */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="cursor-grab touch-none rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 active:cursor-grabbing"
          aria-label={`Drag to reorder ${link.title}`}
          {...attributes}
          {...listeners}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden
          >
            <circle cx="5" cy="3" r="1.5" />
            <circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" />
            <circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" />
            <circle cx="11" cy="13" r="1.5" />
          </svg>
        </button>
        <PictureButton
          link={link}
          open={pictureOpen}
          onToggle={() => setPictureOpen((v) => !v)}
        />

        {editing ? (
          <form
            action={save}
            className="flex flex-1 flex-wrap items-center gap-2"
          >
            <input
              name="title"
              defaultValue={link.title}
              className="input min-w-32 flex-1"
              aria-label="Title"
              maxLength={80}
              required
            />
            <input
              name="url"
              defaultValue={link.url}
              className="input min-w-48 flex-[2]"
              aria-label="URL"
              required
            />
            <button type="submit" className="btn-primary" disabled={pending}>
              Save
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="min-w-0 flex-1 basis-32">
            <p
              className={`truncate text-sm font-medium ${link.enabled ? "" : "text-stone-400 line-through"}`}
            >
              {link.title}
            </p>
            <p className="truncate text-xs text-stone-500">{link.url}</p>
          </div>
        )}

        {!editing && (
          <div className="flex w-full items-center justify-end gap-2 sm:ml-auto sm:w-auto sm:gap-3">
            <span
              className="hidden text-xs text-stone-400 sm:inline"
              title="Clicks"
            >
              {link.clicks} {link.clicks === 1 ? "click" : "clicks"}
            </span>
            {folders.length > 0 && (
              <select
                className="input min-w-0 flex-1 py-1.5 text-xs sm:w-auto sm:max-w-36 sm:flex-none"
                value={link.folderId && folders.some((f) => f.id === link.folderId) ? link.folderId : ""}
                onChange={(ev) => moveToFolder(ev.target.value || null)}
                disabled={pending}
                aria-label={`Folder for ${link.title}`}
              >
                <option value="">No folder</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.title}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              role="switch"
              aria-checked={link.enabled}
              aria-label={`${link.enabled ? "Disable" : "Enable"} ${link.title}`}
              onClick={toggle}
              disabled={pending}
              className={`relative h-6 w-10 shrink-0 rounded-full transition ${link.enabled ? "bg-brand-600" : "bg-stone-300"}`}
            >
              <span
                className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition ${link.enabled ? "left-[18px]" : "left-0.5"}`}
              />
            </button>
            <button
              type="button"
              className="btn-ghost px-2"
              onClick={() => setEditing(true)}
              aria-label={`Edit ${link.title}`}
            >
              Edit
            </button>
            <button
              type="button"
              className="btn-ghost px-2 text-red-600 hover:text-red-700"
              onClick={remove}
              disabled={pending}
              aria-label={`Delete ${link.title}`}
            >
              Delete
            </button>
          </div>
        )}
      </div>
      {pictureOpen && (
        <PicturePanel
          link={link}
          onPatch={onPatch}
          onError={onError}
          onClose={() => setPictureOpen(false)}
        />
      )}
    </li>
  );
}
