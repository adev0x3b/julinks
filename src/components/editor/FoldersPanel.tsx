"use client";

import { useState, useTransition } from "react";
import { addFolder, removeFolder, renameFolder, reorderFolderList, setFolderCollapsed } from "@/actions/folders";
import type { Folder } from "@/lib/data/folders";
import { moveItem } from "@/lib/reorder";

/**
 * Folders group links on the public page: an open folder is a titled section,
 * a collapsed one a row that expands on tap. Links are put in folders from
 * their own row in the list below.
 */
export function FoldersPanel({ folders, onChange, onRefresh }: { folders: Folder[]; onChange: (next: Folder[]) => void; onRefresh: () => void }) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    setError(null);
    startTransition(async () => {
      const result = await addFolder({ title });
      if (result.ok) {
        onChange([...folders, result.folder]);
        setTitle("");
      } else {
        setError(result.error);
      }
    });
  }

  function move(index: number, to: number) {
    const next = moveItem(folders, index, to);
    onChange(next);
    startTransition(async () => {
      const result = await reorderFolderList(next.map((f) => f.id));
      if (!result.ok) {
        setError(result.error);
        onChange(folders);
      }
    });
  }

  return (
    <section className="card" data-testid="folders-panel">
      <h2 className="text-base font-semibold">Folders</h2>
      <p className="mb-4 text-sm text-stone-500">
        Group links under a heading, or collapse a folder into a row that opens on tap. Pick a folder for each link in the
        list below.
      </p>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(ev) => {
          ev.preventDefault();
          create();
        }}
      >
        <label htmlFor="new-folder" className="sr-only">
          Folder name
        </label>
        <input id="new-folder" className="input" placeholder="New folder, e.g. Articles" value={title} maxLength={40} onChange={(ev) => setTitle(ev.target.value)} required />
        <button type="submit" className="btn-primary shrink-0" disabled={pending || title.trim().length === 0}>
          Add folder
        </button>
      </form>
      {error && (
        <p className="error mb-3" role="alert">
          {error}
        </p>
      )}
      {folders.length === 0 ? (
        <p className="text-sm text-stone-500">No folders yet. Links show in one list.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {folders.map((folder, index) => (
            <FolderRow
              key={folder.id}
              folder={folder}
              first={index === 0}
              last={index === folders.length - 1}
              onPatch={(changes) => onChange(folders.map((f) => (f.id === folder.id ? { ...f, ...changes } : f)))}
              onRemoved={() => {
                onChange(folders.filter((f) => f.id !== folder.id));
                onRefresh();
              }}
              onMove={(delta) => move(index, index + delta)}
              onError={setError}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function FolderRow({
  folder,
  first,
  last,
  onPatch,
  onRemoved,
  onMove,
  onError,
}: {
  folder: Folder;
  first: boolean;
  last: boolean;
  onPatch: (changes: Partial<Folder>) => void;
  onRemoved: () => void;
  onMove: (delta: -1 | 1) => void;
  onError: (message: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(folder.title);

  function commitTitle() {
    const next = title.trim();
    if (next === folder.title || next.length === 0) {
      setTitle(folder.title);
      return;
    }
    startTransition(async () => {
      const result = await renameFolder(folder.id, { title: next });
      if (result.ok) onPatch({ title: result.folder.title });
      else {
        setTitle(folder.title);
        onError(result.error);
      }
    });
  }

  function toggleCollapsed() {
    const collapsed = !folder.collapsed;
    onPatch({ collapsed });
    startTransition(async () => {
      const result = await setFolderCollapsed(folder.id, collapsed);
      if (!result.ok) {
        onPatch({ collapsed: !collapsed });
        onError(result.error);
      }
    });
  }

  function remove() {
    if (!window.confirm(`Delete the folder "${folder.title}"? Its links go back to the main list.`)) return;
    startTransition(async () => {
      const result = await removeFolder(folder.id);
      if (result.ok) onRemoved();
      else onError(result.error);
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white p-2" data-testid="folder-row" data-collapsed={folder.collapsed}>
      <input
        className="input min-w-32 flex-1"
        value={title}
        maxLength={40}
        onChange={(ev) => setTitle(ev.target.value)}
        onBlur={commitTitle}
        onKeyDown={(ev) => {
          if (ev.key === "Enter") (ev.target as HTMLInputElement).blur();
        }}
        aria-label={`Name of folder ${folder.title}`}
      />
      <label className="flex items-center gap-2 text-sm text-stone-600">
        <input type="checkbox" checked={folder.collapsed} onChange={toggleCollapsed} disabled={pending} aria-label={`Collapse ${folder.title} on the page`} />
        Collapsed
      </label>
      <div className="flex gap-1">
        <button type="button" className="btn-ghost px-2" disabled={first || pending} onClick={() => onMove(-1)} aria-label={`Move folder ${folder.title} up`}>
          ↑
        </button>
        <button type="button" className="btn-ghost px-2" disabled={last || pending} onClick={() => onMove(1)} aria-label={`Move folder ${folder.title} down`}>
          ↓
        </button>
        <button type="button" className="btn-ghost px-2 text-red-600 hover:text-red-700" disabled={pending} onClick={remove} aria-label={`Delete folder ${folder.title}`}>
          Delete
        </button>
      </div>
    </li>
  );
}
