"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  editLink,
  removeLink,
  reorder,
  setLinkEnabled,
  setLinkImage,
} from "@/actions/links";
import { removeLinkThumbnail, uploadLinkThumbnail } from "@/actions/uploads";
import { focusPosition } from "@/components/PublicProfile";
import { moveItem } from "@/lib/reorder";
import type { ImageFocus, ImageLayout } from "@/lib/validation";
import { FocalPointPicker, useDebouncedSave } from "./FocalPointPicker";

export type EditorLink = {
  id: string;
  title: string;
  url: string;
  enabled: boolean;
  clicks: number;
  thumbnailUrl: string | null;
  imageLayout: ImageLayout;
  imageFocus: ImageFocus;
};

export function LinkList({
  items,
  onChange,
  onRefresh,
}: {
  items: EditorLink[];
  onChange: (next: EditorLink[]) => void;
  onRefresh: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<"saving" | "saved" | null>(
    null,
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((l) => l.id === active.id);
    const to = items.findIndex((l) => l.id === over.id);
    const next = moveItem(items, from, to);
    onChange(next);
    setOrderStatus("saving");
    const result = await reorder(next.map((l) => l.id));
    if (!result.ok) {
      setError(result.error);
      setOrderStatus(null);
      onChange(items);
      return;
    }
    setOrderStatus("saved");
  }

  function patch(id: string, changes: Partial<EditorLink>) {
    onChange(items.map((l) => (l.id === id ? { ...l, ...changes } : l)));
  }

  if (items.length === 0) {
    return (
      <p className="rounded-xl bg-stone-50 p-6 text-center text-sm text-stone-500">
        Add your first link above.
      </p>
    );
  }

  return (
    <div>
      {error && (
        <p className="error mb-3" role="alert">
          {error}
        </p>
      )}
      {orderStatus && (
        <p className="mb-2 text-xs text-stone-500" data-testid="order-status">
          {orderStatus === "saving" ? "Saving order…" : "Order saved"}
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex flex-col gap-2" data-testid="link-list">
            {items.map((link) => (
              <LinkRow
                key={link.id}
                link={link}
                onPatch={(changes) => patch(link.id, changes)}
                onRemoved={() =>
                  onChange(items.filter((l) => l.id !== link.id))
                }
                onError={setError}
                onRefresh={onRefresh}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function LinkRow({
  link,
  onPatch,
  onRemoved,
  onError,
  onRefresh,
}: {
  link: EditorLink;
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
      <div className="flex items-center gap-3">
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
          onPatch={onPatch}
          onError={onError}
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
          <div className="min-w-0 flex-1">
            <p
              className={`truncate text-sm font-medium ${link.enabled ? "" : "text-stone-400 line-through"}`}
            >
              {link.title}
            </p>
            <p className="truncate text-xs text-stone-500">{link.url}</p>
          </div>
        )}

        {!editing && (
          <>
            <span
              className="hidden text-xs text-stone-400 sm:inline"
              title="Clicks"
            >
              {link.clicks} {link.clicks === 1 ? "click" : "clicks"}
            </span>
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
          </>
        )}
      </div>
      {pictureOpen && link.thumbnailUrl && (
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
        onPatch({ thumbnailUrl: result.url, imageFocus: { x: 50, y: 50 } });
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
 * The square before the title: a dashed placeholder that opens the file
 * dialog, or the link's picture, which opens the picture panel below the row.
 */
function PictureButton({
  link,
  open,
  onToggle,
  onPatch,
  onError,
}: {
  link: EditorLink;
  open: boolean;
  onToggle: () => void;
  onPatch: (changes: Partial<EditorLink>) => void;
  onError: (message: string | null) => void;
}) {
  const { inputRef, pending, input } = usePictureUpload(link, onPatch, onError);
  return (
    <div className="shrink-0">
      <button
        type="button"
        className={`grid size-10 place-items-center overflow-hidden rounded-lg border text-stone-400 transition hover:border-brand-500 hover:text-brand-600 ${
          link.thumbnailUrl
            ? "border-stone-200"
            : "border-dashed border-stone-300"
        } ${open ? "ring-2 ring-brand-100" : ""} ${pending ? "opacity-60" : ""}`}
        aria-label={
          link.thumbnailUrl
            ? `Picture settings for ${link.title}`
            : `Add picture for ${link.title}`
        }
        aria-expanded={link.thumbnailUrl ? open : undefined}
        onClick={() =>
          link.thumbnailUrl ? onToggle() : inputRef.current?.click()
        }
        disabled={pending}
      >
        {link.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={link.thumbnailUrl}
            alt=""
            className="size-full object-cover"
            style={{ objectPosition: focusPosition(link.imageFocus) }}
            data-testid="link-thumbnail"
          />
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
      {!link.thumbnailUrl && input(`Picture file for ${link.title}`)}
    </div>
  );
}

/** Small or big, where the picture is centred, change it or remove it. Settings save on their own. */
function PicturePanel({
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
        onPatch({ thumbnailUrl: null, imageFocus: { x: 50, y: 50 } });
        onClose();
      } else {
        onError(result.error);
      }
    });
  }

  const name = `picture for ${link.title}`;
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
