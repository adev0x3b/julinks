"use client";

import { useEffect, useState } from "react";

const TONES = {
  info: "border-sky-200 bg-sky-50 text-sky-900",
  danger: "border-rose-200 bg-rose-50 text-rose-900",
} as const;

/**
 * A floating notice at the top of the viewport that dismisses itself. Each new
 * message shows again even when the text is the same (the key resets the timer).
 */
export function Toast({ tone, message, duration = 8000 }: { tone: keyof typeof TONES; message: string; duration?: number }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setOpen(false), duration);
    return () => clearTimeout(timer);
  }, [duration]);
  if (!open) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div
        role={tone === "danger" ? "alert" : "status"}
        data-testid="toast"
        className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${TONES[tone]}`}
      >
        <span className="flex-1">{message}</span>
        <button type="button" onClick={() => setOpen(false)} className="-mr-1 rounded-md px-1 text-lg leading-none opacity-60 hover:opacity-100" aria-label="Dismiss">
          ×
        </button>
      </div>
    </div>
  );
}
