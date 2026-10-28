"use client";

import { useState, useTransition } from "react";
import { removeQueuedMail } from "@/actions/mail";

/** Deletes one waiting mail after a confirmation; the row disappears when the page refreshes. */
export function DeleteMailButton({ id, label }: { id: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    if (!window.confirm(`Delete "${label}"? It will not be sent.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await removeQueuedMail(id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button type="button" className="btn-ghost text-sm" disabled={pending} onClick={remove} aria-label={`Delete mail: ${label}`}>
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
