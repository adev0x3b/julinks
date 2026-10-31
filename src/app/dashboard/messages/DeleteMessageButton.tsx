"use client";

import { useState, useTransition } from "react";
import { deleteMessage } from "@/actions/contact";

/** Deletes one contact message after a confirmation; the row disappears when the page refreshes. */
export function DeleteMessageButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    if (!window.confirm("Delete this message? Do it once it is dealt with; it cannot be undone.")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteMessage(id);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button type="button" className="btn-ghost text-sm" disabled={pending} onClick={remove} aria-label="Delete message">
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error && (
        <p className="error text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
