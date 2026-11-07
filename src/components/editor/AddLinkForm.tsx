"use client";

import { useActionState, useEffect, useEffectEvent, useRef } from "react";
import { addLink, type LinkFormState } from "@/actions/links";

const initial: LinkFormState = {};

export function AddLinkForm({ onAdded }: { onAdded: () => void }) {
  const [state, action, pending] = useActionState(addLink, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const e = state.errors ?? {};

  // Once per save: the form is cleared and the editor told. An effect event,
  // so the effect reacts to the save alone and still calls the latest onAdded.
  const added = useEffectEvent(() => {
    formRef.current?.reset();
    onAdded();
  });
  useEffect(() => {
    if (state.savedAt) added();
  }, [state.savedAt]);

  return (
    <form ref={formRef} action={action} className="mb-6 rounded-xl border border-dashed border-stone-300 p-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]">
        <div>
          <label htmlFor="new-title" className="sr-only">
            Title
          </label>
          <input
            id="new-title"
            name="title"
            className="input"
            placeholder="Title"
            maxLength={80}
            defaultValue={state.values?.title}
            required
          />
          {e.title && <p className="error">{e.title}</p>}
        </div>
        <div>
          <label htmlFor="new-url" className="sr-only">
            URL
          </label>
          <input
            id="new-url"
            name="url"
            className="input"
            placeholder="https://…"
            inputMode="url"
            defaultValue={state.values?.url}
            required
          />
          {e.url && <p className="error">{e.url}</p>}
        </div>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Adding…" : "Add link"}
        </button>
      </div>
      {e.form && (
        <p className="error" role="alert">
          {e.form}
        </p>
      )}
    </form>
  );
}
