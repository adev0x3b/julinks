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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useState } from "react";
import { reorder } from "@/actions/links";
import type { Folder } from "@/lib/data/folders";
import { moveItem } from "@/lib/reorder";
import type { ImageFocus, ImageLayout } from "@/lib/validation";
import { LinkRow } from "./LinkRow";

export type EditorLink = {
  id: string;
  title: string;
  url: string;
  enabled: boolean;
  clicks: number;
  thumbnailUrl: string | null;
  imageLayout: ImageLayout;
  imageFocus: ImageFocus;
  folderId: string | null;
};

export function LinkList({
  items,
  folders,
  onChange,
  onRefresh,
}: {
  items: EditorLink[];
  folders: Folder[];
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
                folders={folders}
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
